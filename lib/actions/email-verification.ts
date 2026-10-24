"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { logAndSendEmail } from "@/lib/services/resend";
import {
  loadCustomerEmailData,
  customerAccountChrome,
  sendEmailVerificationRequest,
} from "@/lib/email/account-email";
import { confirmEmailVerificationToken } from "@/lib/services/identity/email-verification-token";
import { confirmEmailVerificationSchema, loginSchema } from "@/lib/validations/auth";

const RESEND_VERIFICATION_THROTTLE_MS = 120_000;

export type ConfirmEmailVerificationErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_TOKEN"
  | "INTERNAL_ERROR";

export type ConfirmEmailVerificationResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: ConfirmEmailVerificationErrorCode;
    };

export async function confirmEmailVerificationAction(
  formData: unknown,
): Promise<ConfirmEmailVerificationResult> {
  const parsed = confirmEmailVerificationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const result = await confirmEmailVerificationToken(parsed.data.token);
    if (!result) {
      return {
        success: false,
        error: "INVALID_TOKEN",
        errorCode: "INVALID_TOKEN",
      };
    }

    const { customerId, newlyVerified } = result;

    if (newlyVerified) {
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
    }

    return { success: true };
  } catch (err) {
    console.error("[confirmEmailVerificationAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type ResendEmailVerificationErrorCode = "VALIDATION_ERROR";

export type ResendEmailVerificationResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: ResendEmailVerificationErrorCode;
    };

export async function resendEmailVerificationAction(
  formData: unknown,
): Promise<ResendEmailVerificationResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  after(async () => {
    try {
      const customer = await db.customer.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          isActive: true,
          passwordHash: true,
          emailVerifiedAt: true,
        },
      });

      if (
        !customer ||
        !customer.isActive ||
        !customer.passwordHash ||
        customer.emailVerifiedAt
      ) {
        return;
      }

      const passwordMatch = await bcrypt.compare(
        password,
        customer.passwordHash,
      );
      if (!passwordMatch) return;

      const recent = await db.emailVerificationToken.findFirst({
        where: {
          customerId: customer.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          createdAt: {
            gt: new Date(Date.now() - RESEND_VERIFICATION_THROTTLE_MS),
          },
        },
        select: { id: true },
      });
      if (recent) return;

      await sendEmailVerificationRequest({
        id: customer.id,
        email: customer.email,
        name: customer.name,
        locale: customer.locale,
      });
    } catch (err) {
      console.error("[resendEmailVerificationAction]", err);
    }
  });

  return { success: true };
}
