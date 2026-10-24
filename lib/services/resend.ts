import { BRAND } from "@/lib/config/brand";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/config/demo";
import { getSetting } from "@/lib/db/queries/settings";
import { getEmailTemplateOverride } from "@/lib/db/queries/email-template";
import * as emailChrome from "@/lib/email/chrome";
import { EMAIL_DEFAULTS, UNPAUSABLE_TEMPLATE_KEYS } from "@/lib/email/defaults";
import { escapeHtml } from "@/lib/email/escape";
import { emailChromeContext, isEmailLocale, type EmailLocale } from "@/lib/email/i18n";

interface SendEmailOptions {
  templateKey: string;
  toEmail: string;
  subject?: string;
  locale?: string;
  payload?:
    | Prisma.InputJsonValue
    | ((ctx: emailChrome.EmailChromeContext) => Prisma.InputJsonValue);
  orderId?: string;
  quoteRequestId?: string;
  html?: string;
  chromeOptions?:
    | emailChrome.EmailChromeOptions
    | ((ctx: emailChrome.EmailChromeContext) => emailChrome.EmailChromeOptions);
}

export async function logAndSendEmail(
  options: SendEmailOptions,
): Promise<void> {
  const {
    templateKey,
    toEmail,
    subject,
    locale,
    payload,
    orderId,
    quoteRequestId,
    html,
    chromeOptions,
  } = options;

  const requestedLocale: EmailLocale =
    locale && isEmailLocale(locale) ? locale : "en";

  let enRow: Awaited<ReturnType<typeof getEmailTemplateOverride>> = null;
  let localeRow: Awaited<ReturnType<typeof getEmailTemplateOverride>> = null;
  try {
    [enRow, localeRow] = await Promise.all([
      getEmailTemplateOverride(templateKey, "en"),
      requestedLocale === "en"
        ? Promise.resolve(null)
        : getEmailTemplateOverride(templateKey, requestedLocale),
    ]);
  } catch (err) {
    console.error("[logAndSendEmail] Failed to load email template override:", err);
  }

  if (enRow && enRow.enabled === false && !UNPAUSABLE_TEMPLATE_KEYS.has(templateKey)) {
    console.info("[logAndSendEmail] paused:", templateKey);
    return;
  }

  const resendApiKey = env.RESEND_API_KEY;

  const emailDefault = EMAIL_DEFAULTS[templateKey];

  const localeReady =
    (chromeOptions === undefined || typeof chromeOptions === "function") &&
    (payload === undefined || typeof payload === "function");
  const localeBody = localeRow?.bodyParagraphs;
  const localeAuthored =
    !html &&
    localeReady &&
    Boolean(localeRow?.subject?.trim()) &&
    Array.isArray(localeBody) &&
    localeBody.length > 0 &&
    localeBody.every((p) => typeof p === "string" && p.trim() !== "") &&
    (!emailDefault?.ctaLabel || Boolean(localeRow?.ctaLabel?.trim()));
  const override = localeAuthored ? localeRow : enRow;
  const resolvedLocale: EmailLocale = localeAuthored ? requestedLocale : "en";
  const localeContext: emailChrome.EmailChromeContext =
    emailChromeContext(resolvedLocale);
  const resolvedPayload =
    typeof payload === "function" ? payload(localeContext) : payload;
  const resolvedChrome =
    typeof chromeOptions === "function" ? chromeOptions(localeContext) : chromeOptions;

  const overrideParagraphs =
    Array.isArray(override?.bodyParagraphs) &&
    (override.bodyParagraphs as unknown[]).every((p) => typeof p === "string")
      ? (override.bodyParagraphs as unknown as string[])
      : null;

  let resolvedHtml: string | undefined;
  let bodyFailureReason: string | undefined;
  if (html) {
    resolvedHtml = html;
  } else if (overrideParagraphs) {
    resolvedHtml = emailChrome.renderParagraphs(
      overrideParagraphs,
      (resolvedPayload ?? {}) as Record<string, unknown>,
    );
  } else if (emailDefault) {
    resolvedHtml = emailChrome.renderEmailBody(
      emailDefault.body,
      (resolvedPayload ?? {}) as Record<string, unknown>,
    );
  } else {
    bodyFailureReason = `No email body for template ${templateKey}`;
  }

  let resolvedSubject: string;
  if (override?.subject) {
    resolvedSubject = emailChrome.renderEmailSubject(
      override.subject,
      (resolvedPayload ?? {}) as Record<string, unknown>,
    );
  } else if (subject) {
    resolvedSubject = subject;
  } else if (emailDefault) {
    resolvedSubject = emailChrome.renderEmailSubject(
      emailDefault.subject,
      (resolvedPayload ?? {}) as Record<string, unknown>,
    );
  } else {
    resolvedSubject = templateKey;
  }

  const simulated = isDemoMode() && !bodyFailureReason;
  const failureReason =
    bodyFailureReason ??
    (!simulated && !resendApiKey ? "RESEND_API_KEY is not configured" : undefined);

  let logId: string | null = null;

  try {
    const log = await db.emailLog.create({
      data: {
        provider: "RESEND",
        templateKey,
        toEmail,
        subject: resolvedSubject,
        locale: resolvedLocale,
        status: failureReason ? "FAILED" : simulated ? "SENT" : "PENDING",
        ...(simulated ? { sentAt: new Date() } : {}),
        ...(failureReason ? { error: failureReason } : {}),
        ...(resolvedPayload !== undefined ? { payload: resolvedPayload } : {}),
        ...(orderId !== undefined ? { orderId } : {}),
        ...(quoteRequestId !== undefined ? { quoteRequestId } : {}),
      },
      select: { id: true },
    });
    logId = log.id;
  } catch (err) {
    console.error("[logAndSendEmail] Failed to create EmailLog row:", err);
    return;
  }

  if (failureReason || simulated) {
    return;
  }

  const [identity, profile] = await Promise.all([
    getSetting("email_identity"),
    getSetting("store_profile"),
  ]);
  const fromAddress = env.RESEND_FROM_EMAIL ?? BRAND.noReplyEmail;
  const fromName = identity.fromName || profile.storeName;
  const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
  const replyTo = identity.replyTo || profile.contactEmail || undefined;

  const redirectTo =
    env.EMAIL_REDIRECT_TO && process.env.VERCEL_ENV !== "production"
      ? env.EMAIL_REDIRECT_TO
      : undefined;
  const redirected = Boolean(redirectTo && redirectTo !== toEmail);
  const finalHtml = redirected
    ? `<p style="margin:0 0 16px;padding:8px 12px;background-color:#fef3c7;color:#92400e;font-size:13px;">Test delivery. Intended recipient: ${escapeHtml(toEmail)}</p>${resolvedHtml!}`
    : resolvedHtml!;

  const wrappedHtml = emailChrome.renderEmailChrome(
    finalHtml,
    {
      ...resolvedChrome,
      storeName: resolvedChrome?.storeName ?? profile.storeName,
      contactEmail: resolvedChrome?.contactEmail ?? profile.contactEmail,
      contactPhone: resolvedChrome?.contactPhone ?? profile.contactPhone,
      addressLine: resolvedChrome?.addressLine ?? profile.addressLine,
      preheaderText: override?.preheaderText ?? resolvedChrome?.preheaderText,
      ctaLabel:
        override?.ctaLabel || emailDefault?.ctaLabel || resolvedChrome?.ctaLabel,
    },
    localeContext,
  );

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from,
      to: redirectTo ?? toEmail,
      ...(replyTo ? { replyTo } : {}),
      subject: redirected ? `[${toEmail}] ${resolvedSubject}` : resolvedSubject,
      html: wrappedHtml,
    });

    if (result.error) {
      throw new Error(result.error.message || "Resend rejected the send");
    }

    const providerEmailId =
      result.data && "id" in result.data ? (result.data.id as string) : null;

    if (!providerEmailId) {
      throw new Error("Resend accepted the request but returned no email id");
    }

    await db.emailLog.update({
      where: { id: logId! },
      data: {
        status: "SENT",
        providerEmailId: providerEmailId ?? null,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[logAndSendEmail] Failed to send email via Resend:", err);
    try {
      await db.emailLog.update({
        where: { id: logId! },
        data: {
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    } catch (updateErr) {
      console.error(
        "[logAndSendEmail] Failed to update EmailLog to FAILED:",
        updateErr,
      );
    }
  }
}
