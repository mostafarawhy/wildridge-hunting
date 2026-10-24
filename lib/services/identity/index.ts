// Identity provider factory — env-driven selection with safe dev fallback.

import type { IdentityProvider } from "./types";
import { ManualReviewProvider } from "./manual-provider";
import {
  UaePassProvider,
  UaePassNotConfiguredError,
} from "./uae-pass-provider";
import { env } from "@/lib/env";

export { UaePassNotConfiguredError };
export type {
  IdentityProvider,
  IdentityProviderName,
  InitiateVerificationInput,
  InitiateVerificationResult,
  CheckVerificationInput,
  CheckVerificationResult,
} from "./types";

export function getIdentityProvider(): IdentityProvider {
  const providerName = env.IDENTITY_PROVIDER ?? "manual";

  if (providerName === "uae_pass") {
    const clientId = env.UAE_PASS_CLIENT_ID;
    const clientSecret = env.UAE_PASS_CLIENT_SECRET;
    const baseUrl = env.UAE_PASS_BASE_URL;
    const redirectUri = env.UAE_PASS_REDIRECT_URI;
    const allConfigured = Boolean(
      clientId && clientSecret && baseUrl && redirectUri,
    );

    if (!allConfigured) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[identity] IDENTITY_PROVIDER=uae_pass but one or more of UAE_PASS_CLIENT_ID, " +
            "UAE_PASS_CLIENT_SECRET, UAE_PASS_BASE_URL, UAE_PASS_REDIRECT_URI is missing. " +
            "Falling back to manual provider.",
        );
        return new ManualReviewProvider();
      }
      throw new UaePassNotConfiguredError();
    }

    return new UaePassProvider();
  }

  return new ManualReviewProvider();
}
