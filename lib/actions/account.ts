"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { logAndSendEmail } from "@/lib/services/resend";
import { localeUrl } from "@/lib/email/links";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "@/lib/validations/account";

export type AccountActionErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "INCORRECT_PASSWORD"
  | "SAME_PASSWORD"
  | "NO_PASSWORD_SET"
  | "PASSWORD_WEAK"
  | "PASSWORDS_DO_NOT_MATCH"
  | "INTERNAL_ERROR";

export type AccountActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: AccountActionErrorCode };

export async function updateProfileAction(
  input: unknown,
): Promise<AccountActionResult> {
  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "Not authenticated.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: firstError, errorCode: "VALIDATION_ERROR" };
  }

  const { name, phone, locale } = parsed.data;

  try {
    await db.customer.update({
      where: { id: customerId },
      data: { name, phone: phone ?? null, locale },
    });
    revalidatePath("/[locale]/account", "page");
    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function changePasswordAction(
  input: unknown,
): Promise<AccountActionResult> {
  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "Not authenticated.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    const errorCode =
      path === "newPassword"
        ? "PASSWORD_WEAK"
        : path === "confirmNewPassword"
          ? "PASSWORDS_DO_NOT_MATCH"
          : "VALIDATION_ERROR";
    return { success: false, error: "Invalid input.", errorCode };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { passwordHash: true, email: true, name: true, locale: true },
    });

    if (!customer?.passwordHash) {
      return {
        success: false,
        error: "No password is set on this account.",
        errorCode: "NO_PASSWORD_SET",
      };
    }

    const currentMatch = await bcrypt.compare(
      currentPassword,
      customer.passwordHash,
    );
    if (!currentMatch) {
      return {
        success: false,
        error: "Current password is incorrect.",
        errorCode: "INCORRECT_PASSWORD",
      };
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      customer.passwordHash,
    );
    if (samePassword) {
      return {
        success: false,
        error: "New password must be different from the current one.",
        errorCode: "SAME_PASSWORD",
      };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.customer.update({
      where: { id: customerId },
      data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
    });

    const locale = customer.locale ?? "en";
    after(async () => {
      try {
        await logAndSendEmail({
          templateKey: "password_changed",
          toEmail: customer.email,
          locale,
          chromeOptions: {
            ctaUrl: localeUrl(locale, "/auth/forgot-password"),
            ...(customer.name.trim() ? { recipientName: customer.name } : {}),
          },
        });
      } catch (err) {
        console.error("[changePasswordAction]", err);
      }
    });

    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
