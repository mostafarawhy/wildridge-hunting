import { BRAND } from "@/lib/config/brand";
import DemoAccessButtons from "@/components/auth/DemoAccessButtons";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import LoginFormCompact from "@/components/auth/LoginFormCompact";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassButton from "@/components/auth/UaePassButton";
import { ensureLocale } from "@/lib/utils/safe-redirect";

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    registered?: string;
  }>;
}

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const { locale } = await params;
  const { callbackUrl, error, registered } = await searchParams;
  const t = await getTranslations("auth.login");
  const tAuth = await getTranslations("auth");
  const tErr = await getTranslations("auth.uaePass.errors");

  const session = await auth();
  if (session?.user?.principal === "customer") {
    redirect(ensureLocale(callbackUrl, locale) ?? `/${locale}`);
  }

  const resolvedCallbackUrl = ensureLocale(callbackUrl, locale) ?? `/${locale}`;

  const errorMessages: Record<string, string> = {
    uae_pass_denied: tErr("loginCancelled"),
    uae_pass_existing_account: tErr("existingAccount"),
    uae_pass_no_email: tErr("generic"),
    uae_pass_error: tErr("generic"),
    account_error: tErr("generic"),
  };
  const errorMessage = error
    ? (errorMessages[error] ?? tErr("generic"))
    : null;

  return (
    <main
      style={{
        minHeight: "calc(100dvh - var(--spacing-header))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-auth-form-bg)",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        {/* Wordmark */}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-black)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-auth-label-text)",
            marginBottom: "2.5rem",
            textAlign: "center",
          }}
        >
          {BRAND.name}
        </p>

        {/* Heading */}
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.25rem",
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            marginBottom: "2rem",
          }}
        >
          {t("subtitle")}
        </p>

        {/* Banners */}
        {registered === "true" && (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-auth-success-bg)",
              border: "1px solid var(--color-auth-success-border)",
              color: "var(--color-auth-success-text)",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "var(--text-body-sm)",
            }}
          >
            {t("success.registered")}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              backgroundColor: "var(--color-auth-error-bg)",
              border: "1px solid var(--color-auth-error-border)",
              color: "var(--color-auth-error-text)",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "var(--text-body-sm)",
            }}
          >
            {errorMessage}
          </div>
        )}

        <DemoAccessButtons callbackUrl={resolvedCallbackUrl} />

        {isUaePassEnabled() && (
          <>
            {/* UAE Pass — primary CTA */}
            <UaePassButton callbackUrl={resolvedCallbackUrl} mode="sign-in" />

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                margin: "1.5rem 0",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "var(--color-auth-divider)",
                }}
              />
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-auth-input-placeholder)",
                  whiteSpace: "nowrap",
                }}
              >
                {tAuth("uaePass.divider.signIn")}
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "var(--color-auth-divider)",
                }}
              />
            </div>
          </>
        )}

        {/* Email / password form */}
        <LoginFormCompact callbackUrl={resolvedCallbackUrl} />

        {/* Register link */}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-label-text)",
            marginTop: "1.5rem",
            textAlign: "center",
          }}
        >
          {t("noAccount")}{" "}
          <Link
            href={`/auth/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            style={{
              fontWeight: "var(--font-semibold)",
              color: "var(--color-auth-link)",
            }}
          >
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
