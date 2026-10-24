"use server";

import {
  DEMO_PLACEHOLDER_DOCUMENT,
  DEMO_UPLOAD_MESSAGE,
  isDemoMode,
} from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import {
  addRefundDueSchema,
  cancelOrderSchema,
  recordRefundSchema,
  returnOrderSchema,
} from "@/lib/validations/order";
import { dubaiDay } from "@/lib/utils/date";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { detectMimeType, MAX_FILE_SIZE_BYTES } from "@/lib/validations/b2b";
import {
  CANCELLABLE_STATUSES,
  HELD_STOCK_STATUSES,
  ORDER_STATUS_LABELS,
  RETURNABLE_STATUSES,
} from "@/lib/utils/order-status";
import { formatAED, roundMoney, sumMoney } from "@/lib/utils/currency";
import { REFUND_METHOD_LABELS } from "@/lib/utils/refund";
import { returnOrderPoints } from "@/lib/services/loyalty";
import {
  deactivateRewardCoupons,
  orderReceived,
  releaseCoupon,
  reverseEarnedPoints,
  unwindStock,
} from "@/lib/services/order-unwind";
import {
  checkCardPayment,
  GatewayUnavailableError,
} from "@/lib/services/card-payment";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadOrderEmailData,
  orderBaseRows,
  customerOrderChrome,
  emailDate,
} from "@/lib/email/order-email";
import { Prisma } from "@/app/generated/prisma/client";

const PAYMENT_PROOFS_BUCKET = "payment-proofs";

function sanitizeProofFilename(originalName: string): string {
  return originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
}

export type CancelOrderErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "STATUS_CHANGED"
  | "INVALID_STATUS"
  | "PAYMENT_RECORD_MISSING"
  | "CONFIRMATION_MISMATCH"
  | "GATEWAY_UNAVAILABLE"
  | "PAYMENT_CAPTURED"
  | "INTERNAL_ERROR";

export type CancelOrderResult =
  | { success: true }
  | { success: false; error: string; errorCode: CancelOrderErrorCode };

const PAID_STAGE_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"];

export async function cancelOrderAction(
  input: unknown,
): Promise<CancelOrderResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = cancelOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, expectedStatus, reason, customerMessage, confirmOrderNumber } =
      parsed.data;

    let gatewayRef: string | null = null;
    let gatewayStatus: string | null = null;

    if (expectedStatus === "PAYMENT_PENDING") {
      const attempt = await db.order.findUnique({
        where: { id: orderId },
        select: { nGeniusOrderRef: true, nGeniusPayRef: true },
      });
      if (attempt?.nGeniusOrderRef) {
        gatewayRef = attempt.nGeniusOrderRef;
        let check: Awaited<ReturnType<typeof checkCardPayment>>;
        try {
          check = await checkCardPayment({
            providerOrderId: attempt.nGeniusOrderRef,
            providerPaymentId: attempt.nGeniusPayRef,
          });
        } catch (err) {
          if (err instanceof GatewayUnavailableError) {
            return {
              success: false,
              error:
                "The payment gateway could not be reached. Nothing was cancelled.",
              errorCode: "GATEWAY_UNAVAILABLE",
            };
          }
          throw err;
        }
        if (check.success) {
          return {
            success: false,
            error:
              "The gateway reports this payment as captured. Nothing was cancelled.",
            errorCode: "PAYMENT_CAPTURED",
          };
        }
        gatewayStatus = check.status;
      }
    }

    const refundDue = await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            total: true,
            paidAt: true,
            orderNumber: true,
            customerId: true,
            refundDue: true,
            convertedFromQuote: { select: { id: true } },
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (current.status !== expectedStatus) throw new Error("STATUS_CHANGED");
        if (!CANCELLABLE_STATUSES.includes(current.status)) {
          throw new Error("INVALID_STATUS");
        }

        const received = await orderReceived(tx, orderId);

        if (PAID_STAGE_STATUSES.includes(current.status) && received === 0) {
          throw new Error("PAYMENT_RECORD_MISSING");
        }

        if (
          received > 0 &&
          (confirmOrderNumber ?? "").toLowerCase() !==
            current.orderNumber.toLowerCase()
        ) {
          throw new Error("CONFIRMATION_MISMATCH");
        }

        const fromStatus = current.status;

        const stock = await unwindStock(tx, {
          orderId,
          staffId: staff.id,
          reason: "Order cancelled by staff",
          releaseReservation: HELD_STOCK_STATUSES.includes(fromStatus),
        });
        const pointsReturned = await returnOrderPoints(tx, {
          customerId: current.customerId,
          orderId,
          reason: "Returned after the order was cancelled",
        });
        const reversal = await reverseEarnedPoints(tx, {
          customerId: current.customerId,
          orderId,
          reason: "Reversed after the order was cancelled",
        });
        const couponReleased = await releaseCoupon(tx, orderId);
        const rewardCouponsDeactivated = await deactivateRewardCoupons(
          tx,
          orderId,
        );

        await tx.order.update({
          where: { id: orderId },
          data: { status: "CANCELLED", refundDue: received },
        });

        if (fromStatus === "PAYMENT_PENDING" && gatewayRef) {
          await tx.paymentTransaction.updateMany({
            where: {
              orderId,
              providerOrderId: gatewayRef,
              status: { in: ["INITIATED", "PENDING"] },
            },
            data: {
              status: "CANCELLED",
              failureMessage: "Order cancelled by staff",
            },
          });
        }

        const summary = {
          refundDue: received,
          stock,
          pointsReturned,
          pointsReversed: reversal.reversed,
          couponReleased,
          rewardCouponsDeactivated,
          gatewayStatus,
        };

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus,
            toStatus: "CANCELLED",
            note: reason,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "cancel",
              ...summary,
              customerMessage: customerMessage || null,
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
              toStatus: "CANCELLED",
              path: ["CANCELLED"],
              note: reason,
              ...summary,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return received;
      },
      { isolationLevel: "Serializable" },
    );

    after(async () => {
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "order_cancelled",
        toEmail: data.customerEmail,
        locale: "en",
        orderId,
        payload: { orderNumber: data.orderNumber },
        chromeOptions: {
          ...customerOrderChrome(data, {
            badge: { text: ORDER_STATUS_LABELS.CANCELLED, tone: "neutral" },
            infoRows: [
              ...orderBaseRows(data),
              ...(refundDue > 0
                ? [{ label: "Refund due", value: formatAED(refundDue) }]
                : []),
            ],
            withSummary: true,
          }),
          ...(customerMessage
            ? {
                messageExcerpt: {
                  label: "Message from the store",
                  text: customerMessage,
                },
              }
            : {}),
        },
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "STATUS_CHANGED") {
        return {
          success: false,
          error: "This order changed since you opened it. Reload the page.",
          errorCode: "STATUS_CHANGED",
        };
      }
      if (err.message === "INVALID_STATUS") {
        return {
          success: false,
          error: "This order can no longer be cancelled.",
          errorCode: "INVALID_STATUS",
        };
      }
      if (err.message === "PAYMENT_RECORD_MISSING") {
        return {
          success: false,
          error:
            "This order is marked paid but has no payment record. Nothing was changed.",
          errorCode: "PAYMENT_RECORD_MISSING",
        };
      }
      if (err.message === "CONFIRMATION_MISMATCH") {
        return {
          success: false,
          error: "The order number you typed does not match this order.",
          errorCode: "CONFIRMATION_MISMATCH",
        };
      }
      if ((err as { code?: string }).code === "P2034") {
        return {
          success: false,
          error: "This order changed since you opened it. Reload the page.",
          errorCode: "STATUS_CHANGED",
        };
      }
    }
    console.error("[cancelOrderAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type ReturnOrderErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "STATUS_CHANGED"
  | "INVALID_STATUS"
  | "PAYMENT_RECORD_MISSING"
  | "CONFIRMATION_MISMATCH"
  | "EXCEEDS_RECEIVED"
  | "REASON_REQUIRED"
  | "BELOW_REFUNDED"
  | "INTERNAL_ERROR";

export type ReturnOrderResult =
  | { success: true }
  | { success: false; error: string; errorCode: ReturnOrderErrorCode };

export async function recordOrderReturnAction(
  input: unknown,
): Promise<ReturnOrderResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = returnOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      orderId,
      expectedStatus,
      restock,
      refundDue: requestedRefundDue,
      refundShortReason,
      reason,
      customerMessage,
      confirmOrderNumber,
    } = parsed.data;
    const refundDue = roundMoney(requestedRefundDue);

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            orderNumber: true,
            customerId: true,
          },
        });

        if (!current) throw new Error("NOT_FOUND");
        if (current.status !== expectedStatus) throw new Error("STATUS_CHANGED");
        if (!RETURNABLE_STATUSES.includes(current.status)) {
          throw new Error("INVALID_STATUS");
        }

        const received = await orderReceived(tx, orderId);
        if (received === 0) throw new Error("PAYMENT_RECORD_MISSING");

        if (
          confirmOrderNumber.toLowerCase() !== current.orderNumber.toLowerCase()
        ) {
          throw new Error("CONFIRMATION_MISMATCH");
        }

        if (refundDue > received) throw new Error("EXCEEDS_RECEIVED");
        if (refundDue < received && (refundShortReason ?? "").length < 5) {
          throw new Error("REASON_REQUIRED");
        }

        const refunds = await tx.orderRefund.findMany({
          where: { orderId },
          select: { amount: true },
        });
        const refunded = sumMoney(refunds.map((row) => Number(row.amount)));
        if (refundDue < refunded) throw new Error("BELOW_REFUNDED");

        const fromStatus = current.status;

        const stock = restock
          ? await unwindStock(tx, {
              orderId,
              staffId: staff.id,
              reason: "Order returned",
              releaseReservation: false,
            })
          : [];
        const pointsReturned = await returnOrderPoints(tx, {
          customerId: current.customerId,
          orderId,
          reason: "Returned after the order was returned",
        });
        const reversal = await reverseEarnedPoints(tx, {
          customerId: current.customerId,
          orderId,
          reason: "Reversed after the order was returned",
        });
        const rewardCouponsDeactivated = await deactivateRewardCoupons(
          tx,
          orderId,
        );

        await tx.order.update({
          where: { id: orderId },
          data: { status: "RETURNED", refundDue },
        });

        const summary = {
          restock,
          refundDue,
          refundShortReason: refundShortReason || null,
          stock,
          pointsReturned,
          pointsReversed: reversal.reversed,
          rewardCouponsDeactivated,
        };

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus,
            toStatus: "RETURNED",
            note: reason,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "return",
              ...summary,
              customerMessage: customerMessage || null,
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
              toStatus: "RETURNED",
              path: ["RETURNED"],
              note: reason,
              ...summary,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    after(async () => {
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "order_returned",
        toEmail: data.customerEmail,
        locale: "en",
        orderId,
        payload: { orderNumber: data.orderNumber },
        chromeOptions: {
          ...customerOrderChrome(data, {
            badge: { text: ORDER_STATUS_LABELS.RETURNED, tone: "neutral" },
            infoRows: [
              { label: "Order", value: data.orderNumber },
              { label: "Returned on", value: emailDate(new Date()) },
              ...(refundDue > 0
                ? [{ label: "Refund due", value: formatAED(refundDue) }]
                : []),
            ],
          }),
          ...(customerMessage
            ? {
                messageExcerpt: {
                  label: "Message from the store",
                  text: customerMessage,
                },
              }
            : {}),
        },
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "STATUS_CHANGED") {
        return {
          success: false,
          error: "This order changed since you opened it. Reload the page.",
          errorCode: "STATUS_CHANGED",
        };
      }
      if (err.message === "INVALID_STATUS") {
        return {
          success: false,
          error: "A return can only be recorded on a shipped or delivered order.",
          errorCode: "INVALID_STATUS",
        };
      }
      if (err.message === "PAYMENT_RECORD_MISSING") {
        return {
          success: false,
          error: "This order has no payment record. Nothing was changed.",
          errorCode: "PAYMENT_RECORD_MISSING",
        };
      }
      if (err.message === "CONFIRMATION_MISMATCH") {
        return {
          success: false,
          error: "The order number you typed does not match this order.",
          errorCode: "CONFIRMATION_MISMATCH",
        };
      }
      if (err.message === "EXCEEDS_RECEIVED") {
        return {
          success: false,
          error: "The refund owed cannot be more than the amount received.",
          errorCode: "EXCEEDS_RECEIVED",
        };
      }
      if (err.message === "REASON_REQUIRED") {
        return {
          success: false,
          error:
            "Say why the refund owed is lower than the amount received (at least 5 characters).",
          errorCode: "REASON_REQUIRED",
        };
      }
      if (err.message === "BELOW_REFUNDED") {
        return {
          success: false,
          error:
            "The refund owed cannot be lower than what has already been refunded.",
          errorCode: "BELOW_REFUNDED",
        };
      }
      if ((err as { code?: string }).code === "P2034") {
        return {
          success: false,
          error: "This order changed since you opened it. Reload the page.",
          errorCode: "STATUS_CHANGED",
        };
      }
    }
    console.error("[recordOrderReturnAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type AddRefundDueErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NOTHING_RECEIVED"
  | "INVALID_STATUS"
  | "BALANCE_CHANGED"
  | "EXCEEDS_RECEIVED"
  | "INTERNAL_ERROR";

export type AddRefundDueResult =
  | { success: true }
  | { success: false; error: string; errorCode: AddRefundDueErrorCode };

export async function addOrderRefundDueAction(
  input: unknown,
): Promise<AddRefundDueResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = addRefundDueSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const { orderId, expectedRefundDue, amount, reason } = parsed.data;

    await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true, refundDue: true },
        });

        if (!current) throw new Error("NOT_FOUND");

        const received = await orderReceived(tx, orderId);
        if (received <= 0) throw new Error("NOTHING_RECEIVED");
        if (current.status === "PAYMENT_PENDING") {
          throw new Error("INVALID_STATUS");
        }

        const refundDueBefore = roundMoney(Number(current.refundDue));
        if (refundDueBefore !== roundMoney(expectedRefundDue)) {
          throw new Error("BALANCE_CHANGED");
        }

        const refundDueAfter = roundMoney(refundDueBefore + roundMoney(amount));
        if (refundDueAfter > received) throw new Error("EXCEEDS_RECEIVED");

        await tx.order.update({
          where: { id: orderId },
          data: { refundDue: refundDueAfter },
        });

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: current.status,
            note: reason,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "refund_due",
              amount: roundMoney(amount),
              refundDue: refundDueAfter,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.refund_due_added",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              amount: roundMoney(amount),
              refundDueBefore,
              refundDueAfter,
              reason,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Order not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "NOTHING_RECEIVED") {
        return {
          success: false,
          error: "No payment has been received on this order.",
          errorCode: "NOTHING_RECEIVED",
        };
      }
      if (err.message === "INVALID_STATUS") {
        return {
          success: false,
          error: "This order is still waiting on an online payment.",
          errorCode: "INVALID_STATUS",
        };
      }
      if (err.message === "BALANCE_CHANGED") {
        return {
          success: false,
          error: "The refund owed changed. Reload the page and try again.",
          errorCode: "BALANCE_CHANGED",
        };
      }
      if (err.message === "EXCEEDS_RECEIVED") {
        return {
          success: false,
          error: "The refund owed cannot be more than the amount received.",
          errorCode: "EXCEEDS_RECEIVED",
        };
      }
      if ((err as { code?: string }).code === "P2034") {
        return {
          success: false,
          error: "The refund owed changed. Reload the page and try again.",
          errorCode: "BALANCE_CHANGED",
        };
      }
    }
    console.error("[addOrderRefundDueAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type RecordOrderRefundErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "MISSING_PROOF"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "BALANCE_CHANGED"
  | "OVER_REFUND"
  | "DUPLICATE_REFERENCE"
  | "INVALID_DATE"
  | "RECORDING_IN_PROGRESS"
  | "MISSING_METHOD_LABEL"
  | "INTERNAL_ERROR";

export type RecordOrderRefundResult =
  | { success: true; data: { owedAfter: number } }
  | { success: false; error: string; errorCode: RecordOrderRefundErrorCode };

export async function recordOrderRefundAction(
  formData: unknown,
): Promise<RecordOrderRefundResult> {
  const staff = await requireStaffAction("order:mark_paid");

  let uploadedKey: string | null = null;

  try {
    if (!(formData instanceof FormData)) {
      return {
        success: false,
        error: "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const parsed = recordRefundSchema.safeParse({
      orderId: formData.get("orderId"),
      method: formData.get("method"),
      externalReference: formData.get("externalReference"),
      amount: formData.get("amount"),
      refundedAt: formData.get("refundedAt"),
      expectedOwed: formData.get("expectedOwed"),
      notes: formData.get("notes") ?? undefined,
      acknowledged: formData.get("acknowledged") === "true",
      methodOtherLabel: formData.get("methodOtherLabel") ?? undefined,
    });

    if (!parsed.success) {
      if (
        parsed.error.issues.some((i) => i.message === "MISSING_METHOD_LABEL")
      ) {
        return {
          success: false,
          error: "Describe the refund method when recording an Other refund.",
          errorCode: "MISSING_METHOD_LABEL",
        };
      }
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const {
      orderId,
      method,
      externalReference,
      amount,
      refundedAt,
      expectedOwed,
      notes,
      methodOtherLabel,
    } = parsed.data;

    let proofFilename: string = DEMO_PLACEHOLDER_DOCUMENT.filename;
    let proofMimeType: string = DEMO_PLACEHOLDER_DOCUMENT.mimeType;
    let storageKey: string = DEMO_PLACEHOLDER_DOCUMENT.key;

    const proofInput = formData.get("proof");
    if (isDemoMode() && proofInput instanceof File && proofInput.size > 0) {
      return {
        success: false,
        error: DEMO_UPLOAD_MESSAGE,
        errorCode: "UPLOAD_FAILED",
      };
    }

    if (!isDemoMode()) {
      const proof = formData.get("proof");
      if (!(proof instanceof File) || proof.size === 0) {
        return {
          success: false,
          error: "A proof of refund document is required.",
          errorCode: "MISSING_PROOF",
        };
      }

      if (proof.size > MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: "The proof file exceeds the 5 MB size limit.",
          errorCode: "FILE_TOO_LARGE",
        };
      }

      const detectedMime = await detectMimeType(proof);
      if (detectedMime === null || detectedMime !== proof.type) {
        return {
          success: false,
          error: "The proof file type is unsupported. Allowed: JPEG, PNG, PDF.",
          errorCode: "INVALID_FILE_TYPE",
        };
      }

      const recordedAt = new Date();
      const filename = sanitizeProofFilename(proof.name);
      const path = `refunds/${orderId}/${recordedAt.getTime()}/${filename}`;

      try {
        const uploaded = await uploadFile({
          bucket: PAYMENT_PROOFS_BUCKET,
          path,
          file: proof,
          contentType: detectedMime,
        });
        uploadedKey = uploaded.storageKey;
      } catch (err) {
        console.error("[recordOrderRefundAction] upload failed", err);
        return {
          success: false,
          error: "Failed to upload the proof document. Please try again.",
          errorCode: "UPLOAD_FAILED",
        };
      }
      proofFilename = proof.name;
      proofMimeType = detectedMime;
      storageKey = uploadedKey;
    }

    const owedAfter = await db.$transaction(
      async (tx) => {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true, refundDue: true, createdAt: true },
        });

        if (!current) throw new Error("NOT_FOUND");

        const existing = await tx.orderRefund.findMany({
          where: { orderId },
          select: { amount: true, externalReference: true },
        });

        const refunded = sumMoney(existing.map((r) => Number(r.amount)));
        const owed = roundMoney(roundMoney(Number(current.refundDue)) - refunded);

        if (owed !== roundMoney(expectedOwed)) {
          throw new Error("BALANCE_CHANGED");
        }

        if (roundMoney(amount) > owed) throw new Error("OVER_REFUND");

        if (
          existing.some(
            (r) =>
              r.externalReference.toLowerCase() ===
              externalReference.toLowerCase(),
          )
        ) {
          throw new Error("DUPLICATE_REFERENCE");
        }

        if (
          dubaiDay(refundedAt) > dubaiDay(new Date()) ||
          dubaiDay(refundedAt) < dubaiDay(current.createdAt)
        ) {
          throw new Error("INVALID_DATE");
        }

        await tx.orderRefund.create({
          data: {
            orderId,
            method,
            methodOtherLabel: methodOtherLabel ?? null,
            externalReference,
            amount: new Prisma.Decimal(roundMoney(amount).toFixed(2)),
            refundedAt,
            recordedById: staff.id,
            notes: notes?.trim() || null,
            filename: proofFilename,
            storageKey,
            mimeType: proofMimeType,
          },
        });

        const remaining = roundMoney(owed - roundMoney(amount));

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "STAFF",
            staffId: staff.id,
            fromStatus: null,
            toStatus: current.status,
            note: null,
            trackingNumber: null,
            trackingUrl: null,
            rawPayload: {
              source: "refund",
              method,
              methodOtherLabel: methodOtherLabel ?? null,
              externalReference,
              amount: roundMoney(amount),
              owedAfter: remaining,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "order.refund_recorded",
            entityType: "Order",
            entityId: orderId,
            metadata: {
              method,
              methodOtherLabel: methodOtherLabel ?? null,
              externalReference,
              amount: roundMoney(amount),
              refundedAt: dubaiDay(refundedAt),
              owedAfter: remaining,
              storageKey,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return remaining;
      },
      { isolationLevel: "Serializable" },
    );

    after(async () => {
      const data = await loadOrderEmailData(orderId);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "order_refunded",
        toEmail: data.customerEmail,
        locale: "en",
        orderId,
        payload: {
          orderNumber: data.orderNumber,
          amount: formatAED(roundMoney(amount)),
        },
        chromeOptions: customerOrderChrome(data, {
          badge: { text: "Refunded", tone: "success" },
          infoRows: [
            { label: "Order", value: data.orderNumber },
            { label: "Refund", value: formatAED(roundMoney(amount)) },
            {
              label: "Method",
              value:
                method === "OTHER" && methodOtherLabel
                  ? methodOtherLabel
                  : REFUND_METHOD_LABELS[method],
            },
            { label: "Refunded on", value: emailDate(refundedAt) },
            ...(owedAfter > 0
              ? [{ label: "Still to come", value: formatAED(owedAfter) }]
              : []),
          ],
        }),
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return { success: true, data: { owedAfter } };
  } catch (err) {
    if (uploadedKey !== null) {
      try {
        await deleteFile(PAYMENT_PROOFS_BUCKET, uploadedKey);
      } catch (cleanupErr) {
        console.error(
          "[recordOrderRefundAction] rollback cleanup failed",
          cleanupErr,
        );
      }
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success: false,
        error: "A refund with this reference is already recorded on this order.",
        errorCode: "DUPLICATE_REFERENCE",
      };
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      return {
        success: false,
        error:
          "Another refund is being recorded against this order. Reload and check the refund history before recording again.",
        errorCode: "RECORDING_IN_PROGRESS",
      };
    }

    if (err instanceof Error) {
      switch (err.message) {
        case "NOT_FOUND":
          return {
            success: false,
            error: "Order not found.",
            errorCode: "NOT_FOUND",
          };
        case "BALANCE_CHANGED":
          return {
            success: false,
            error: "The refund owed changed. Reload and try again.",
            errorCode: "BALANCE_CHANGED",
          };
        case "OVER_REFUND":
          return {
            success: false,
            error: "The amount exceeds the refund still owed.",
            errorCode: "OVER_REFUND",
          };
        case "DUPLICATE_REFERENCE":
          return {
            success: false,
            error:
              "A refund with this reference is already recorded on this order.",
            errorCode: "DUPLICATE_REFERENCE",
          };
        case "INVALID_DATE":
          return {
            success: false,
            error:
              "The refund date cannot be in the future or before the order was placed.",
            errorCode: "INVALID_DATE",
          };
      }
    }

    console.error("[recordOrderRefundAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
