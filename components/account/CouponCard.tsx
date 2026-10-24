"use client";

import { useTranslations } from "next-intl";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { CustomerCouponListItem } from "@/lib/db/queries/coupon";

interface Props {
  coupon: CustomerCouponListItem;
  locale: "en" | "ar" | "ru";
}

export default function CouponCard({ coupon, locale }: Props) {
  const t = useTranslations("account.coupons");

  const rewardValue =
    coupon.type === "PERCENTAGE"
      ? `${coupon.value}%`
      : coupon.type === "FIXED"
        ? formatAED(coupon.value, locale)
        : t("freeShipping");

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-auth-form-border)",
        borderRadius: "var(--radius-none)",
        transition: "border-color var(--duration-base) var(--ease-default)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--color-action-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
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
              {t("codeLabel")}
            </p>
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-action-primary)",
              }}
            >
              {coupon.code}
            </p>
          </div>
          <p
            dir="ltr"
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-auth-label-text)",
            }}
          >
            {rewardValue}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
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
              {coupon.endsAt
                ? t("expires", { date: formatDisplayDate(coupon.endsAt, locale) })
                : t("noExpiry")}
            </p>
            {coupon.minOrderAmount != null && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.125rem",
                }}
              >
                {t("minOrder", {
                  amount: formatAED(coupon.minOrderAmount, locale),
                })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
