"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { isUaePassEnabled } from "@/lib/env.client";
import { isDemoMode } from "@/lib/config/demo";
import { signIn, signOut } from "@/lib/auth";
import { auth } from "@/auth";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { mergeGuestCartAction } from "@/lib/actions/cart";
import { getIdentityProvider } from "@/lib/services/identity";
import { sendEmailVerificationRequest } from "@/lib/email/account-email";
import { UaePassProvider } from "@/lib/services/identity/uae-pass-provider";
import { setUaePassState } from "@/lib/services/identity/uae-pass-state";
import { safeRelativePath } from "@/lib/utils/safe-redirect";
import { EMAIL_NOT_VERIFIED_CODE } from "@/lib/services/identity/signin-errors";

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "EMAIL_TAKEN"
  | "EMAIL_NOT_VERIFIED"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED";

export type AuthActionResult =
  | { success: true }
  | { success: false; error: string; errorCode: AuthErrorCode };

export async function registerAction(
  formData: unknown,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return {
      success: false,
      error: firstError,
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { email, password, name, locale } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const existing = await db.customer.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: "An account with this email already exists.",
        errorCode: "EMAIL_TAKEN",
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const customer = await db.customer.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        role: "B2C",
        locale,
        verificationStatus: "NOT_REQUIRED",
        isActive: true,
        emailVerifiedAt: isDemoMode() ? new Date() : null,
      },
      select: { id: true },
    });

    if (isDemoMode()) {
      await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      const mergeResult = await mergeGuestCartAction(customer.id);
      if (!mergeResult.success) {
        console.error("[registerAction] cart merge failed:", mergeResult.error);
      }
      return { success: true };
    }

    after(async () => {
      try {
        await sendEmailVerificationRequest({
          id: customer.id,
          email: normalizedEmail,
          name,
          locale,
        });
      } catch (err) {
        console.error("[registerAction] verification email failed:", err);
      }
    });

    return { success: true };
  } catch (err) {
    console.error("[registerAction] Unexpected error:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function loginAction(
  formData: unknown,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return {
      success: false,
      error: firstError,
      errorCode: "VALIDATION_ERROR",
    };
  }

  const { email, password } = parsed.data;

  try {
    const normalizedEmail = email.toLowerCase();

    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirect: false,
    });

    const customer = await db.customer.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (customer?.id) {
      const mergeResult = await mergeGuestCartAction(customer.id);
      if (!mergeResult.success) {
        console.error("[loginAction] cart merge failed:", mergeResult.error);
      }
    }

    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      if (
        "code" in err &&
        (err as { code?: unknown }).code === EMAIL_NOT_VERIFIED_CODE
      ) {
        return {
          success: false,
          error: "Email not verified.",
          errorCode: "EMAIL_NOT_VERIFIED",
        };
      }

      if (err.type === "CredentialsSignin") {
        return {
          success: false,
          error: "Invalid email or password.",
          errorCode: "INVALID_CREDENTIALS",
        };
      }

      console.error("[loginAction] AuthError:", err.type, err.message);
      return {
        success: false,
        error: "Invalid email or password.",
        errorCode: "INVALID_CREDENTIALS",
      };
    }

    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    console.error("[loginAction] Unexpected error:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function logoutAction(): Promise<{ redirectUrl: string }> {
  const locale = await getLocale();
  const session = await auth();

  let uaePassLogoutUrl: string | null = null;

  if (session?.user?.uaePassSession === true) {
    try {
      const provider = getIdentityProvider();
      if (provider instanceof UaePassProvider) {
        uaePassLogoutUrl = provider.buildLogoutUrl(`/${locale}`);
      }
    } catch (err) {
      console.error("[logoutAction] UAE PASS logout URL build failed:", err);
    }
  }

  await signOut({ redirect: false });
  return { redirectUrl: uaePassLogoutUrl ?? `/${locale}` };
}

// ---------------------------------------------------------------------------
// initiateUaePassLoginAction
// ---------------------------------------------------------------------------
// Unlike initiateUaePassAction (in verification.ts) this does NOT require an
// existing session — it is the entry point for UAE Pass as an auth method.
// The callbackUrl is encoded into the OAuth state so the callback route can
// redirect there after sign-in + verification approval.
//
// `mode` reflects which UAE Pass button the user clicked (sign-in vs sign-up)
// per UAE Pass button-usage guidelines — carried in metadata so the callback
// route / auth screen can tailor copy or analytics without changing the
// OAuth contract itself.
// ---------------------------------------------------------------------------

export type UaePassLoginMode = "sign-in" | "sign-up";

export type UaePassLoginResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string; errorCode: AuthErrorCode };

export async function initiateUaePassLoginAction(input: {
  locale: "en" | "ar" | "ru";
  callbackUrl: string;
  mode: UaePassLoginMode;
}): Promise<UaePassLoginResult> {
  if (!isUaePassEnabled()) {
    return {
      success: false,
      error: "UAE Pass is not available in this environment.",
      errorCode: "NOT_IMPLEMENTED",
    };
  }
  try {
    const provider = getIdentityProvider();

    if (provider.name === "manual") {
      return {
        success: false,
        error: "UAE Pass is not available in this environment.",
        errorCode: "NOT_IMPLEMENTED",
      };
    }

    const safeCallbackUrl =
      safeRelativePath(input.callbackUrl) ?? "/account/verification";

    // We pass a sentinel customerId so the provider can build the auth URL.
    // The real customerId is resolved in the callback after identity is confirmed.
    const result = await provider.initiateVerification({
      customerId: "unauthenticated",
      customerEmail: "",
      customerName: "",
      locale: input.locale,
      // Encode the callbackUrl into the redirectUrl so the callback route
      // knows where to send the user after sign-in.
      redirectUrl: safeCallbackUrl,
      metadata: {
        flow: "login",
        mode: input.mode,
        callbackUrl: safeCallbackUrl,
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.errorMessage,
        errorCode:
          result.errorCode === "NOT_IMPLEMENTED"
            ? "NOT_IMPLEMENTED"
            : "INTERNAL_ERROR",
      };
    }

    if (!result.redirectUrl) {
      return {
        success: false,
        error: "UAE Pass did not return a redirect URL.",
        errorCode: "INTERNAL_ERROR",
      };
    }

    await setUaePassState({
      state: result.applicantId,
      locale: input.locale,
      flow: "login",
      callbackUrl: safeCallbackUrl,
    });

    return { success: true, redirectUrl: result.redirectUrl };
  } catch (err) {
    console.error("[initiateUaePassLoginAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
