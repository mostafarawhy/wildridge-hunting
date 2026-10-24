// Manual review identity provider — admin-approved document upload flow.

import type {
  IdentityProvider,
  IdentityProviderName,
  InitiateVerificationInput,
  InitiateVerificationResult,
  CheckVerificationInput,
  CheckVerificationResult,
} from "./types";

export class ManualReviewProvider implements IdentityProvider {
  readonly name: IdentityProviderName = "manual" as const;

  async initiateVerification(
    input: InitiateVerificationInput,
  ): Promise<InitiateVerificationResult> {
    const applicantId = `manual_${input.customerId}_${Date.now()}`;

    return {
      success: true,
      applicantId,
      // No redirectUrl — upload happens on /account/verification.
      rawResponse: null,
    };
  }

  async checkVerification(
    input: CheckVerificationInput,
  ): Promise<CheckVerificationResult> {
    // Status is updated by admin action, not polled.
    return {
      success: true,
      status: "PENDING",
      applicantId: input.applicantId,
      rawResponse: null,
    };
  }
}
