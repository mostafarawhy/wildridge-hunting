"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { checkOrderPaymentSchema } from "@/lib/validations/order";
import {
  checkCardPayment,
  settleCardPayment,
  GatewayUnavailableError,
} from "@/lib/services/card-payment";
import type { OrderStatus } from "@/app/generated/prisma/client";

export type CheckOrderPaymentErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "STATUS_CHANGED"
  | "NO_GATEWAY_REFERENCE"
  | "GATEWAY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type CheckOrderPaymentResult =
  | {
      success: true;
      data: { status: OrderStatus; gatewayStatus: string };
    }
  | { success: false; error: string; errorCode: CheckOrderPaymentErrorCode };

export async function checkOrderPaymentAction(
  input: unknown,
): Promise<CheckOrderPaymentResult> {
  const staff = await requireStaffAction("order:update");

  try {
    const parsed = checkOrderPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const { orderId } = parsed.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        nGeniusOrderRef: true,
        nGeniusPayRef: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: "Order not found.",
        errorCode: "NOT_FOUND",
      };
    }

    if (order.status !== "PAYMENT_PENDING") {
      return {
        success: false,
        error: "This order changed since you opened it. Reload the page.",
        errorCode: "STATUS_CHANGED",
      };
    }

    if (!order.nGeniusOrderRef) {
      return {
        success: false,
        error: "This order has no payment with the gateway to check.",
        errorCode: "NO_GATEWAY_REFERENCE",
      };
    }

    let result: Awaited<ReturnType<typeof checkCardPayment>>;
    try {
      result = await checkCardPayment({
        providerOrderId: order.nGeniusOrderRef,
        providerPaymentId: order.nGeniusPayRef,
      });
    } catch (err) {
      if (err instanceof GatewayUnavailableError) {
        return {
          success: false,
          error: "The payment gateway could not be reached. Try again.",
          errorCode: "GATEWAY_UNAVAILABLE",
        };
      }
      throw err;
    }

    const status = await settleCardPayment(orderId, result, {
      kind: "STAFF",
      staffId: staff.id,
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);

    return {
      success: true,
      data: { status, gatewayStatus: result.status },
    };
  } catch (err) {
    console.error("[checkOrderPaymentAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
