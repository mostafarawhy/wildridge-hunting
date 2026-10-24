import { BRAND } from "@/lib/config/brand";
import { env } from "@/lib/env";

const KLAVIYO_REVISION = "2026-01-15";
const KLAVIYO_TIMEOUT_MS = 10_000;
const KLAVIYO_ERROR_MAX = 500;

export type KlaviyoSubscribeResult = { ok: true } | { ok: false; error: string };

export function isKlaviyoConfigured(): boolean {
  return Boolean(env.KLAVIYO_PRIVATE_API_KEY && env.KLAVIYO_LIST_ID);
}

export async function subscribeToKlaviyo(input: {
  email: string;
  source: "HOME" | "POPUP";
}): Promise<KlaviyoSubscribeResult> {
  return postSubscriptionJob({
    source: input.source,
    profiles: [{ email: input.email }],
    historicalImport: false,
  });
}

export const KLAVIYO_BULK_MAX = 1000;
export const KLAVIYO_HISTORICAL_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export async function importSubscribersToKlaviyo(input: {
  source: "HOME" | "POPUP";
  profiles: { email: string; consentAt: Date }[];
}): Promise<KlaviyoSubscribeResult> {
  if (input.profiles.length > KLAVIYO_BULK_MAX) {
    return { ok: false, error: "Too many subscribers in one import" };
  }
  return postSubscriptionJob({
    source: input.source,
    profiles: input.profiles,
    historicalImport: true,
  });
}

export async function subscribeEmailsToKlaviyo(input: {
  source: "HOME" | "POPUP";
  emails: string[];
}): Promise<KlaviyoSubscribeResult> {
  if (input.emails.length > KLAVIYO_BULK_MAX) {
    return { ok: false, error: "Too many subscribers in one import" };
  }
  return postSubscriptionJob({
    source: input.source,
    profiles: input.emails.map((email) => ({ email })),
    historicalImport: false,
  });
}

async function postSubscriptionJob(input: {
  source: "HOME" | "POPUP";
  profiles: { email: string; consentAt?: Date }[];
  historicalImport: boolean;
}): Promise<KlaviyoSubscribeResult> {
  const apiKey = env.KLAVIYO_PRIVATE_API_KEY;
  const listId = env.KLAVIYO_LIST_ID;
  if (!apiKey || !listId) {
    return { ok: false, error: "Klaviyo is not configured" };
  }

  const sourceLabel = input.source === "HOME" ? "homepage" : "popup";

  try {
    const response = await fetch(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs",
      {
        method: "POST",
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: KLAVIYO_REVISION,
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              custom_source: `${BRAND.name} website (${sourceLabel})`,
              ...(input.historicalImport ? { historical_import: true } : {}),
              profiles: {
                data: input.profiles.map((p) => ({
                  type: "profile",
                  attributes: {
                    email: p.email,
                    subscriptions: {
                      email: {
                        marketing: {
                          consent: "SUBSCRIBED",
                          ...(p.consentAt
                            ? { consented_at: p.consentAt.toISOString() }
                            : {}),
                        },
                      },
                    },
                  },
                })),
              },
            },
            relationships: {
              list: { data: { type: "list", id: listId } },
            },
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(KLAVIYO_TIMEOUT_MS),
      },
    );

    if (response.ok) return { ok: true };

    let detail = response.statusText;
    try {
      const body = (await response.json()) as {
        errors?: Array<{ detail?: unknown }>;
      };
      const first = body.errors?.[0]?.detail;
      if (typeof first === "string" && first.length > 0) detail = first;
    } catch {}

    return {
      ok: false,
      error: `HTTP ${response.status}: ${detail}`.slice(0, KLAVIYO_ERROR_MAX),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return { ok: false, error: message.slice(0, KLAVIYO_ERROR_MAX) };
  }
}
