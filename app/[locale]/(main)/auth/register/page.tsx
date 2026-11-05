import { BRAND } from "@/lib/config/brand";
import DemoAccessButtons from "@/components/auth/DemoAccessButtons";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import RegisterFormCompact from "@/components/auth/RegisterFormCompact";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassButton from "@/components/auth/UaePassButton";
import { ensureLocale } from "@/lib/utils/safe-redirect";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations("auth.register");
  const tAuth = await getTranslations("auth");
  const { callbackUrl } = await searchParams;
  const uaePassCallbackUrl = callbackUrl ?? "/checkout";
  const resolvedCallbackUrl = ensureLocale(callbackUrl, locale) ?? `/${locale}`;

  return (
    <main
      style={{
        minHeight: "calc(100dvh - var(--spacing-header))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-auth-form-bg)",
        padding: "4rem 1.5rem 6rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <span
            className="text-body font-bold tracking-widest uppercase"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {BRAND.name}
          </span>
        </div>

        <h1
          className="text-heading font-bold tracking-tight"
          style={{
            color: "var(--color-auth-label-text)",
            marginBottom: "0.25rem",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="text-body-sm"
          style={{
            color: "var(--color-content-tertiary)",
            marginBottom: "2rem",
          }}
        >
          {t("subtitle")}
        </p>

        <DemoAccessButtons callbackUrl={resolvedCallbackUrl} />

        {isUaePassEnabled() && (
          <>
            {/* UAE Pass — primary CTA */}
            <UaePassButton callbackUrl={uaePassCallbackUrl} mode="sign-up" />

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
                {tAuth("uaePass.divider.signUp")}
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

        <RegisterFormCompact callbackUrl={resolvedCallbackUrl} />

        <p
          className="text-body-sm"
          style={{
            color: "var(--color-auth-label-text)",
            marginTop: "1.5rem",
            textAlign: "center",
          }}
        >
          {t("haveAccount")}{" "}
          <Link
            href="/auth/login"
            className="font-medium hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-auth-link)" }}
          >
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </main>
  );
}
