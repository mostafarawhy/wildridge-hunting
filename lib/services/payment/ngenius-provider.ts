// N-Genius payment provider — stub; the payment flow is not implemented yet.

import type {
  PaymentProvider,
  PaymentProviderName,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "./types";
import { env } from "@/lib/env";

export class NGeniusNotConfiguredError extends Error {
  constructor() {
    super(
      "N-Genius payment provider is not configured. Set NGENIUS_API_KEY, NGENIUS_OUTLET_REF, and NGENIUS_BASE_URL.",
    );
    this.name = "NGeniusNotConfiguredError";
  }
}

export class NGeniusPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = "ngenius";

  private readonly apiKey: string | undefined;
  private readonly outletRef: string | undefined;
  private readonly baseUrl: string | undefined;

  constructor() {
    this.apiKey = env.NGENIUS_API_KEY;
    this.outletRef = env.NGENIUS_OUTLET_REF;
    this.baseUrl = env.NGENIUS_BASE_URL;
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.outletRef && this.baseUrl);
  }

  async createPayment(
    _input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    // TODO: implement the N-Genius createPayment flow:
    // 1. POST to {baseUrl}/identity/auth/access-token with Authorization: Basic base64(apiKey:)
    //    to obtain a short-lived Bearer token.
    // 2. Convert amount to fils: amountInFils = Math.round(input.amount * 100).
    // 3. POST to {baseUrl}/transactions/outlets/{outletRef}/orders with:
    //    - Authorization: Bearer <token>
    //    - Body: { action: "PURCHASE", amount: { currencyCode: "AED", value: amountInFils },
    //             merchantAttributes: { redirectUrl: input.returnUrl, cancelUrl: ... },
    //             emailAddress: input.customerEmail, language: input.locale, ... }
    // 4. Response includes _id (use as providerOrderId) and _links.payment.href (use as redirectUrl).
    // 5. Store providerOrderId on the Order record before redirecting the customer.
    if (!this.isConfigured) {
      throw new NGeniusNotConfiguredError();
    }
    return {
      success: false,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "N-Genius integration is not configured",
    };
  }

  async verifyPayment(
    _input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> {
    // TODO: implement the N-Genius verifyPayment flow:
    // 1. POST to {baseUrl}/identity/auth/access-token to obtain a fresh Bearer token.
    // 2. GET {baseUrl}/transactions/outlets/{outletRef}/orders/{providerOrderId}
    //    with Authorization: Bearer <token>.
    // 3. Inspect _embedded.payment[0].state:
    //    - "CAPTURED"    → success: true, status: "CAPTURED"
    //    - "AUTHORISED"  → success: true, status: "AUTHORIZED"
    //    - "FAILED"      → success: false, status: "FAILED"
    //    - "CANCELLED"   → success: false, status: "CANCELLED"
    //    - anything else → success: false, status: "PENDING"
    // 4. Extract _embedded.payment[0]._id as providerPaymentId.
    // 5. Extract _embedded.payment[0].amount.value (fils) and divide by 100 for AED amount.
    if (!this.isConfigured) {
      throw new NGeniusNotConfiguredError();
    }
    return {
      success: false,
      status: "FAILED",
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "N-Genius integration is not configured",
    };
  }
}
