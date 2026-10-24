import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getCustomerOrders } from "@/lib/db/queries/order";
import { OrderCard, AccountPaginationBar } from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 10;

export default async function AccountOrdersPage({
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

  const [{ orders, totalCount }, t] = await Promise.all([
    getCustomerOrders(session.user.id, safeLocale, page, PAGE_SIZE),
    getTranslations("account.orders"),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderRow helpHref="/account/support?topic=ORDER">
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

      {totalCount === 0 ? (
        <div
          style={{
            backgroundColor: "var(--color-auth-form-bg)",
            border: "1px solid var(--color-auth-form-border)",
            borderRadius: "var(--radius-none)",
            padding: "3rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "3rem",
              height: "3rem",
              backgroundColor: "var(--color-auth-form-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                stroke="var(--color-auth-input-placeholder)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {t("empty")}
          </p>
          <Link
            href="/shop"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.75rem",
              paddingInline: "1.5rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: "var(--color-action-primary)",
              color: "var(--color-action-primary-fg)",
              borderRadius: "var(--radius-none)",
            }}
          >
            {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: "1rem" }}
          >
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} locale={safeLocale} />
            ))}
          </div>
          <AccountPaginationBar totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
