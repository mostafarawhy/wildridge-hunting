import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getCustomerActiveCoupons } from "@/lib/db/queries/coupon";
import { CouponCard } from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountCouponsPage({ params }: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
  if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const [coupons, t] = await Promise.all([
    getCustomerActiveCoupons(session.user.id),
    getTranslations("account.coupons"),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderRow helpHref="/account/support">
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          {t("subtitle")}
        </p>
      </AccountHeaderRow>

      {coupons.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-auth-form-border)",
            borderRadius: "var(--radius-none)",
            padding: "3rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {t("empty")}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {coupons.map((c) => (
            <CouponCard key={c.id} coupon={c} locale={safeLocale} />
          ))}
        </div>
      )}
    </div>
  );
}
