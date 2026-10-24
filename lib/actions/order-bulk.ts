"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { dubaiDay, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { isRegulatedOrder } from "@/lib/utils/order-regulated";
import { runOrderDeliveredEffects } from "@/lib/services/order-delivered";
import type { OrderStatus, Prisma } from "@/app/generated/prisma/client";

const bulkSchema = z.object({
  action: z.enum(["CONFIRM", "START_PROCESSING", "MARK_DELIVERED"]),
  orderIds: z.array(z.string().min(1)).min(1).max(50),
  deliveredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the delivered date.")
    .optional(),
});

export type BulkOrderErrorCode = "VALIDATION_ERROR" | "INTERNAL_ERROR";

export type BulkOrderResult =
  | {
      success: true;
      moved: string[];
      skipped: { orderNumber: string; reason: string }[];
    }
  | { success: false; error: string; errorCode: BulkOrderErrorCode };

class BulkSkip extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

const REASON_CHANGED = "Changed since you loaded the page";

const STEP: Record<
  "CONFIRM" | "START_PROCESSING",
  { from: OrderStatus; to: OrderStatus; notIn: string }
> = {
  CONFIRM: { from: "PAID", to: "CONFIRMED", notIn: "Not in Paid" },
  START_PROCESSING: {
    from: "CONFIRMED",
    to: "PROCESSING",
    notIn: "Not in Confirmed",
  },
};

function deliveredStoredAt(day: string): Date {
  if (day === dubaiDay(new Date())) return new Date();
  const bounds = dubaiDayBoundsUtc(day);
  if (!bounds) throw new BulkSkip("The delivered date is not valid");
  return bounds.start;
}

export async function bulkOrderAction(
  input: unknown,
): Promise<BulkOrderResult> {
  const staff = await requireStaffAction("order:update");

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { action, deliveredOn } = parsed.data;
  const orderIds = Array.from(new Set(parsed.data.orderIds));

  if (action === "MARK_DELIVERED") {
    if (!deliveredOn) {
      return {
        success: false,
        error: "Enter the delivered date.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    if (deliveredOn > dubaiDay(new Date())) {
      return {
        success: false,
        error: "The delivered date cannot be in the future.",
        errorCode: "VALIDATION_ERROR",
      };
    }
  }

  try {
    const moved: string[] = [];
    const skipped: { orderNumber: string; reason: string }[] = [];

    for (const orderId of orderIds) {
      let orderNumber = orderId;
      try {
        await db.$transaction(
          async (tx) => {
            const current = await tx.order.findUnique({
              where: { id: orderId },
              select: {
                orderNumber: true,
                status: true,
                shippedAt: true,
                complianceSnapshot: true,
                items: {
                  where: { itemType: "PRODUCT" },
                  select: {
                    product: { select: { requiresIdVerification: true } },
                  },
                },
              },
            });
            if (!current) throw new BulkSkip("Order not found");
            orderNumber = current.orderNumber;

            let toStatus: OrderStatus;
            const data: Prisma.OrderUpdateInput = {};

            if (action === "MARK_DELIVERED") {
              if (current.status !== "SHIPPED") {
                throw new BulkSkip("Not in Shipped");
              }
              if (
                isRegulatedOrder(current.complianceSnapshot, current.items)
              ) {
                throw new BulkSkip(
                  "Has a regulated item — use the delivery dialog",
                );
              }
              if (
                !deliveredOn ||
                (current.shippedAt !== null &&
                  deliveredOn < dubaiDay(current.shippedAt))
              ) {
                throw new BulkSkip("Delivered date is before it shipped");
              }
              toStatus = "DELIVERED";
              data.status = "DELIVERED";
              data.deliveredAt = deliveredStoredAt(deliveredOn);
            } else {
              const step = STEP[action];
              if (current.status !== step.from) {
                throw new BulkSkip(step.notIn);
              }
              toStatus = step.to;
              data.status = step.to;
            }

            const fromStatus = current.status;

            await tx.order.update({ where: { id: orderId }, data });

            await tx.orderEvent.create({
              data: {
                orderId,
                actor: "STAFF",
                staffId: staff.id,
                fromStatus,
                toStatus,
                note: null,
                trackingNumber: null,
                trackingUrl: null,
                rawPayload: {
                  source: "bulk",
                  action,
                  ...(deliveredOn && toStatus === "DELIVERED"
                    ? { deliveredOn }
                    : {}),
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
                  fromStatus,
                  toStatus,
                  path: [toStatus],
                  note: null,
                  trackingNumber: null,
                  trackingUrl: null,
                  bulk: true,
                  ...(deliveredOn && toStatus === "DELIVERED"
                    ? { deliveredOn }
                    : {}),
                } as unknown as Prisma.InputJsonValue,
              },
            });
          },
          { isolationLevel: "Serializable" },
        );

        moved.push(orderNumber);

        if (action === "MARK_DELIVERED") {
          try {
            await runOrderDeliveredEffects(orderId);
          } catch (effectsErr) {
            console.error("[bulkOrderAction] delivered effects", effectsErr);
          }
        }
      } catch (err) {
        if (err instanceof BulkSkip) {
          skipped.push({ orderNumber, reason: err.reason });
        } else if ((err as { code?: string }).code === "P2034") {
          skipped.push({ orderNumber, reason: REASON_CHANGED });
        } else {
          console.error("[bulkOrderAction]", orderId, err);
          skipped.push({ orderNumber, reason: "Could not be updated" });
        }
      }
    }

    revalidatePath("/admin/orders");
    for (const orderId of orderIds) {
      revalidatePath(`/admin/orders/${orderId}`);
    }

    return { success: true, moved, skipped };
  } catch (err) {
    console.error("[bulkOrderAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
