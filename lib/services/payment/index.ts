// Payment provider factory — env-driven selection with safe dev fallback.

import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock-provider";
import {
  NGeniusPaymentProvider,
  NGeniusNotConfiguredError,
} from "./ngenius-provider";
import { env } from "@/lib/env";

export { NGeniusNotConfiguredError };
export type {
  PaymentProvider,
  PaymentProviderName,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "./types";

export function getPaymentProvider(): PaymentProvider {
  const providerName = env.PAYMENT_PROVIDER ?? "mock";

  if (providerName === "ngenius") {
    const apiKey = env.NGENIUS_API_KEY;
    const outletRef = env.NGENIUS_OUTLET_REF;
    const baseUrl = env.NGENIUS_BASE_URL;
    const allConfigured = Boolean(apiKey && outletRef && baseUrl);

    if (!allConfigured) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[payment] PAYMENT_PROVIDER=ngenius but one or more of NGENIUS_API_KEY, " +
            "NGENIUS_OUTLET_REF, NGENIUS_BASE_URL is missing. " +
            "Falling back to mock provider.",
        );
        return new MockPaymentProvider();
      }
      throw new NGeniusNotConfiguredError();
    }

    return new NGeniusPaymentProvider();
  }

  return new MockPaymentProvider();
}
