"use server";

import { DEMO_UPLOAD_MESSAGE, isDemoMode } from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { can } from "@/lib/utils/staff-permissions";
import {
  NO_SERIAL_REASON,
  noSerialNeedsOverride,
  normalizeSerialValue,
} from "@/lib/utils/order-serials";
import { dubaiDay, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { OrderStatus } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  archiveOrderComplianceDocuments,
  complianceDocumentRowsFromSnapshot,
} from "@/lib/services/compliance-archive";
import { parseComplianceSnapshot } from "@/lib/db/queries/order";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { runOrderDeliveredEffects } from "@/lib/services/order-delivered";
import { isRegulatedOrder } from "@/lib/utils/order-regulated";
import { detectMimeType, MAX_FILE_SIZE_BYTES } from "@/lib/validations/b2b";

export type ArchiveOrderComplianceResult =
  | {
      success: true;
      data: { archived: number; failed: number; backfilled: number };
    }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "NOT_FOUND"
        | "NOTHING_TO_ARCHIVE"
        | "INTERNAL_ERROR";
    };

export async function archiveOrderComplianceAction(input: {
  orderId: string;
}): Promise<ArchiveOrderComplianceResult> {
  const staff = await requireStaffAction("order:update");

  const orderId =
    typeof input?.orderId === "string" ? input.orderId.trim() : "";
  if (!orderId) {
    return {
      success: false,
      error: "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, complianceSnapshot: true },
  });
  if (!order) {
    return { success: false, error: "Order not found.", errorCode: "NOT_FOUND" };
  }

  const snapshot = parseComplianceSnapshot(order.complianceSnapshot);
  const snapshotRows = snapshot
    ? complianceDocumentRowsFromSnapshot(snapshot)
    : [];

  let backfilled = 0;
  if (snapshotRows.length > 0) {
    try {
      backfilled = await db.$transaction(
        async (tx) => {
          const existing = await tx.orderComplianceDocument.count({
            where: { orderId },
          });
          if (existing > 0) return 0;
          await tx.orderComplianceDocument.createMany({
            data: snapshotRows.map((row) => ({ orderId, ...row })),
          });
          return snapshotRows.length;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      console.error("[archiveOrderComplianceAction] backfill failed", err);
      return {
        success: false,
        error: "The documents could not be copied. Nothing was changed.",
        errorCode: "INTERNAL_ERROR",
      };
    }
  }

  const result = await archiveOrderComplianceDocuments(orderId);

  if (backfilled === 0 && result.pending === 0) {
    return {
      success: false,
      error: "There are no documents waiting to be copied.",
      errorCode: "NOTHING_TO_ARCHIVE",
    };
  }

  await db.auditLog.create({
    data: {
      actorType: "STAFF",
      actorId: staff.id,
      action: "order.compliance_archived",
      entityType: "Order",
      entityId: orderId,
      metadata: {
        archived: result.archived,
        failed: result.failed,
        backfilled,
      },
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);

  return {
    success: true,
    data: {
      archived: result.archived,
      failed: result.failed,
      backfilled,
    },
  };
}

export type RecordOrderSerialsErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STATUS_CHANGED"
  | "INVALID_STATUS"
  | "LOCKED_AFTER_SHIP"
  | "INVALID_UNIT"
  | "DUPLICATE_IN_ORDER"
  | "DUPLICATE_SERIAL"
  | "NO_CHANGES"
  | "INTERNAL_ERROR";

export type RecordOrderSerialsResult =
  | { success: true; data: { recorded: number } }
  | {
      success: false;
      error: string;
      errorCode: RecordOrderSerialsErrorCode;
      unit?: { orderItemId: string; unitIndex: number };
    };

const recordOrderSerialsSchema = z.object({
  orderId: z.string().min(1),
  expectedStatus: z.enum(OrderStatus),
  units: z
    .array(
      z
        .object({
          orderItemId: z.string().min(1),
          unitIndex: z.number().int().min(1),
          value: z.string().trim().min(1).max(100).optional(),
          noSerial: z.literal(true).optional(),
        })
        .refine((u) => (u.value !== undefined) !== (u.noSerial !== undefined), {
          message: "Enter a value or tick No serial on this item for each unit.",
        }),
    )
    .min(1)
    .max(500),
  correctionReason: z.string().trim().min(10).max(300).optional(),
});

const SERIAL_EDITABLE_STATUSES: ReadonlyArray<string> = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
];

class SerialRecordError extends Error {
  constructor(
    readonly code: RecordOrderSerialsErrorCode,
    message: string,
    readonly unit?: { orderItemId: string; unitIndex: number },
  ) {
    super(message);
  }
}

interface SerialSnapshot {
  value: string | null;
  noSerial: boolean;
  overrideReason?: string;
}

export async function recordOrderSerialsAction(
  input: unknown,
): Promise<RecordOrderSerialsResult> {
  const staff = await requireStaffAction("order:update");

  const parsed = recordOrderSerialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { orderId, expectedStatus, units, correctionReason } = parsed.data;

  const seen = new Set<string>();
  for (const u of units) {
    const key = `${u.orderItemId}:${u.unitIndex}`;
    if (seen.has(key)) {
      return {
        success: false,
        error: "A unit was submitted twice.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    seen.add(key);
  }

  const canOverride = can(staff.staffRole, "compliance:override");

  try {
    const recorded = await db.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            items: {
              where: { itemType: "PRODUCT" },
              select: {
                id: true,
                productSku: true,
                quantity: true,
                product: { select: { serialTracking: true } },
                serials: {
                  select: { unitIndex: true, value: true, overrideReason: true },
                },
              },
            },
          },
        });
        if (!order) throw new SerialRecordError("NOT_FOUND", "Order not found.");

        if (order.status !== expectedStatus) {
          throw new SerialRecordError(
            "STATUS_CHANGED",
            "This order changed since you opened it. Reload the page.",
          );
        }

        if (!SERIAL_EDITABLE_STATUSES.includes(order.status)) {
          if (order.status === "SHIPPED" || order.status === "DELIVERED") {
            if (!canOverride || !correctionReason) {
              throw new SerialRecordError(
                "LOCKED_AFTER_SHIP",
                "Serials are locked once an order has shipped. A correction needs override permission and a reason.",
              );
            }
          } else {
            throw new SerialRecordError(
              "INVALID_STATUS",
              "Serials cannot be recorded in this order status.",
            );
          }
        }

        const lines = new Map(order.items.map((i) => [i.id, i]));

        for (const u of units) {
          const line = lines.get(u.orderItemId);
          if (!line || u.unitIndex > line.quantity) {
            throw new SerialRecordError(
              "INVALID_UNIT",
              "This unit does not belong to a product line on this order.",
              { orderItemId: u.orderItemId, unitIndex: u.unitIndex },
            );
          }
          const tracking = line.product?.serialTracking ?? "NONE";
          if (
            u.noSerial !== undefined &&
            noSerialNeedsOverride(tracking) &&
            !canOverride
          ) {
            throw new SerialRecordError(
              "FORBIDDEN",
              "Only staff with override permission can mark a firearm or ammunition unit as having no serial.",
              { orderItemId: u.orderItemId, unitIndex: u.unitIndex },
            );
          }
        }

        const submittedByLine = new Map<string, typeof units>();
        for (const u of units) {
          const list = submittedByLine.get(u.orderItemId) ?? [];
          list.push(u);
          submittedByLine.set(u.orderItemId, list);
        }

        for (const [lineId, submitted] of submittedByLine) {
          const line = lines.get(lineId)!;
          if (line.product?.serialTracking === "LOT") continue;

          const finalValues = new Map<number, string>();
          for (const existing of line.serials) {
            if (existing.value) {
              finalValues.set(
                existing.unitIndex,
                normalizeSerialValue(existing.value),
              );
            }
          }
          for (const u of submitted) {
            if (u.value !== undefined) {
              finalValues.set(u.unitIndex, normalizeSerialValue(u.value));
            } else {
              finalValues.delete(u.unitIndex);
            }
          }

          const owner = new Map<string, number>();
          for (const [unitIndex, value] of finalValues) {
            const prior = owner.get(value);
            if (prior !== undefined) {
              const offender =
                submitted.find((u) => u.unitIndex === unitIndex) ??
                submitted.find((u) => u.unitIndex === prior);
              if (offender) {
                throw new SerialRecordError(
                  "DUPLICATE_IN_ORDER",
                  "This serial is used on another unit of this order.",
                  {
                    orderItemId: offender.orderItemId,
                    unitIndex: offender.unitIndex,
                  },
                );
              }
            }
            owner.set(value, unitIndex);
          }

          for (const u of submitted) {
            if (u.value === undefined) continue;
            const clash = await tx.orderItemSerial.findFirst({
              where: {
                value: { equals: u.value, mode: "insensitive" },
                orderItem: {
                  productSku: line.productSku,
                  orderId: { not: orderId },
                  order: { status: { notIn: ["CANCELLED", "RETURNED"] } },
                },
              },
              select: {
                orderItem: {
                  select: { order: { select: { orderNumber: true } } },
                },
              },
            });
            if (clash) {
              throw new SerialRecordError(
                "DUPLICATE_SERIAL",
                `This serial is already recorded on order ${clash.orderItem.order.orderNumber}.`,
                { orderItemId: u.orderItemId, unitIndex: u.unitIndex },
              );
            }
          }
        }

        const changes: {
          sku: string | null;
          unitIndex: number;
          before: SerialSnapshot | null;
          after: SerialSnapshot;
        }[] = [];

        for (const u of units) {
          const line = lines.get(u.orderItemId)!;
          const existing = line.serials.find((s) => s.unitIndex === u.unitIndex);
          const nextValue = u.value ?? null;
          const nextOverrideReason =
            u.noSerial !== undefined ? NO_SERIAL_REASON : null;
          const after: SerialSnapshot = {
            value: nextValue,
            noSerial: u.noSerial !== undefined,
          };
          if (
            existing &&
            existing.value === nextValue &&
            existing.overrideReason === nextOverrideReason
          ) {
            continue;
          }

          await tx.orderItemSerial.upsert({
            where: {
              orderItemId_unitIndex: {
                orderItemId: u.orderItemId,
                unitIndex: u.unitIndex,
              },
            },
            create: {
              orderItemId: u.orderItemId,
              unitIndex: u.unitIndex,
              value: nextValue,
              overrideReason: nextOverrideReason,
              recordedById: staff.id,
            },
            update: {
              value: nextValue,
              overrideReason: nextOverrideReason,
              recordedById: staff.id,
            },
          });

          changes.push({
            sku: line.productSku,
            unitIndex: u.unitIndex,
            before: existing
              ? {
                  value: existing.value,
                  noSerial: existing.overrideReason === NO_SERIAL_REASON,
                  ...(existing.overrideReason !== null &&
                  existing.overrideReason !== NO_SERIAL_REASON
                    ? { overrideReason: existing.overrideReason }
                    : {}),
                }
              : null,
            after,
          });
        }

        if (changes.length === 0) {
          throw new SerialRecordError("NO_CHANGES", "Nothing changed.");
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: order.status,
            toStatus: order.status,
            rawPayload: {
              source: "serials",
              units: changes.length,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.serials_recorded",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              changes,
              correctionReason: correctionReason ?? null,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return changes.length;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true, data: { recorded } };
  } catch (err) {
    if (err instanceof SerialRecordError) {
      return {
        success: false,
        error: err.message,
        errorCode: err.code,
        unit: err.unit,
      };
    }
    console.error("[recordOrderSerialsAction]", err);
    return {
      success: false,
      error: "Something went wrong. Nothing was saved.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

const DELIVERY_PROOFS_BUCKET = "payment-proofs";

export type DeliveryErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "STATUS_CHANGED"
  | "INVALID_STATUS"
  | "ID_CHECK_REQUIRED"
  | "INVALID_DATE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "ALREADY_RECORDED"
  | "INTERNAL_ERROR";

export type DeliveryActionResult =
  | { success: true }
  | { success: false; error: string; errorCode: DeliveryErrorCode };

class DeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const deliveryFieldsSchema = z.object({
  orderId: z.string().min(1),
  deliveredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the order was delivered."),
  receivedBy: z
    .string()
    .trim()
    .min(2, "Enter the name of the person who received the order.")
    .max(120),
  idChecked: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});

function sanitizeDeliveryFilename(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
}

function deliveryDayStoredAt(day: string): Date {
  if (day === dubaiDay(new Date())) return new Date();
  const bounds = dubaiDayBoundsUtc(day);
  if (!bounds) throw new DeliveryError("INVALID_DATE", "Enter a valid date.");
  return bounds.start;
}

function readDeliveryFields(formData: FormData) {
  const note = formData.get("note");
  return deliveryFieldsSchema.safeParse({
    orderId: formData.get("orderId"),
    deliveredOn: formData.get("deliveredOn"),
    receivedBy: formData.get("receivedBy"),
    idChecked: formData.get("idChecked") === "true",
    note: typeof note === "string" && note.trim() !== "" ? note : undefined,
  });
}

async function readDeliveryProof(
  formData: FormData,
): Promise<
  | { ok: true; proof: { file: File; mime: string } | null }
  | { ok: false; result: DeliveryActionResult }
> {
  const raw = formData.get("proof");
  if (!(raw instanceof File) || raw.size === 0) return { ok: true, proof: null };

  if (isDemoMode()) {
    return {
      ok: false,
      result: {
        success: false,
        error: DEMO_UPLOAD_MESSAGE,
        errorCode: "INVALID_FILE_TYPE",
      },
    };
  }

  if (raw.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      result: {
        success: false,
        error: "The proof file exceeds the 5 MB size limit.",
        errorCode: "FILE_TOO_LARGE",
      },
    };
  }

  const detected = await detectMimeType(raw);
  if (detected === null || detected !== raw.type) {
    return {
      ok: false,
      result: {
        success: false,
        error: "The proof file type is unsupported. Allowed: JPEG, PNG, PDF.",
        errorCode: "INVALID_FILE_TYPE",
      },
    };
  }

  return { ok: true, proof: { file: raw, mime: detected } };
}

function deliveryErrorResult(err: unknown, label: string): DeliveryActionResult {
  if (err instanceof DeliveryError) {
    return { success: false, error: err.message, errorCode: err.code };
  }
  console.error(`[${label}]`, err);
  return {
    success: false,
    error: "Something went wrong. Nothing was saved.",
    errorCode: "INTERNAL_ERROR",
  };
}

async function discardUploadedProof(key: string | null, label: string) {
  if (key === null) return;
  try {
    await deleteFile(DELIVERY_PROOFS_BUCKET, key);
  } catch (cleanupErr) {
    console.error(`[${label}] rollback cleanup failed`, cleanupErr);
  }
}

export async function markOrderDeliveredAction(
  formData: unknown,
): Promise<DeliveryActionResult> {
  const staff = await requireStaffAction("order:update");

  let uploadedKey: string | null = null;

  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        error: "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const fields = readDeliveryFields(formData);
    if (!fields.success) {
      return {
        success: false,
        error: fields.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    if (formData.get("expectedStatus") !== "SHIPPED") {
      return {
        success: false,
        error: "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, deliveredOn, receivedBy, idChecked, note } = fields.data;

    const preload = await db.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        shippedAt: true,
        complianceSnapshot: true,
        items: {
          where: { itemType: "PRODUCT" },
          select: { product: { select: { requiresIdVerification: true } } },
        },
      },
    });
    if (!preload) {
      return { success: false, error: "Order not found.", errorCode: "NOT_FOUND" };
    }
    if (preload.status !== "SHIPPED") {
      return {
        success: false,
        error: "This order changed since you opened it. Reload the page.",
        errorCode: "STATUS_CHANGED",
      };
    }
    if (isRegulatedOrder(preload.complianceSnapshot, preload.items) && !idChecked) {
      return {
        success: false,
        error:
          "Confirm the recipient's ID was checked before marking this order delivered.",
        errorCode: "ID_CHECK_REQUIRED",
      };
    }
    if (
      deliveredOn > dubaiDay(new Date()) ||
      (preload.shippedAt !== null && deliveredOn < dubaiDay(preload.shippedAt))
    ) {
      return {
        success: false,
        error:
          "The delivered date cannot be in the future or before the order shipped.",
        errorCode: "INVALID_DATE",
      };
    }

    const proofRead = await readDeliveryProof(formData);
    if (!proofRead.ok) return proofRead.result;
    const proof = proofRead.proof;

    let proofFilename: string | null = null;
    let proofMime: string | null = null;
    if (proof) {
      const path = `delivery/${orderId}/${Date.now()}/${sanitizeDeliveryFilename(proof.file.name)}`;
      try {
        const uploaded = await uploadFile({
          bucket: DELIVERY_PROOFS_BUCKET,
          path,
          file: proof.file,
          contentType: proof.mime,
        });
        uploadedKey = uploaded.storageKey;
        proofFilename = proof.file.name;
        proofMime = proof.mime;
      } catch (err) {
        console.error("[markOrderDeliveredAction] upload failed", err);
        return {
          success: false,
          error: "Failed to upload the proof document. Please try again.",
          errorCode: "UPLOAD_FAILED",
        };
      }
    }

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            shippedAt: true,
            complianceSnapshot: true,
            items: {
              where: { itemType: "PRODUCT" },
              select: { product: { select: { requiresIdVerification: true } } },
            },
          },
        });
        if (!current) throw new DeliveryError("NOT_FOUND", "Order not found.");
        if (current.status !== "SHIPPED") {
          throw new DeliveryError(
            "STATUS_CHANGED",
            "This order changed since you opened it. Reload the page.",
          );
        }
        if (isRegulatedOrder(current.complianceSnapshot, current.items) && !idChecked) {
          throw new DeliveryError(
            "ID_CHECK_REQUIRED",
            "Confirm the recipient's ID was checked before marking this order delivered.",
          );
        }
        if (
          deliveredOn > dubaiDay(new Date()) ||
          (current.shippedAt !== null &&
            deliveredOn < dubaiDay(current.shippedAt))
        ) {
          throw new DeliveryError(
            "INVALID_DATE",
            "The delivered date cannot be in the future or before the order shipped.",
          );
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "DELIVERED",
            deliveredAt: deliveryDayStoredAt(deliveredOn),
            deliveryReceivedBy: receivedBy,
            deliveryIdChecked: idChecked,
            deliveryNote: note ?? null,
            deliveryProofKey: uploadedKey,
            deliveryProofFilename: proofFilename,
            deliveryProofMimeType: proofMime,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: "SHIPPED",
            toStatus: "DELIVERED",
            note: null,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "delivery",
              receivedBy,
              idChecked,
              deliveredOn,
              proof: proofFilename !== null,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.status_changed",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              fromStatus: "SHIPPED",
              toStatus: "DELIVERED",
              path: ["DELIVERED"],
              note: note ?? null,
              trackingNumber: null,
              trackingUrl: null,
              receivedBy,
              idChecked,
              deliveredOn,
              proof: proofFilename,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    uploadedKey = null;

    try {
      await runOrderDeliveredEffects(orderId);
    } catch (effectsErr) {
      console.error("[markOrderDeliveredAction] delivered effects", effectsErr);
    }

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    await discardUploadedProof(uploadedKey, "markOrderDeliveredAction");
    return deliveryErrorResult(err, "markOrderDeliveredAction");
  }
}

export async function recordDeliveryDetailsAction(
  formData: unknown,
): Promise<DeliveryActionResult> {
  const staff = await requireStaffAction("order:update");

  let uploadedKey: string | null = null;

  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        error: "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const fields = readDeliveryFields(formData);
    if (!fields.success) {
      return {
        success: false,
        error: fields.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, deliveredOn, receivedBy, idChecked, note } = fields.data;

    const preload = await db.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        shippedAt: true,
        deliveryReceivedBy: true,
        complianceSnapshot: true,
        items: {
          where: { itemType: "PRODUCT" },
          select: { product: { select: { requiresIdVerification: true } } },
        },
      },
    });
    if (!preload) {
      return { success: false, error: "Order not found.", errorCode: "NOT_FOUND" };
    }
    if (preload.status !== "DELIVERED") {
      return {
        success: false,
        error: "Handover details can only be added to a delivered order.",
        errorCode: "INVALID_STATUS",
      };
    }
    if (preload.deliveryReceivedBy !== null) {
      return {
        success: false,
        error: "Handover details are already recorded for this order.",
        errorCode: "ALREADY_RECORDED",
      };
    }
    if (isRegulatedOrder(preload.complianceSnapshot, preload.items) && !idChecked) {
      return {
        success: false,
        error:
          "Confirm the recipient's ID was checked before saving the handover details.",
        errorCode: "ID_CHECK_REQUIRED",
      };
    }
    if (
      deliveredOn > dubaiDay(new Date()) ||
      (preload.shippedAt !== null && deliveredOn < dubaiDay(preload.shippedAt))
    ) {
      return {
        success: false,
        error:
          "The delivered date cannot be in the future or before the order shipped.",
        errorCode: "INVALID_DATE",
      };
    }

    const proofRead = await readDeliveryProof(formData);
    if (!proofRead.ok) return proofRead.result;
    const proof = proofRead.proof;

    let proofFilename: string | null = null;
    let proofMime: string | null = null;
    if (proof) {
      const path = `delivery/${orderId}/${Date.now()}/${sanitizeDeliveryFilename(proof.file.name)}`;
      try {
        const uploaded = await uploadFile({
          bucket: DELIVERY_PROOFS_BUCKET,
          path,
          file: proof.file,
          contentType: proof.mime,
        });
        uploadedKey = uploaded.storageKey;
        proofFilename = proof.file.name;
        proofMime = proof.mime;
      } catch (err) {
        console.error("[recordDeliveryDetailsAction] upload failed", err);
        return {
          success: false,
          error: "Failed to upload the proof document. Please try again.",
          errorCode: "UPLOAD_FAILED",
        };
      }
    }

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            shippedAt: true,
            deliveryReceivedBy: true,
            complianceSnapshot: true,
            items: {
              where: { itemType: "PRODUCT" },
              select: { product: { select: { requiresIdVerification: true } } },
            },
          },
        });
        if (!current) throw new DeliveryError("NOT_FOUND", "Order not found.");
        if (current.status !== "DELIVERED") {
          throw new DeliveryError(
            "INVALID_STATUS",
            "Handover details can only be added to a delivered order.",
          );
        }
        if (current.deliveryReceivedBy !== null) {
          throw new DeliveryError(
            "ALREADY_RECORDED",
            "Handover details are already recorded for this order.",
          );
        }
        if (isRegulatedOrder(current.complianceSnapshot, current.items) && !idChecked) {
          throw new DeliveryError(
            "ID_CHECK_REQUIRED",
            "Confirm the recipient's ID was checked before saving the handover details.",
          );
        }
        if (
          deliveredOn > dubaiDay(new Date()) ||
          (current.shippedAt !== null &&
            deliveredOn < dubaiDay(current.shippedAt))
        ) {
          throw new DeliveryError(
            "INVALID_DATE",
            "The delivered date cannot be in the future or before the order shipped.",
          );
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            deliveryReceivedBy: receivedBy,
            deliveryIdChecked: idChecked,
            deliveryNote: note ?? null,
            deliveryProofKey: uploadedKey,
            deliveryProofFilename: proofFilename,
            deliveryProofMimeType: proofMime,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: "DELIVERED",
            toStatus: "DELIVERED",
            note: null,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "delivery_details",
              receivedBy,
              idChecked,
              deliveredOn,
              proof: proofFilename !== null,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.delivery_details_recorded",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              receivedBy,
              idChecked,
              deliveredOn,
              note: note ?? null,
              proof: proofFilename,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    uploadedKey = null;

    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    await discardUploadedProof(uploadedKey, "recordDeliveryDetailsAction");
    return deliveryErrorResult(err, "recordDeliveryDetailsAction");
  }
}
