"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db/client";
import { isKlaviyoConfigured, subscribeToKlaviyo } from "@/lib/services/klaviyo";
import { NewsletterSubscribeSchema } from "@/lib/validations/newsletter";

export type SubscribeNewsletterErrorCode = "INVALID_EMAIL" | "INTERNAL_ERROR";

export type SubscribeNewsletterResult =
  | { success: true }
  | { success: false; error: string; errorCode: SubscribeNewsletterErrorCode };

const LOCALES = ["en", "ar", "ru"] as const;

export async function subscribeNewsletterAction(
  input: unknown,
): Promise<SubscribeNewsletterResult> {
  const parsed = NewsletterSubscribeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "INVALID_EMAIL",
    };
  }

  if (parsed.data.website) {
    return { success: true };
  }

  const { email, source } = parsed.data;
  const requestLocale = await getLocale();
  const locale = LOCALES.find((l) => l === requestLocale) ?? "en";

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { unsubscribedAt: true, klaviyoSyncedAt: true },
    });
    const consentAt = new Date();

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email, locale, source, consentAt },
      update: {
        locale,
        consentAt,
        unsubscribedAt: null,
        klaviyoError: null,
        ...(existing?.unsubscribedAt ? { klaviyoSyncedAt: null } : {}),
      },
    });

    const shouldPush =
      !existing ||
      existing.unsubscribedAt !== null ||
      existing.klaviyoSyncedAt === null;

    if (shouldPush && isKlaviyoConfigured()) {
      after(async () => {
        try {
          const result = await subscribeToKlaviyo({ email, source });
          await db.newsletterSubscriber.update({
            where: { email },
            data: result.ok
              ? { klaviyoSyncedAt: new Date(), klaviyoError: null }
              : { klaviyoError: result.error },
          });
        } catch (err) {
          console.error("[subscribeNewsletterAction]", err);
        }
      });
    }

    return { success: true };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return { success: true };
    }

    console.error("[subscribeNewsletterAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
