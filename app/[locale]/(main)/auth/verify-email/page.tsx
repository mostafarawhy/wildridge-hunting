import { BRAND } from "@/lib/config/brand";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
import { ensureLocale } from "@/lib/utils/safe-redirect";

interface VerifyEmailPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    token?: string;
    sent?: string;
    callbackUrl?: string;
  }>;
}

export async function generateMetadata({
  params,
}: VerifyEmailPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "auth.emailVerification",
  });
  return { title: t("confirm.title") };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: VerifyEmailPageProps) {
  const { locale } = await params;
  const { token, sent, callbackUrl } = await searchParams;

  const safeCallback = ensureLocale(callbackUrl, locale) ?? null;

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

        <VerifyEmailForm
          token={token ?? null}
          sent={sent === "1"}
          callbackUrl={safeCallback}
        />
      </div>
    </main>
  );
}
