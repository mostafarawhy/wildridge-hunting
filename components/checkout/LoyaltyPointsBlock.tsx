"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";
import { formatAED } from "@/lib/utils/currency";
import { pointsToAed, redeemMinGoodsAed } from "@/lib/utils/loyalty-points";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function LoyaltyPointsBlock() {
  const t = useTranslations("checkout.points");
  const locale = useLocale() as "en" | "ar" | "ru";
  const {
    quoteRequired,
    pointsBalance,
    redeemRule,
    pointsCap,
    pointsInEffect,
    applyPoints,
    clearPoints,
  } = useCheckoutForm();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pointsBalance === 0) return null;

  const title = (
    <p className="text-[0.875rem] font-bold text-neutral-900 mb-2">
      {t("title")}
    </p>
  );

  if (quoteRequired) {
    return (
      <div>
        {title}
        <p className="text-[0.8125rem] text-neutral-600">{t("quoteRequired")}</p>
      </div>
    );
  }

  if (pointsBalance < redeemRule.minPoints) {
    return (
      <div>
        {title}
        <p className="text-[0.8125rem] text-neutral-600">
          {t("belowMinimum", {
            points: fmt(pointsBalance),
            min: fmt(redeemRule.minPoints),
          })}
        </p>
      </div>
    );
  }

  if (pointsCap < redeemRule.minPoints) {
    return (
      <div>
        {title}
        <p className="text-[0.8125rem] text-neutral-600">
          {t.rich("orderTooSmall", {
            amt: () => (
              <span dir="ltr" className="tabular-nums">
                {formatAED(redeemMinGoodsAed(redeemRule), locale)}
              </span>
            ),
          })}
        </p>
      </div>
    );
  }

  if (pointsInEffect > 0) {
    return (
      <div>
        {title}
        <div className="flex items-center justify-between gap-3 p-3.5 border border-neutral-200 bg-neutral-50">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-neutral-900">
              <span>
                {t("pointsCount", { points: fmt(pointsInEffect) })}
              </span>{" "}
              · {t("applied")}
            </p>
            <p className="text-[0.75rem] mt-0.5" style={{ color: "var(--color-positive)" }}>
              {t("youSaved")}{" "}
              <span dir="ltr" className="tabular-nums">
                {formatAED(pointsToAed(pointsInEffect, redeemRule), locale)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearPoints();
              setError(null);
            }}
            className="shrink-0 text-[0.75rem] font-semibold text-neutral-500 hover:text-[var(--color-error)] underline underline-offset-[3px] transition-colors"
          >
            {t("remove")}
          </button>
        </div>
      </div>
    );
  }

  const rangeValues = { min: fmt(redeemRule.minPoints), max: fmt(pointsCap) };

  function handleApply() {
    const n = Number((value ?? String(pointsCap)).trim());
    if (!Number.isInteger(n) || n < redeemRule.minPoints || n > pointsCap) {
      setError(t("errors.range", rangeValues));
      return;
    }
    applyPoints(n);
    setError(null);
  }

  return (
    <div>
      {title}
      <p className="text-[0.8125rem] text-neutral-600 mb-2">
        {t.rich("balance", {
          points: fmt(pointsBalance),
          b: (chunks) => (
            <span dir="ltr" className="font-semibold text-neutral-900 tabular-nums">
              {chunks}
            </span>
          ),
          amt: () => (
            <span dir="ltr" className="tabular-nums">
              {formatAED(pointsToAed(pointsBalance, redeemRule), locale)}
            </span>
          ),
        })}
      </p>
      <div className="flex gap-0">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value ?? String(pointsCap)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder={t("placeholder")}
          className="h-11 flex-1 px-3.5 bg-white border border-neutral-300 text-[0.875rem] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-[var(--color-auth-input-border-focus)] transition-colors tabular-nums"
        />
        <button
          type="button"
          onClick={handleApply}
          className="h-11 px-5 text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] border border-[var(--primitive-gold-dark)] bg-[var(--primitive-gold-dark)] text-white hover:bg-[color-mix(in_srgb,var(--primitive-gold-dark)_85%,black)] hover:border-[color-mix(in_srgb,var(--primitive-gold-dark)_85%,black)] transition-colors"
        >
          {t("apply")}
        </button>
      </div>
      <div className="flex justify-between items-center mt-2 text-[0.75rem] text-neutral-500">
        <span>{t("range", rangeValues)}</span>
        <button
          type="button"
          onClick={() => setValue(null)}
          className="shrink-0 text-[0.75rem] font-semibold text-neutral-500 hover:text-[var(--color-content-link)] underline underline-offset-[3px] transition-colors"
        >
          {t("useMax")}
        </button>
      </div>
      {error && (
        <p
          className="text-[0.75rem] mt-2"
          style={{ color: "var(--color-error)" }}
        >
          {error}
        </p>
      )}
      <p className="text-[0.6875rem] text-neutral-500 mt-1.5">
        {t.rich("rate", {
          points: fmt(redeemRule.minPoints),
          amt: () => (
            <span dir="ltr" className="tabular-nums">
              {formatAED(pointsToAed(redeemRule.minPoints, redeemRule), locale)}
            </span>
          ),
          share: redeemRule.maxSharePercent,
        })}
      </p>
    </div>
  );
}
