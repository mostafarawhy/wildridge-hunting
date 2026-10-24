"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import OrderStatusBadge from "@/components/ui/OrderStatusBadge";
import type { OrderListItemProjection } from "@/lib/db/queries/order";

interface Props {
  order: OrderListItemProjection;
  locale: "en" | "ar" | "ru";
}

export default function OrderCard({ order, locale }: Props) {
  const t = useTranslations("account.orders");

  return (
    <Link
      href={`/account/orders/${order.id}`}
      style={{
        display: "block",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-auth-form-border)",
        borderRadius: "var(--radius-none)",
        textDecoration: "none",
        transition: "border-color var(--duration-base) var(--ease-default)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor =
          "var(--color-action-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor =
          "var(--color-auth-form-border)";
      }}
    >
      <div
        style={{
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                fontWeight: "var(--font-medium)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                marginBottom: "0.25rem",
              }}
            >
              {t("orderNumber")}
            </p>
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-action-primary)",
              }}
            >
              {order.orderNumber}
            </p>
          </div>
          <OrderStatusBadge
            status={order.status}
            label={t(`status.${order.status}`)}
          />
        </div>

        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-auth-label-text)",
            fontWeight: "var(--font-medium)",
          }}
        >
          {order.firstItemName}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--color-auth-form-border)",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {formatDisplayDate(order.createdAt, locale)}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                marginTop: "0.125rem",
              }}
            >
              {t("itemCount", { count: order.itemCount })}
            </p>
          </div>
          <p
            dir="ltr"
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-auth-label-text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatAED(order.totalAed, locale)}
          </p>
        </div>
      </div>
    </Link>
  );
}
