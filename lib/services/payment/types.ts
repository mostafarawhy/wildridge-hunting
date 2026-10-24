
export type PaymentProviderName = "mock" | "ngenius";

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: "AED";
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  locale: "en" | "ar" | "ru";
  metadata?: Record<string, string>;
}

export type CreatePaymentResult =
  | {
      success: true;
      providerOrderId: string;
      providerPaymentId?: string;
      redirectUrl: string;
      rawResponse: unknown;
    }
  | {
      success: false;
      errorCode: string;
      errorMessage: string;
      rawResponse?: unknown;
    };

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId?: string;
}

export type VerifyPaymentResult =
  | {
      success: true;
      status: "AUTHORIZED" | "CAPTURED";
      amount: number;
      providerPaymentId: string;
      rawResponse: unknown;
    }
  | {
      success: false;
      status: "PENDING" | "FAILED" | "CANCELLED";
      errorCode?: string;
      errorMessage?: string;
      rawResponse?: unknown;
    };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
