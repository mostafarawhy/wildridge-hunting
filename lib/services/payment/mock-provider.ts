// Mock payment provider — dev/staging fallback when N-Genius keys absent.

import { randomUUID } from "node:crypto";
import type {
  PaymentProvider,
  PaymentProviderName,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "./types";

export class MockPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = "mock";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerOrderId = `mock_${randomUUID()}`;
    const redirectUrl = `${new URL(input.returnUrl).origin}/${input.locale}/checkout/pay?orderId=${input.orderId}`;

    return {
      success: true,
      providerOrderId,
      redirectUrl,
      rawResponse: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        amount: input.amount,
        currency: input.currency,
        _provider: "mock",
        _simulatedAt: new Date().toISOString(),
      },
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.providerOrderId.startsWith("mock_")) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "INVALID_REF",
        errorMessage: "Provider order ID does not match mock prefix",
        rawResponse: {
          providerOrderId: input.providerOrderId,
          _provider: "mock",
          _simulatedAt: new Date().toISOString(),
        },
      };
    }

    if (!input.providerPaymentId) {
      return {
        success: false,
        status: "PENDING",
        errorCode: "MOCK_NOT_SUBMITTED",
        errorMessage: "No sandbox payment has been submitted for this order",
        rawResponse: {
          providerOrderId: input.providerOrderId,
          _provider: "mock",
          _simulatedAt: new Date().toISOString(),
        },
      };
    }

    if (input.providerPaymentId.startsWith("mock_pay_declined_")) {
      return {
        success: false,
        status: "FAILED",
        errorCode: "MOCK_DECLINED",
        errorMessage: "Simulated decline (sandbox test card)",
        rawResponse: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
          _provider: "mock",
          _simulatedAt: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      status: "CAPTURED",
      amount: 0,
      providerPaymentId: input.providerPaymentId,
      rawResponse: {
        providerOrderId: input.providerOrderId,
        _provider: "mock",
        _simulatedAt: new Date().toISOString(),
      },
    };
  }
}
