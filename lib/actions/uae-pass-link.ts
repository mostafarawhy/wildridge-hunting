"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { uaePassLinkSchema } from "@/lib/validations/auth";
import {
  readPendingLink,
  recordPendingLinkAttempt,
  consumePendingLink,
  PENDING_LINK_MAX_ATTEMPTS,
} from "@/lib/services/identity/uae-pass-pending-link";
import { signIn } from "@/lib/auth";
import { mergeGuestCartAction } from "@/lib/actions/cart";
import { ensureLocale } from "@/lib/utils/safe-redirect";
import { mintUaePassTicket } from "@/lib/services/identity/uae-pass-ticket";

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const DUMMY_HASH =
  "$2a$12$0000000000000000000000000000000000000000000000000000";

type Locale = "en" | "ar" | "ru";

function toLocale(raw: string): Locale {
  if (raw === "ar") return "ar";
  if (raw === "ru") return "ru";
  return "en";
}

export type UaePassLinkErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_TOKEN"
  | "CREDENTIALS_NOT_MATCHED"
  | "INACTIVE_ACCOUNT"
  | "NO_PASSWORD"
  | "ALREADY_LINKED"
  | "TOO_MANY_ATTEMPTS"
  | "INTERNAL_ERROR";

export type UaePassLinkResult =
  | { success: true; data: { callbackUrl: string } }
  | { success: false; error: string; errorCode: UaePassLinkErrorCode };

class LinkGuardError extends Error {
  constructor(public readonly code: UaePassLinkErrorCode) {
    super(code);
  }
}

export async function linkUaePassAccountAction(
  formData: unknown,
): Promise<UaePassLinkResult> {
  const parsed = uaePassLinkSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { token, password } = parsed.data;
  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const pending = await readPendingLink(token);
    if (!pending) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        errorCode: "INVALID_TOKEN",
      };
    }

    const customer = await db.customer.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        isActive: true,
        passwordHash: true,
        uaePassUuid: true,
      },
    });

    const matches = await bcrypt.compare(
      password,
      customer?.passwordHash ?? DUMMY_HASH,
    );

    if (!customer || !customer.passwordHash || !matches) {
      const attempts = await recordPendingLinkAttempt(token);

      if (customer && !customer.passwordHash) {
        return {
          success: false,
          error: "NO_PASSWORD",
          errorCode: "NO_PASSWORD",
        };
      }

      if (attempts === null) {
        return {
          success: false,
          error: "INVALID_TOKEN",
          errorCode: "INVALID_TOKEN",
        };
      }

      if (attempts >= PENDING_LINK_MAX_ATTEMPTS) {
        return {
          success: false,
          error: "TOO_MANY_ATTEMPTS",
          errorCode: "TOO_MANY_ATTEMPTS",
        };
      }

      return {
        success: false,
        error: "CREDENTIALS_NOT_MATCHED",
        errorCode: "CREDENTIALS_NOT_MATCHED",
      };
    }

    if (!customer.isActive) {
      return {
        success: false,
        error: "INACTIVE_ACCOUNT",
        errorCode: "INACTIVE_ACCOUNT",
      };
    }

    if (customer.uaePassUuid && customer.uaePassUuid !== pending.uaePassUuid) {
      return {
        success: false,
        error: "ALREADY_LINKED",
        errorCode: "ALREADY_LINKED",
      };
    }

    const consumed = await consumePendingLink(token);
    if (!consumed) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        errorCode: "INVALID_TOKEN",
      };
    }

    const eligible =
      (consumed.userType === "SOP2" || consumed.userType === "SOP3") &&
      consumed.idnPresent;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);
    const customerId = customer.id;

    await db.$transaction(
      async (tx) => {
        const uuidOwner = await tx.customer.findUnique({
          where: { uaePassUuid: consumed.uaePassUuid },
          select: { id: true },
        });

        if (uuidOwner && uuidOwner.id !== customerId) {
          throw new LinkGuardError("ALREADY_LINKED");
        }

        await tx.customer.update({
          where: { id: customerId },
          data: eligible
            ? {
                uaePassUuid: consumed.uaePassUuid,
                verificationStatus: "APPROVED",
                verifiedAt: now,
                verificationExpiresAt: expiresAt,
              }
            : { uaePassUuid: consumed.uaePassUuid },
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
              userType: consumed.userType,
              verificationGranted: eligible,
              linkedAt: now.toISOString(),
              linkMethod: "manual",
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
            actorId: customerId,
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
            metadata: { customerId } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    const locale = toLocale(consumed.locale);

    try {
      const ticket = await mintUaePassTicket(customerId);
      await signIn("uae-pass", { ticket, redirect: false });

      const mergeResult = await mergeGuestCartAction(customerId);
      if (!mergeResult.success) {
        console.error(
          "[linkUaePassAccountAction] cart merge failed:",
          mergeResult.error,
        );
      }
    } catch (sessionErr) {
      console.error(
        "[linkUaePassAccountAction] session mint failed:",
        sessionErr,
      );
    }

    const destination =
      ensureLocale(consumed.callbackUrl, locale) ?? `/${locale}/account`;

    return {
      success: true,
      data: { callbackUrl: destination },
    };
  } catch (err) {
    if (err instanceof LinkGuardError) {
      return { success: false, error: err.code, errorCode: err.code };
    }

    console.error("[linkUaePassAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
