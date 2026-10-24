"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { getPaymentProvider } from "@/lib/services/payment";

export type SubmitMockPaymentErrorCode =
  | "UNAUTHENTICATED"
  | "ORDER_NOT_FOUND"
  | "INVALID_STATE"
  | "NOT_MOCK"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type SubmitMockPaymentResult =
  | {
      success: true;
      data: { outcome: "SUCCESS" | "DECLINED"; redirectUrl: string | null };
    }
  | { success: false; error: string; errorCode: SubmitMockPaymentErrorCode };

const submitMockPaymentSchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["SUCCESS", "DECLINED"]),
  locale: z.enum(["en", "ar", "ru"]),
});

const STATE_CHANGED = "MOCK_PAYMENT_STATE_CHANGED";

export async function submitMockPaymentAction(
  input: unknown,
): Promise<SubmitMockPaymentResult> {
  try {
    const parsed = submitMockPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid request.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const { orderId, outcome, locale } = parsed.data;

    const session = await auth();
    const customerId = await getSessionCustomerId();
    if (session?.user?.principal !== "customer" || !customerId) {
      return {
        success: false,
        error: "Please sign in to continue.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    if (getPaymentProvider().name !== "mock") {
      return {
        success: false,
        error: "Sandbox payment is not available.",
        errorCode: "NOT_MOCK",
      };
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        status: true,
        nGeniusOrderRef: true,
      },
    });

    if (!order || order.customerId !== customerId) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "ORDER_NOT_FOUND",
      };
    }

    if (
      order.status !== "PAYMENT_PENDING" ||
      !order.nGeniusOrderRef ||
      !order.nGeniusOrderRef.startsWith("mock_")
    ) {
      return {
        success: false,
        error: "This order can no longer be paid here.",
        errorCode: "INVALID_STATE",
      };
    }

    const providerOrderId = order.nGeniusOrderRef;
    const payRef =
      outcome === "DECLINED"
        ? `mock_pay_declined_${randomUUID()}`
        : `mock_pay_${randomUUID()}`;

    await db.$transaction(
      async (tx) => {
        const fresh = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true, total: true },
        });

        if (!fresh || fresh.status !== "PAYMENT_PENDING") {
          throw new Error(STATE_CHANGED);
        }

        await tx.order.update({
          where: { id: orderId },
          data: { nGeniusPayRef: payRef },
        });

        const openTransaction = await tx.paymentTransaction.findFirst({
          where: {
            orderId,
            providerOrderId,
            status: { in: ["INITIATED", "PENDING"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (openTransaction) {
          await tx.paymentTransaction.update({
            where: { id: openTransaction.id },
            data: {
              providerPaymentId: payRef,
              status: outcome === "DECLINED" ? "FAILED" : "PENDING",
              amount: fresh.total,
              failureCode: outcome === "DECLINED" ? "MOCK_DECLINED" : null,
              failureMessage:
                outcome === "DECLINED"
                  ? "Simulated decline (sandbox test card)"
                  : null,
              rawResponse: {
                outcome,
                _provider: "mock",
                _simulatedAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
          });
        } else {
          await tx.paymentTransaction.create({
            data: {
              orderId,
              provider: "NGENIUS",
              providerOrderId,
              providerPaymentId: payRef,
              status: outcome === "DECLINED" ? "FAILED" : "PENDING",
              amount: fresh.total,
              failureCode: outcome === "DECLINED" ? "MOCK_DECLINED" : null,
              failureMessage:
                outcome === "DECLINED"
                  ? "Simulated decline (sandbox test card)"
                  : null,
              rawResponse: {
                outcome,
                _provider: "mock",
                _simulatedAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
          });
        }

        await tx.orderEvent.create({
          data: {
            orderId,
            actor: "CUSTOMER",
            fromStatus: "PAYMENT_PENDING",
            toStatus: "PAYMENT_PENDING",
            rawPayload: {
              event: "mock_payment_submitted",
              outcome,
              providerPaymentId: payRef,
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return {
      success: true,
      data: {
        outcome,
        redirectUrl:
          outcome === "SUCCESS"
            ? `/${locale}/checkout/success?orderId=${orderId}`
            : null,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message === STATE_CHANGED) {
      return {
        success: false,
        error: "This order can no longer be paid here.",
        errorCode: "INVALID_STATE",
      };
    }
    console.error("[submitMockPaymentAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
