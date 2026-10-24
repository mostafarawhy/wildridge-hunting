import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getLoyaltySummary } from "@/lib/db/queries/account";
import { getSetting } from "@/lib/db/queries/settings";
import { LoyaltyWidget, AccountPaginationBar } from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";
import { redeemRuleOf } from "@/lib/utils/loyalty-points";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 20;

export default async function AccountLoyaltyPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";

  const session = await auth();
 if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const [summary, t, program] = await Promise.all([
    getLoyaltySummary(session.user.id, page),
    getTranslations("account.loyalty"),
    getSetting("loyalty_program"),
  ]);

  if (!summary) {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

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

      <LoyaltyWidget
        summary={summary}
        locale={safeLocale}
        program={{
          enabled: program.enabled,
          rateText: program.earnRate.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          }),
        }}
        pending={summary.pending}
        redeemRule={redeemRuleOf(program)}
      />
      <AccountPaginationBar totalPages={Math.ceil(summary.totalCount / PAGE_SIZE)} />
    </div>
  );
}
