import { NextRequest, NextResponse, after } from "next/server";

import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { signIn } from "@/lib/auth";
import { Prisma } from "@/app/generated/prisma/client";
import { mergeGuestCartAction } from "@/lib/actions/cart";
import { ensureLocale } from "@/lib/utils/safe-redirect";
import { mintUaePassTicket } from "@/lib/services/identity/uae-pass-ticket";
import {
  readPendingLink,
  consumePendingLink,
  type PendingLinkRecord,
} from "@/lib/services/identity/uae-pass-pending-link";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadCustomerEmailData,
  customerAccountChrome,
} from "@/lib/email/account-email";

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

type Locale = "en" | "ar" | "ru";

function toLocale(raw: string): Locale {
  if (raw === "ar") return "ar";
  if (raw === "ru") return "ru";
  return "en";
}

function expiredRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(
    new URL("/en/auth/uae-pass-link", request.url),
  );
}

function existingAccountRedirect(
  request: NextRequest,
  locale: Locale,
  token: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/auth/uae-pass-link?token=${encodeURIComponent(token)}&notice=existing`,
      request.url,
    ),
  );
}

function deriveName(record: PendingLinkRecord, email: string): string {
  const full = record.fullnameEN?.trim();
  if (full) return full;

  const parts = [record.firstnameEN, record.lastnameEN]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .trim();
  if (parts) return parts;

  return email.split("@")[0] ?? "UAE PASS User";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (env.UAE_PASS_LIVE !== "true") {
    return NextResponse.json(
      { error: "UAE PASS account linking is not enabled in this environment." },
      { status: 501 },
    );
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) return expiredRedirect(request);

  const pending = await readPendingLink(token);
  if (!pending) return expiredRedirect(request);

  const locale = toLocale(pending.locale);
  const email = pending.email?.trim().toLowerCase() ?? null;

  if (!email) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=uae_pass_no_email`, request.url),
    );
  }

  const existing = await db.customer.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existingAccountRedirect(request, locale, token);

  const consumed = await consumePendingLink(token);
  if (!consumed) return expiredRedirect(request);

  const eligible =
    (consumed.userType === "SOP2" || consumed.userType === "SOP3") &&
    consumed.idnPresent;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);

  let customerId: string;

  try {
    customerId = await db.$transaction(
      async (tx) => {
        const created = await tx.customer.create({
          data: {
            email,
            name: deriveName(consumed, email),
            passwordHash: null,
            role: "B2C",
            locale,
            uaePassUuid: consumed.uaePassUuid,
            isActive: true,
            verificationStatus: eligible ? "APPROVED" : "NOT_REQUIRED",
            verifiedAt: eligible ? now : null,
            verificationExpiresAt: eligible ? expiresAt : null,
          },
          select: { id: true },
        });

        if (!eligible) return created.id;

        const event = await tx.verificationEvent.create({
          data: {
            customerId: created.id,
            provider: "UAE_PASS",
            status: "APPROVED",
            applicantId: consumed.uaePassUuid,
            reviewedById: null,
            reviewedAt: now,
            rawPayload: {
              userType: consumed.userType,
              nationalityEN: consumed.nationalityEN,
              fullnameEN: consumed.fullnameEN,
            } as Prisma.InputJsonValue,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: created.id,
            action: "verification.approve",
            entityType: "VerificationEvent",
            entityId: event.id,
            before: Prisma.JsonNull,
            after: {
              status: "APPROVED",
              provider: "UAE_PASS",
              userType: consumed.userType,
              reviewedById: null,
              reviewedAt: now.toISOString(),
              verificationExpiresAt: expiresAt.toISOString(),
            } as Prisma.InputJsonValue,
            metadata: { customerId: created.id } as Prisma.InputJsonValue,
          },
        });

        return created.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await db.customer.findUnique({
        where: { uaePassUuid: consumed.uaePassUuid },
        select: { id: true },
      });
      if (raced) {
        customerId = raced.id;
      } else {
        console.error("[uae-pass/link-create] unique conflict on create");
        return NextResponse.redirect(
          new URL(`/${locale}/auth/login?error=account_error`, request.url),
        );
      }
    } else {
      console.error("[uae-pass/link-create] customer creation failed:", err);
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login?error=account_error`, request.url),
      );
    }
  }

  after(async () => {
    const data = await loadCustomerEmailData(customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "welcome",
      toEmail: data.customerEmail,
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Account created", tone: "success" },
        infoRows: [{ label: "Email", value: data.customerEmail }],
        ctaUrl: data.accountUrl,
      }),
    });
  });

  let ticket: string;
  try {
    ticket = await mintUaePassTicket(customerId);
  } catch (err) {
    console.error("[uae-pass/link-create] ticket mint failed:", err);
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=account_error`, request.url),
    );
  }

  try {
    await signIn("uae-pass", { ticket, redirect: false });
  } catch (err) {
    console.error("[uae-pass/link-create] signIn failed:", err);
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=uae_pass_error`, request.url),
    );
  }

  try {
    const mergeResult = await mergeGuestCartAction(customerId);
    if (!mergeResult.success) {
      console.error(
        "[uae-pass/link-create] cart merge failed:",
        mergeResult.error,
      );
    }
  } catch (err) {
    console.error("[uae-pass/link-create] cart merge threw:", err);
  }

  const destination =
    ensureLocale(consumed.callbackUrl, locale) ?? `/${locale}/account`;

  return NextResponse.redirect(new URL(destination, request.url));
}
