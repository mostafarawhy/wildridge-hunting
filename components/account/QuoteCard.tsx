"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAED, sumMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import QuoteStatusBadge from "@/components/ui/QuoteStatusBadge";
import type { QuoteListItemProjection } from "@/lib/db/queries/quote";

interface Props {
  quote: QuoteListItemProjection;
  locale: "en" | "ar" | "ru";
}

export default function QuoteCard({ quote, locale }: Props) {
  const t = useTranslations("account.quotes");
  const statusLabel =
    quote.convertedOrderId !== null
      ? t("statusConverted")
      : t(`status.${quote.status}`);
  const agreedTotalAed =
    quote.quotedTotalAed != null
      ? sumMoney([quote.quotedTotalAed, quote.shippingCostAed ?? 0])
      : null;

  return (
    <Link
      href={`/account/quotes/${quote.id}`}
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
              {t("quoteNumber")}
            </p>
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-action-primary)",
              }}
            >
              {quote.quoteNumber}
            </p>
          </div>
          <QuoteStatusBadge status={quote.status} label={statusLabel} />
        </div>

        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-auth-label-text)",
            fontWeight: "var(--font-medium)",
          }}
        >
          {quote.firstProductName}
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
              {formatDisplayDate(quote.createdAt, locale)}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                marginTop: "0.125rem",
              }}
            >
              {t("itemCount", { count: quote.itemCount })}
            </p>
          </div>
          {agreedTotalAed != null && (
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-auth-label-text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatAED(agreedTotalAed, locale)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
