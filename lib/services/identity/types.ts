// Identity provider contracts.

export type IdentityProviderName = "manual" | "uae_pass";

export interface InitiateVerificationInput {
  customerId: string;
  customerEmail: string;
  customerName: string;
  locale: "en" | "ar" | "ru";
  redirectUrl: string;
  metadata?: Record<string, string>;
}

export type InitiateVerificationResult =
  | {
      success: true;
      applicantId: string;
      redirectUrl?: string;
      rawResponse: unknown;
    }
  | {
      success: false;
      errorCode: string;
      errorMessage: string;
      rawResponse?: unknown;
    };

export interface CheckVerificationInput {
  customerId: string;
  applicantId: string;
  /** OAuth authorization code from UAE Pass callback — required for uae_pass provider. */
  authorizationCode?: string;
}

export type CheckVerificationResult =
  | {
      success: true;
      status: "APPROVED" | "PENDING" | "REJECTED" | "EXPIRED";
      applicantId: string;
      rawResponse: unknown;
    }
  | {
      success: false;
      errorCode: string;
      errorMessage: string;
      rawResponse?: unknown;
    };

export interface IdentityProvider {
  readonly name: IdentityProviderName;
  initiateVerification(
    input: InitiateVerificationInput,
  ): Promise<InitiateVerificationResult>;
  checkVerification(
    input: CheckVerificationInput,
  ): Promise<CheckVerificationResult>;
}
