"use client";

import { useTranslations } from "next-intl";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatAED } from "@/lib/utils/currency";
import { pointsToAed, type RedeemRule } from "@/lib/utils/loyalty-points";
import type { LoyaltySummaryProjection } from "@/lib/db/queries/account";

interface Props {
  summary: LoyaltySummaryProjection;
  locale: "en" | "ar" | "ru";
  program: { enabled: boolean; rateText: string };
  pending: { points: number; orders: number };
  redeemRule: RedeemRule;
}

export default function LoyaltyWidget({
  summary,
  locale,
  program,
  pending,
  redeemRule,
}: Props) {
  const t = useTranslations("account.loyalty");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-auth-form-border)",
          borderRadius: "var(--radius-none)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-medium)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {t("balanceLabel")}
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span
            dir="ltr"
            style={{
              fontSize: "var(--text-display-sm)",
              fontWeight: "var(--font-black)",
              color: "var(--color-action-primary)",
              lineHeight: 1,
            }}
          >
            {summary.balance.toLocaleString("en-US")}
          </span>
          <span
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
            }}
          >
            {t("pointsUnit")}
          </span>
        </div>
        {summary.balance > 0 && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {t.rich("balanceWorth", {
              amt: () => (
                <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatAED(pointsToAed(summary.balance, redeemRule), locale)}
                </span>
              ),
            })}
          </p>
        )}
        {program.enabled ? (
          <>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                margin: 0,
              }}
            >
              {t("earnRate", { rate: program.rateText })}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                margin: 0,
              }}
            >
              {t("earnRules")}
            </p>
          </>
        ) : (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {t("earningPaused")}
          </p>
        )}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {t.rich("spendRule", {
            amt: () => (
              <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatAED(1, locale)}
              </span>
            ),
            points: redeemRule.pointsPerAed.toLocaleString("en-US"),
            min: redeemRule.minPoints.toLocaleString("en-US"),
            share: redeemRule.maxSharePercent,
          })}
        </p>
        {pending.points > 0 && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-label-text)",
              margin: 0,
            }}
          >
            {t.rich("pending", {
              points: pending.points.toLocaleString("en-US"),
              orders: pending.orders,
              b: (c) => (
                <span dir="ltr" style={{ fontWeight: "var(--font-semibold)" }}>
                  {c}
                </span>
              ),
            })}
          </p>
        )}
      </div>

      {summary.transactions.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v1m0 10v1M8 12H7m10 0h-1"
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
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {summary.transactions.map((tx) => {
            const deltaColor =
              tx.delta > 0
                ? "var(--color-success)"
                : tx.delta < 0
                  ? "var(--color-action-primary)"
                  : "var(--color-content-tertiary)";

            const deltaPrefix = tx.delta > 0 ? "+" : "";

            const secondaryLine = tx.orderNumber
              ? t("forOrder", { orderNumber: tx.orderNumber })
              : "";

            return (
              <div
                key={tx.id}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-auth-form-border)",
                  borderRadius: "var(--radius-none)",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                    flex: 1,
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--color-auth-label-text)",
                      margin: 0,
                    }}
                  >
                    {t(`type.${tx.type}`)}
                  </p>
                  {secondaryLine && (
                    <p
                      dir="auto"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        margin: 0,
                      }}
                    >
                      {secondaryLine}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      margin: 0,
                    }}
                  >
                    {formatDisplayDate(tx.createdAt, locale)}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.25rem",
                    flexShrink: 0,
                  }}
                >
                  <span
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body-lg)",
                      fontWeight: "var(--font-bold)",
                      color: deltaColor,
                    }}
                  >
                    {deltaPrefix}
                    {tx.delta.toLocaleString("en-US")}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                    }}
                  >
                    {t("balanceAfter", {
                      balance: tx.balanceAfter.toLocaleString("en-US"),
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
