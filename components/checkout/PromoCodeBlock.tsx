"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";
import { validateCouponAction } from "@/lib/actions/coupon";
import { formatAED } from "@/lib/utils/currency";

const ERROR_KEYS: Record<string, string> = {
  NOT_FOUND: "errors.notFound",
  INACTIVE: "errors.inactive",
  NOT_STARTED: "errors.notStarted",
  EXPIRED: "errors.expired",
  ROLE_NOT_ALLOWED: "errors.roleNotAllowed",
  MIN_ORDER_NOT_MET: "errors.minOrderNotMet",
  USAGE_LIMIT_REACHED: "errors.usageLimitReached",
  EMPTY_CART: "errors.emptyCart",
  UNAUTHENTICATED: "errors.unauthenticated",
  FREE_SHIPPING_NOT_APPLICABLE: "errors.freeShippingQuoteRequired",
  INTERNAL_ERROR: "errors.generic",
};

export default function PromoCodeBlock() {
  const t = useTranslations("checkout.promo");
  const locale = useLocale() as "en" | "ar" | "ru";
  const {
    appliedCoupon,
    applyCoupon,
    clearCoupon,
    methods,
    selectedMethodId,
    availableReward,
    quoteRequired,
  } = useCheckoutForm();
  const selectedMethod =
    methods.find((m) => m.id === selectedMethodId) ?? null;
  const freeShipNotEligible =
    appliedCoupon?.freeShipping === true &&
    (quoteRequired ||
      (selectedMethod !== null && !selectedMethod.freeShippingEligible));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await validateCouponAction(trimmed, locale, quoteRequired);
      if (res.success) {
        applyCoupon(res.data);
        setCode("");
      } else {
        setError(t(ERROR_KEYS[res.errorCode] ?? "errors.generic"));
      }
    });
  }

  function handleRemove() {
    clearCoupon();
    setError(null);
  }

  function handleApplyReward() {
    if (!availableReward) return;
    setError(null);
    startTransition(async () => {
      const res = await validateCouponAction(
        availableReward.code,
        locale,
        quoteRequired,
      );
      if (res.success) {
        applyCoupon(res.data);
      } else {
        setError(t(ERROR_KEYS[res.errorCode] ?? "errors.generic"));
      }
    });
  }

  if (appliedCoupon) {
    return (
      <div>
        <p className="text-[0.875rem] font-bold text-neutral-900 mb-2">
          {t("title")}
        </p>
        <div className="flex items-center justify-between gap-3 p-3.5 border border-neutral-200 bg-neutral-50">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-neutral-900">
              <span dir="ltr" className="uppercase">
                {appliedCoupon.code}
              </span>{" "}
              · {t("applied")}
            </p>
            <p
              className="text-[0.75rem] mt-0.5"
              style={{ color: freeShipNotEligible ? "#854d0e" : "var(--color-positive)" }}
            >
              {appliedCoupon.freeShipping ? (
                freeShipNotEligible ? (
                  quoteRequired ? (
                    t("errors.freeShippingQuoteRequired")
                  ) : (
                    t("freeShippingNotEligible")
                  )
                ) : (
                  t("freeShippingApplied")
                )
              ) : (
                <>
                  {t("youSaved")}{" "}
                  <span dir="ltr" className="tabular-nums">
                    {formatAED(appliedCoupon.discountAmount, locale)}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 text-[0.75rem] font-semibold text-neutral-500 hover:text-[var(--color-error)] underline underline-offset-[3px] transition-colors"
          >
            {t("remove")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[0.875rem] font-bold text-neutral-900 mb-2">
        {t("title")}
      </p>

      {availableReward !== null &&
        !(quoteRequired && availableReward.freeShipping) && (
        <div className="mb-3 flex items-center justify-between gap-3 p-3.5 border border-neutral-200 bg-neutral-50">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-bold tracking-[0.1em] uppercase text-neutral-500 mb-1">
              {t("reward.label")}
            </p>
            <p className="text-[0.8125rem] font-semibold text-neutral-900">
              <span dir="ltr" className="uppercase">
                {availableReward.code}
              </span>
            </p>
            <p className="text-[0.75rem] mt-0.5" style={{ color: "var(--color-positive)" }}>
              {availableReward.freeShipping
                ? t("reward.freeShipping")
                : t.rich("reward.discount", {
                    amt: () => (
                      <span dir="ltr" className="tabular-nums">
                        {formatAED(availableReward.discountAmount, locale)}
                      </span>
                    ),
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={handleApplyReward}
            disabled={isPending}
            className="shrink-0 h-9 px-4 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.8125rem] hover:bg-[var(--color-action-secondary-hover-bg)] disabled:bg-transparent disabled:border-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? t("applying") : t("reward.apply")}
          </button>
        </div>
      )}

      <div>
        <div className="flex gap-0">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
            placeholder={t("placeholder")}
            disabled={isPending}
            className="h-11 flex-1 px-3.5 bg-white border border-neutral-300 text-[0.875rem] text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-[var(--color-auth-input-border-focus)] transition-colors tabular-nums uppercase disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || isPending}
            className="h-11 px-5 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] hover:bg-[var(--color-action-secondary-hover-bg)] disabled:bg-transparent disabled:border-neutral-300 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? t("applying") : t("apply")}
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
      </div>
    </div>
  );
}
