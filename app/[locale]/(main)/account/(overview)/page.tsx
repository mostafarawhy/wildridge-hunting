import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getAccountOverview } from "@/lib/db/queries/account";
import { getTranslations } from "next-intl/server";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatAED } from "@/lib/utils/currency";
import AccountStatusCard from "@/components/account/AccountStatusCard";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";
import OrderStatusBadge from "@/components/ui/OrderStatusBadge";

const hoverStyles = `
  .account-stat-row:hover { background-color: #f5f5f5; }
`;

interface Props {
  params: Promise<{ locale: string }>;
}

function StatRow({
  icon,
  label,
  sublabel,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href as "/account/orders"}
      className="account-stat-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.875rem 1.25rem",
        borderBottom: "1px solid var(--color-shop-divider)",
        textDecoration: "none",
        transition: "background-color 150ms",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: "2rem",
          height: "2rem",
          backgroundColor: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-medium)",
            color: "#0b0b0b",
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            margin: 0,
          }}
        >
          {sublabel}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-ui)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {value}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="#d9d9d9"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </div>
    </Link>
  );
}

function IconOrders() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="#6b6b6b"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 3.5h12v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3.5z" />
      <path d="M1 3.5L2 1h10l1 2.5" />
      <path d="M5 6.5h4" />
    </svg>
  );
}

function IconWishlist() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="#6b6b6b"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 12S1 8.5 1 4.5a3 3 0 016-1 3 3 0 016 1C13 8.5 7 12 7 12z" />
    </svg>
  );
}

function IconLoyalty() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="#6b6b6b"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="7,1 8.8,5.2 13.5,5.5 10,8.5 11,13 7,10.5 3,13 4,8.5 0.5,5.5 5.2,5.2" />
    </svg>
  );
}

export default async function AccountOverviewPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as "en" | "ar" | "ru";
  const session = await auth();

if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }

  const [data, t, tOrders] = await Promise.all([
    getAccountOverview(session.user.id),
    getTranslations("account.overview"),
    getTranslations("account.orders"),
  ]);

  if (!data) {
    return redirect({ href: "/auth/login", locale });
  }

  const d = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{hoverStyles}</style>

      <AccountHeaderRow helpHref="/account/support">
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
          }}
        >
          {t("greeting", { name: d.name })}
        </h1>
      </AccountHeaderRow>

      <AccountStatusCard
        role={d.role}
        verificationStatus={d.verificationStatus}
        verifiedAt={d.verifiedAt}
        createdAt={d.createdAt}
        b2bStatus={d.b2bStatus}
        locale={locale}
      />

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          borderRadius: "var(--radius-none)",
          overflow: "hidden",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-eyebrow)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-action-primary)",
            padding: "1rem 1.25rem 0",
          }}
        >
          {t("activity")}
        </p>

        <StatRow
          icon={<IconOrders />}
          label={t("statOrders")}
          sublabel={t("sublabelOrders")}
          value={d.ordersCount}
          href="/account/orders"
        />
        <StatRow
          icon={<IconWishlist />}
          label={t("statWishlist")}
          sublabel={t("sublabelWishlist")}
          value={d.wishlistCount}
          href="/account/wishlist"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1.25rem",
          }}
        >
          <div
            style={{
              width: "2rem",
              height: "2rem",
              backgroundColor: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconLoyalty />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-medium)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              {t("statPoints")}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              {t("sublabelPoints")}
            </p>
          </div>
          <span
            style={{
              fontSize: "var(--text-ui)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-accent)",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            {d.loyaltyPoints}
          </span>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          borderRadius: "var(--radius-none)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "var(--color-action-primary)",
              margin: 0,
            }}
          >
            {t("recentOrderTitle")}
          </p>
          {d.latestOrder && (
            <Link
              href="/account/orders"
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-content-link)",
                textDecoration: "none",
              }}
            >
              {t("viewAllOrders")} →
            </Link>
          )}
        </div>

        {d.latestOrder ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1rem 1.25rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-bold)",
                  color: "var(--color-action-primary)",
                  margin: 0,
                }}
              >
                #{d.latestOrder.orderNumber}
              </p>
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  margin: 0,
                  marginTop: "0.125rem",
                }}
              >
                {formatDisplayDate(d.latestOrder.createdAt, locale)}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.375rem",
                flexShrink: 0,
              }}
            >
              <OrderStatusBadge
                status={d.latestOrder.status}
                label={tOrders(`status.${d.latestOrder.status}`)}
              />
              <span
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  letterSpacing: "var(--tracking-tight)",
                }}
              >
                {formatAED(d.latestOrder.totalAed, locale)}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "2rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              {t("noOrders")}
            </p>
            <Link
              href="/shop"
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-content-link)",
                textDecoration: "none",
              }}
            >
              {t("startShopping")} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
