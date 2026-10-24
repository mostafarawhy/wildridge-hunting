"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { BRAND } from "@/lib/config/brand";
import { isDemoMode } from "@/lib/config/demo";
import { env } from "@/lib/env";

type StaffLoginResult =
  | { success: true; data: Record<string, never> }
  | { success: false; error: string; errorCode: string };

export async function staffLoginAction(credentials: {
  email: string;
  password: string;
}): Promise<StaffLoginResult> {
  try {
    await signIn("staff-credentials", {
      email: credentials.email,
      password: credentials.password,
      redirect: false,
    });

    return { success: true, data: {} };
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return {
            success: false,
            error: "Invalid email or password.",
            errorCode: "INVALID_CREDENTIALS",
          };
        default:
          return {
            success: false,
            error: "Authentication failed. Please try again.",
            errorCode: "AUTH_ERROR",
          };
      }
    }

    console.error("[staff-auth] staffLoginAction error:", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "UNKNOWN",
    };
  }
}

export async function staffDemoLoginAction(): Promise<StaffLoginResult> {
  if (!isDemoMode() || !env.DEMO_STAFF_PASSWORD) {
    return {
      success: false,
      error: "Demo access is not available.",
      errorCode: "DEMO_UNAVAILABLE",
    };
  }
  return staffLoginAction({
    email: `demo.staff@${BRAND.emailDomain}`,
    password: env.DEMO_STAFF_PASSWORD,
  });
}

export async function staffLogoutAction(): Promise<void> {
  await signOut({ redirectTo: "/admin/login" });
}
