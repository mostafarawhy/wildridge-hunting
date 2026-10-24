import "server-only";

import { after } from "next/server";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import type { OrderStatus } from "@/app/generated/prisma/client";
import { getPaymentProvider } from "@/lib/services/payment";
import type { VerifyPaymentResult } from "@/lib/services/payment";
import { getSetting } from "@/lib/db/queries/settings";
import { returnOrderPoints } from "@/lib/services/loyalty";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadOrderEmailData,
  orderBaseRows,
  customerOrderChrome,
  staffOrderChrome,
} from "@/lib/email/order-email";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { archiveOrderComplianceDocuments } from "@/lib/services/compliance-archive";

const GATEWAY_TIMEOUT_MS = 15_000;

export class GatewayUnavailableError extends Error {
  constructor() {
    super("The payment gateway is unavailable");
    this.name = "GatewayUnavailableError";
  }
}

export async function checkCardPayment(ref: {
  providerOrderId: string;
  providerPaymentId: string | null;
}): Promise<VerifyPaymentResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const provider = getPaymentProvider();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new GatewayUnavailableError()),
        GATEWAY_TIMEOUT_MS,
      );
    });
    return await Promise.race([
      provider.verifyPayment({
        providerOrderId: ref.providerOrderId,
        providerPaymentId: ref.providerPaymentId ?? undefined,
      }),
      timeout,
    ]);
  } catch {
    throw new GatewayUnavailableError();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type CardPaymentActor =
  | { kind: "SYSTEM" }
  | { kind: "STAFF"; staffId: string };

interface TxOutcome {
  status: OrderStatus;
  moved: boolean;
}

export async function settleCardPayment(
  orderId: string,
  result: VerifyPaymentResult,
  actor: CardPaymentActor,
): Promise<OrderStatus> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        status: true,
        nGeniusOrderRef: true,
        items: {
          select: {
            id: true,
            itemType: true,
            productSku: true,
            addonId: true,
            quantity: true,
          },
        },
        convertedFromQuote: { select: { id: true } },
      },
    });

    if (!order) throw new Error("NOT_FOUND");

    const stockAdjustableItems = order.convertedFromQuote ? [] : order.items;

    const eventActor =
      actor.kind === "STAFF"
        ? ({ actor: "STAFF", staffId: actor.staffId } as const)
        : ({ actor: "SYSTEM" } as const);

    if (
      result.success &&
      (result.status === "CAPTURED" || result.status === "AUTHORIZED")
    ) {
      const outcome: TxOutcome = await db.$transaction(
        async (tx) => {
          const fresh = await tx.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          });
          if (!fresh) throw new Error("NOT_FOUND");
          if (fresh.status !== "PAYMENT_PENDING") {
            return { status: fresh.status, moved: false };
          }

          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID", paidAt: new Date() },
          });

          if (order.nGeniusOrderRef) {
            await tx.paymentTransaction.updateMany({
              where: {
                orderId,
                providerOrderId: order.nGeniusOrderRef,
                status: { in: ["INITIATED", "PENDING"] },
              },
              data: {
                status: result.status,
                providerPaymentId: result.providerPaymentId,
              },
            });
          }

          for (const item of stockAdjustableItems) {
            if (item.itemType === "PRODUCT" && item.productSku) {
              await tx.product.update({
                where: { sku: item.productSku },
                data: { reservedQuantity: { decrement: item.quantity } },
              });
            } else if (item.itemType === "ADDON" && item.addonId) {
              await tx.product.update({
                where: { sku: item.addonId },
                data: { reservedQuantity: { decrement: item.quantity } },
              });
            }
          }

          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              ...eventActor,
              fromStatus: "PAYMENT_PENDING",
              toStatus: "PAID",
              rawPayload: {
                providerStatus: result.status,
                providerPaymentId: result.providerPaymentId,
              },
            },
          });

          if (actor.kind === "STAFF") {
            await tx.auditLog.create({
              data: {
                actorType: "STAFF",
                actorId: actor.staffId,
                action: "order.payment_checked",
                entityType: "Order",
                entityId: orderId,
                metadata: {
                  gatewayStatus: result.status,
                  fromStatus: "PAYMENT_PENDING",
                  toStatus: "PAID",
                },
              },
            });
          }

          return { status: "PAID", moved: true };
        },
        { isolationLevel: "Serializable" },
      );

      if (!outcome.moved) return outcome.status;

      after(async () => {
        await archiveOrderComplianceDocuments(order.id);
        const { orders: orderRecipients } = await getSetting("email_recipients");
        const data = await loadOrderEmailData(order.id);
        if (!data) return;
        const paidBadge = { text: ORDER_STATUS_LABELS.PAID, tone: "success" as const };
        await logAndSendEmail({
          templateKey: "order_paid",
          toEmail: data.customerEmail,
          orderId: data.id,
          payload: { orderNumber: data.orderNumber },
          chromeOptions: customerOrderChrome(data, {
            badge: paidBadge,
            infoRows: [...orderBaseRows(data), { label: "Payment", value: "Card" }],
            withSummary: true,
            withAddress: true,
          }),
        });
        for (const toEmail of orderRecipients) {
          await logAndSendEmail({
            templateKey: "order_received_staff",
            toEmail,
            orderId: data.id,
            payload: { orderNumber: data.orderNumber },
            chromeOptions: staffOrderChrome(data, {
              badge: paidBadge,
              extraRows: [{ label: "Payment", value: "Card, captured" }],
            }),
          });
        }
      });

      return "PAID";
    }

    if (!result.success && result.status === "PENDING") {
      const outcome: TxOutcome = await db.$transaction(
        async (tx) => {
          const fresh = await tx.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          });
          if (!fresh) throw new Error("NOT_FOUND");
          if (fresh.status !== "PAYMENT_PENDING") {
            return { status: fresh.status, moved: false };
          }

          if (order.nGeniusOrderRef) {
            await tx.paymentTransaction.updateMany({
              where: {
                orderId,
                providerOrderId: order.nGeniusOrderRef,
                status: { in: ["INITIATED", "PENDING"] },
              },
              data: {
                status: result.status,
                failureCode: result.errorCode ?? null,
                failureMessage: result.errorMessage ?? null,
              },
            });
          }

          if (actor.kind === "STAFF") {
            await tx.auditLog.create({
              data: {
                actorType: "STAFF",
                actorId: actor.staffId,
                action: "order.payment_checked",
                entityType: "Order",
                entityId: orderId,
                metadata: {
                  gatewayStatus: result.status,
                  fromStatus: "PAYMENT_PENDING",
                  toStatus: "PAYMENT_PENDING",
                },
              },
            });
          }

          return { status: "PAYMENT_PENDING", moved: false };
        },
        { isolationLevel: "Serializable" },
      );

      return outcome.status;
    }

    const outcome: TxOutcome = await db.$transaction(
      async (tx) => {
        const fresh = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true },
        });
        if (!fresh) throw new Error("NOT_FOUND");
        if (fresh.status !== "PAYMENT_PENDING") {
          return { status: fresh.status, moved: false };
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAYMENT_FAILED" },
        });

        if (order.nGeniusOrderRef && !result.success) {
          await tx.paymentTransaction.updateMany({
            where: {
              orderId,
              providerOrderId: order.nGeniusOrderRef,
              status: { in: ["INITIATED", "PENDING"] },
            },
            data: {
              status: result.status,
              failureCode: result.errorCode ?? null,
              failureMessage: result.errorMessage ?? null,
            },
          });
        }

        await returnOrderPoints(tx, { customerId: order.customerId, orderId: order.id });

        for (const item of stockAdjustableItems) {
          if (item.itemType === "PRODUCT" && item.productSku) {
            const productSnap = await tx.product.findUnique({
              where: { sku: item.productSku },
              select: { stockQuantity: true },
            });
            const before = productSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.productSku },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.productSku,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: order.id,
                staffId: null,
                reason: "Payment failed",
              },
            });
          } else if (item.itemType === "ADDON" && item.addonId) {
            const addonSnap = await tx.product.findUnique({
              where: { sku: item.addonId },
              select: { stockQuantity: true },
            });
            const before = addonSnap?.stockQuantity ?? 0;

            await tx.product.update({
              where: { sku: item.addonId },
              data: {
                stockQuantity: { increment: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });

            await tx.stockMovement.create({
              data: {
                productSku: item.addonId,
                delta: item.quantity,
                quantityBefore: before,
                quantityAfter: before + item.quantity,
                type: "RETURN",
                reference: order.id,
                staffId: null,
                reason: "Payment failed",
              },
            });
          }
        }

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            ...eventActor,
            fromStatus: "PAYMENT_PENDING",
            toStatus: "PAYMENT_FAILED",
            rawPayload: {
              providerStatus: !result.success ? result.status : null,
              errorCode: !result.success ? (result.errorCode ?? null) : null,
              errorMessage: !result.success ? (result.errorMessage ?? null) : null,
            },
          },
        });

        if (actor.kind === "STAFF") {
          await tx.auditLog.create({
            data: {
              actorType: "STAFF",
              actorId: actor.staffId,
              action: "order.payment_checked",
              entityType: "Order",
              entityId: orderId,
              metadata: {
                gatewayStatus: result.status,
                fromStatus: "PAYMENT_PENDING",
                toStatus: "PAYMENT_FAILED",
              },
            },
          });
        }

        return { status: "PAYMENT_FAILED", moved: true };
      },
      { isolationLevel: "Serializable" },
    );

    if (!outcome.moved) return outcome.status;

    after(async () => {
      const data = await loadOrderEmailData(order.id);
      if (!data) return;
      await logAndSendEmail({
        templateKey: "payment_failed",
        toEmail: data.customerEmail,
        orderId: data.id,
        payload: { orderNumber: data.orderNumber },
        chromeOptions: customerOrderChrome(data, {
          badge: { text: ORDER_STATUS_LABELS.PAYMENT_FAILED, tone: "warning" },
          infoRows: orderBaseRows(data),
          withSummary: true,
          withAddress: false,
        }),
      });
    });

    return "PAYMENT_FAILED";
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      const fresh = await db.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (fresh && fresh.status !== "PAYMENT_PENDING") return fresh.status;
    }
    throw err;
  }
}
