import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BRAND } from "@/lib/config/brand";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassLinkForm from "@/components/auth/UaePassLinkForm";

interface UaePassLinkPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; notice?: string }>;
}

export async function generateMetadata({
  params,
}: UaePassLinkPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.uaePassLink" });
  return { title: t("choice.title") };
}

export default async function UaePassLinkPage({
  searchParams,
}: UaePassLinkPageProps) {
  if (!isUaePassEnabled()) notFound();

  const { token, notice } = await searchParams;

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

        <UaePassLinkForm token={token ?? null} notice={notice ?? null} />
      </div>
    </main>
  );
}
