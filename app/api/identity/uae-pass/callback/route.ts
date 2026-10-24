import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { auth, signIn } from "@/lib/auth";
import { mergeGuestCartAction } from "@/lib/actions/cart";
import { ensureLocale } from "@/lib/utils/safe-redirect";
import { Prisma } from "@/app/generated/prisma/client";
import { getIdentityProvider } from "@/lib/services/identity";
import { UaePassProvider } from "@/lib/services/identity/uae-pass-provider";
import { resolveUaePassAccount } from "@/lib/services/identity/uae-pass-account";
import { mintUaePassTicket } from "@/lib/services/identity/uae-pass-ticket";
import { mintPendingLink } from "@/lib/services/identity/uae-pass-pending-link";
import {
  readUaePassState,
  clearUaePassState,
  type UaePassFlow,
} from "@/lib/services/identity/uae-pass-state";

const UAE_PASS_CANCEL_ERRORS = new Set([
  "invalid_request",
  "login_required",
  "access_denied",
  "cancelledOnApp",
]);

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

type Locale = "en" | "ar" | "ru";

function fallbackLocale(request: NextRequest): Locale {
  const referer = request.headers.get("referer") ?? "";
  const match = referer.match(/\/(en|ar|ru)\//);
  if (match?.[1] === "ar") return "ar";
  if (match?.[1] === "ru") return "ru";
  return "en";
}

function loginRedirect(
  request: NextRequest,
  locale: Locale,
  reason: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/auth/login?error=${encodeURIComponent(reason)}`,
      request.url,
    ),
  );
}

function verificationRedirect(
  request: NextRequest,
  locale: Locale,
  reason: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/account/verification?error=${encodeURIComponent(reason)}`,
      request.url,
    ),
  );
}

function verificationNotice(
  request: NextRequest,
  locale: Locale,
  notice: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/account/verification?notice=${encodeURIComponent(notice)}`,
      request.url,
    ),
  );
}

function settingsRedirect(
  request: NextRequest,
  locale: Locale,
  reason: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/account/settings?error=${encodeURIComponent(reason)}`,
      request.url,
    ),
  );
}

function settingsNotice(
  request: NextRequest,
  locale: Locale,
  notice: string,
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/${locale}/account/settings?notice=${encodeURIComponent(notice)}`,
      request.url,
    ),
  );
}

function earlyFailure(
  request: NextRequest,
  locale: Locale,
  flow: UaePassFlow,
  reason: string,
): NextResponse {
  if (flow === "verification") {
    return verificationRedirect(request, locale, "data_sharing_error");
  }
  if (flow === "link") {
    return settingsRedirect(request, locale, reason);
  }
  return loginRedirect(request, locale, reason);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (env.UAE_PASS_LIVE !== "true") {
    return NextResponse.json(
      { error: "UAE PASS callback is not enabled in this environment." },
      { status: 501 },
    );
  }

  const { searchParams } = request.nextUrl;
  const providerError = searchParams.get("error");
  const returnedState = searchParams.get("state");
  const code = searchParams.get("code");

  const statePayload = await readUaePassState();
  await clearUaePassState();

  const locale: Locale = statePayload?.locale ?? fallbackLocale(request);
  const flow: UaePassFlow = statePayload?.flow ?? "login";

  if (providerError) {
    const reason = UAE_PASS_CANCEL_ERRORS.has(providerError)
      ? "uae_pass_denied"
      : "uae_pass_error";
    return earlyFailure(request, locale, flow, reason);
  }

  if (!statePayload) {
    return earlyFailure(request, locale, flow, "uae_pass_error");
  }

  if (!returnedState || returnedState !== statePayload.state) {
    console.error("[uae-pass/callback] state mismatch");
    return earlyFailure(request, locale, flow, "uae_pass_error");
  }

  if (!code) {
    return earlyFailure(request, locale, flow, "uae_pass_error");
  }

  const provider = getIdentityProvider();
  if (!(provider instanceof UaePassProvider)) {
    return earlyFailure(request, locale, flow, "uae_pass_error");
  }

  const identity = await provider.resolveIdentity(code);
  if (!identity.success) {
    console.error(
      `[uae-pass/callback] identity resolution failed: ${identity.errorCode}`,
    );
    return earlyFailure(request, locale, flow, "uae_pass_error");
  }

  const { userInfo } = identity;

  if (flow === "verification") {
    const session = await auth();
    if (session?.user?.principal !== "customer") {
      return verificationRedirect(request, locale, "session_expired");
    }
    const customerId = session.user.id;

    const uuidOwner = await db.customer.findUnique({
      where: { uaePassUuid: userInfo.uuid },
      select: { id: true },
    });
    if (uuidOwner && uuidOwner.id !== customerId) {
      console.error("[uae-pass/callback] uuid already linked to another customer");
      return verificationRedirect(request, locale, "uae_pass_uuid_taken");
    }

    const eligible =
      (userInfo.userType === "SOP2" || userInfo.userType === "SOP3") &&
      typeof userInfo.idn === "string" &&
      userInfo.idn.length > 0;

    if (!eligible) {
      return verificationNotice(request, locale, "uae_pass_manual_review");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);

    try {
      await db.$transaction(
        async (tx) => {
          const event = await tx.verificationEvent.create({
            data: {
              customerId,
              provider: "UAE_PASS",
              status: "APPROVED",
              applicantId: userInfo.uuid,
              reviewedById: null,
              reviewedAt: now,
              rawPayload: {
                userType: userInfo.userType,
                nationalityEN: userInfo.nationalityEN ?? null,
                fullnameEN: userInfo.fullnameEN ?? null,
                idType: userInfo.idType ?? null,
                acr: userInfo.acr ?? null,
              } as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          await tx.customer.update({
            where: { id: customerId },
            data: {
              uaePassUuid: userInfo.uuid,
              verificationStatus: "APPROVED",
              verifiedAt: now,
              verificationExpiresAt: expiresAt,
            },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "verification.approve",
              entityType: "VerificationEvent",
              entityId: event.id,
              before: Prisma.JsonNull,
              after: {
                status: "APPROVED",
                provider: "UAE_PASS",
                userType: userInfo.userType,
                reviewedById: null,
                reviewedAt: now.toISOString(),
                verificationExpiresAt: expiresAt.toISOString(),
              } as Prisma.InputJsonValue,
              metadata: { customerId } as Prisma.InputJsonValue,
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      console.error("[uae-pass/callback] verification grant failed:", err);
      return verificationRedirect(request, locale, "data_sharing_error");
    }

    return verificationNotice(request, locale, "uae_pass_verified");
  }

  if (flow === "link") {
    const session = await auth();
    if (session?.user?.principal !== "customer") {
      return settingsRedirect(request, locale, "session_expired");
    }
    const customerId = session.user.id;

    const uuidOwner = await db.customer.findUnique({
      where: { uaePassUuid: userInfo.uuid },
      select: { id: true },
    });
    if (uuidOwner && uuidOwner.id !== customerId) {
      console.error("[uae-pass/callback] uuid already linked to another customer");
      return settingsRedirect(request, locale, "uae_pass_uuid_taken");
    }

    const eligible =
      (userInfo.userType === "SOP2" || userInfo.userType === "SOP3") &&
      typeof userInfo.idn === "string" &&
      userInfo.idn.length > 0;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);

    try {
      await db.$transaction(
        async (tx) => {
          await tx.customer.update({
            where: { id: customerId },
            data: eligible
              ? {
                  uaePassUuid: userInfo.uuid,
                  verificationStatus: "APPROVED",
                  verifiedAt: now,
                  verificationExpiresAt: expiresAt,
                }
              : { uaePassUuid: userInfo.uuid },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "customer.uae_pass_link",
              entityType: "Customer",
              entityId: customerId,
              before: Prisma.JsonNull,
              after: {
                userType: userInfo.userType,
                verificationGranted: eligible,
                linkedAt: now.toISOString(),
              } as Prisma.InputJsonValue,
              metadata: { customerId } as Prisma.InputJsonValue,
            },
          });

          if (!eligible) return;

          const event = await tx.verificationEvent.create({
            data: {
              customerId,
              provider: "UAE_PASS",
              status: "APPROVED",
              applicantId: userInfo.uuid,
              reviewedById: null,
              reviewedAt: now,
              rawPayload: {
                userType: userInfo.userType,
                nationalityEN: userInfo.nationalityEN ?? null,
                fullnameEN: userInfo.fullnameEN ?? null,
                idType: userInfo.idType ?? null,
                acr: userInfo.acr ?? null,
              } as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          await tx.auditLog.create({
            data: {
              actorType: "CUSTOMER",
              actorId: customerId,
              action: "verification.approve",
              entityType: "VerificationEvent",
              entityId: event.id,
              before: Prisma.JsonNull,
              after: {
                status: "APPROVED",
                provider: "UAE_PASS",
                userType: userInfo.userType,
                reviewedById: null,
                reviewedAt: now.toISOString(),
                verificationExpiresAt: expiresAt.toISOString(),
              } as Prisma.InputJsonValue,
              metadata: { customerId } as Prisma.InputJsonValue,
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      console.error("[uae-pass/callback] link failed:", err);
      return settingsRedirect(request, locale, "uae_pass_error");
    }

    return settingsNotice(
      request,
      locale,
      eligible ? "uae_pass_linked_verified" : "uae_pass_linked",
    );
  }

  const resolution = await resolveUaePassAccount(userInfo);

  if (resolution.kind !== "linked") {
    let pendingToken: string;
    try {
      pendingToken = await mintPendingLink({
        uaePassUuid: userInfo.uuid,
        email: userInfo.email?.trim().toLowerCase() ?? null,
        fullnameEN: userInfo.fullnameEN ?? null,
        firstnameEN: userInfo.firstnameEN ?? null,
        lastnameEN: userInfo.lastnameEN ?? null,
        nationalityEN: userInfo.nationalityEN ?? null,
        userType: userInfo.userType,
        idnPresent:
          typeof userInfo.idn === "string" && userInfo.idn.length > 0,
        locale,
        callbackUrl: statePayload.callbackUrl,
      });
    } catch (err) {
      console.error("[uae-pass/callback] pending link mint failed:", err);
      return loginRedirect(request, locale, "account_error");
    }

    return NextResponse.redirect(
      new URL(
        `/${locale}/auth/uae-pass-link?token=${encodeURIComponent(pendingToken)}`,
        request.url,
      ),
    );
  }

  const customerId = resolution.customerId;

  let ticket: string;
  try {
    ticket = await mintUaePassTicket(customerId);
  } catch (err) {
    console.error("[uae-pass/callback] ticket mint failed:", err);
    return loginRedirect(request, locale, "account_error");
  }

  try {
    await signIn("uae-pass", { ticket, redirect: false });
  } catch (err) {
    console.error("[uae-pass/callback] signIn failed:", err);
    return loginRedirect(request, locale, "uae_pass_error");
  }

  try {
    const mergeResult = await mergeGuestCartAction(customerId);
    if (!mergeResult.success) {
      console.error(
        "[uae-pass/callback] cart merge failed:",
        mergeResult.error,
      );
    }
  } catch (err) {
    console.error("[uae-pass/callback] cart merge threw:", err);
  }

  const destination =
    ensureLocale(statePayload.callbackUrl, locale) ?? `/${locale}/account`;

  return NextResponse.redirect(new URL(destination, request.url));
}
