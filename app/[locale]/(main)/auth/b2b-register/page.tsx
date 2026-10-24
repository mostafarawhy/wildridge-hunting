import { BRAND } from "@/lib/config/brand";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getCustomerB2BStatus } from "@/lib/db/queries/customer";
import { getSetting } from "@/lib/db/queries/settings";
import B2BRegisterForm from "@/components/auth/B2BRegisterForm";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function B2BRegisterPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("auth.b2bRegister");

  const session = await auth();
  if (session?.user?.principal !== "customer") {
    redirect(`/${locale}/auth/login?callbackUrl=/auth/b2b-register`);
  }

  const b2bStatus = await getCustomerB2BStatus(session.user.id);
  if (b2bStatus?.derivedStatus === "EXPIRED") {
    redirect(`/${locale}/account/b2b/renew`);
  }
  if (b2bStatus?.derivedStatus === "APPROVED") {
    redirect(`/${locale}/shop`);
  }
  if (
    b2bStatus?.derivedStatus === "PENDING" ||
    b2bStatus?.derivedStatus === "SUSPENDED"
  ) {
    redirect(`/${locale}/account/b2b`);
  }

  const b2bContent = await getSetting("b2b_content");

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
      <div style={{ width: "100%", maxWidth: "640px" }}>
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
            color: "var(--color-action-primary)",
            marginBottom: "0.25rem",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="text-body-sm"
          style={{
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          {t("subtitle")}
        </p>

        <B2BRegisterForm
          locale={locale as "en" | "ar" | "ru"}
          b2bContent={b2bContent[locale as "en" | "ar" | "ru"]}
          requiredTypes={b2bContent.requiredTypes}
          recommendedTypes={b2bContent.recommendedTypes}
        />
      </div>
    </main>
  );
}
