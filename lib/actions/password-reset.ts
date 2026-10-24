"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { logAndSendEmail } from "@/lib/services/resend";
import { localeUrl } from "@/lib/email/links";
import {
  mintPasswordResetToken,
  redeemPasswordResetToken,
} from "@/lib/services/identity/password-reset-token";
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const RESET_REQUEST_THROTTLE_MS = 120_000;

export type RequestPasswordResetErrorCode = "VALIDATION_ERROR";

export type RequestPasswordResetResult =
  | { success: true }
  | { success: false; error: string; errorCode: RequestPasswordResetErrorCode };

export type ResetPasswordErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_TOKEN"
  | "INACTIVE_ACCOUNT"
  | "INTERNAL_ERROR";

export type ResetPasswordResult =
  | { success: true }
  | { success: false; error: string; errorCode: ResetPasswordErrorCode };

class ResetGuardError extends Error {
  constructor(public readonly code: ResetPasswordErrorCode) {
    super(code);
  }
}

export async function requestPasswordResetAction(
  formData: unknown,
): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  after(async () => {
    try {
      const customer = await db.customer.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, isActive: true, name: true, locale: true },
      });

      if (customer && customer.isActive) {
        const recent = await db.passwordResetToken.findFirst({
          where: {
            customerId: customer.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
            createdAt: { gt: new Date(Date.now() - RESET_REQUEST_THROTTLE_MS) },
          },
          select: { id: true },
        });

        if (!recent) {
          const customerLocale = customer.locale ?? "en";
          const token = await mintPasswordResetToken(customer.id);
          const resetUrl = localeUrl(
            customerLocale,
            `/auth/reset-password?token=${token}`,
          );

          await logAndSendEmail({
            templateKey: "password_reset_requested",
            toEmail: normalizedEmail,
            locale: customerLocale,
            chromeOptions: () => ({
              ctaUrl: resetUrl,
              ...(customer.name.trim() ? { recipientName: customer.name } : {}),
            }),
          });
        }
      }
    } catch (err) {
      console.error("[requestPasswordResetAction]", err);
    }
  });

  return { success: true };
}

export async function resetPasswordAction(
  formData: unknown,
): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const customerId = await redeemPasswordResetToken(parsed.data.token);
    if (!customerId) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        errorCode: "INVALID_TOKEN",
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    let email = "";
    let name = "";
    let locale = "en";

    await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: {
            isActive: true,
            email: true,
            name: true,
            locale: true,
            emailVerifiedAt: true,
          },
        });

        if (!customer) throw new ResetGuardError("INVALID_TOKEN");
        if (!customer.isActive) throw new ResetGuardError("INACTIVE_ACCOUNT");

        email = customer.email;
        name = customer.name;
        locale = customer.locale ?? "en";

        await tx.customer.update({
          where: { id: customerId },
          data: {
            passwordHash,
            tokenVersion: { increment: 1 },
            ...(customer.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    after(async () => {
      try {
        await logAndSendEmail({
          templateKey: "password_changed",
          toEmail: email,
          locale,
          chromeOptions: {
            ctaUrl: localeUrl(locale, "/auth/forgot-password"),
            ...(name.trim() ? { recipientName: name } : {}),
          },
        });
      } catch (err) {
        console.error("[resetPasswordAction]", err);
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof ResetGuardError) {
      return { success: false, error: err.code, errorCode: err.code };
    }

    console.error("[resetPasswordAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
