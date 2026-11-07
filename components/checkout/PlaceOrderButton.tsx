"use client";

import { useState, useTransition } from "react";
import type { RefObject } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";
import { createOrderAction } from "@/lib/actions/orders";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface Props {
  locale: "en" | "ar" | "ru";
  customerNote?: string;
  termsInputRef?: RefObject<HTMLInputElement | null>;
}

const GUARD_MESSAGE =
  "border-s-[3px] border-[var(--color-action-danger)] ps-3 text-[0.8125rem] text-[var(--color-action-danger)] leading-snug";

export default function PlaceOrderButton({
  locale,
  customerNote,
  termsInputRef,
}: Props) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    termsAccepted,
    selectedAddressId,
    selectedMethodId,
    marketingOptIn,
    setIsPlacingOrder,
    appliedCoupon,
    quoteRequired,
    isResolvingShipping,
    pointsInEffect,
    redeemRule,
    clearPoints,
  } = useCheckoutForm();

  const isDisabled = isPending || isResolvingShipping;
  const showTermsMessage = attempted && !termsAccepted;
  const showAddressMessage = attempted && !selectedAddressId;

  function handleClick() {
    if (!termsAccepted || !selectedAddressId) {
      setAttempted(true);
      if (!termsAccepted) termsInputRef?.current?.focus();
      return;
    }

    setAttempted(false);
    setError(null);
    setIsPlacingOrder(true);

    startTransition(async () => {
      const result = await createOrderAction(
        {
          addressSource: "saved",
          addressId: selectedAddressId,
          shippingMethodId: selectedMethodId ?? undefined,
          marketingOptIn,
          customerNote,
          couponCode: appliedCoupon?.code,
          pointsToUse: pointsInEffect > 0 ? pointsInEffect : undefined,
          pointsRate: pointsInEffect > 0 ? redeemRule.pointsPerAed : undefined,
        },
        locale,
      );

      if (result.success) {
        startNavigationProgress();
        router.push(result.data.redirectUrl);
      } else {
        setError(getErrorMessage(result.errorCode, t));
        setIsPlacingOrder(false);
        if (result.errorCode === "POINTS_RATE_CHANGED") {
          clearPoints();
          router.refresh();
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {quoteRequired && (
        <div className="flex items-start gap-2.5 p-3.5 border border-neutral-200 bg-neutral-50">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 mt-0.5 text-neutral-400"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 7.25V11.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="4.75" r="0.75" fill="currentColor" />
          </svg>
          <div>
            <p className="text-[0.8125rem] font-semibold text-neutral-900 leading-snug">
              {t("heldOrder.noteTitle")}
            </p>
            <p className="text-[0.75rem] text-neutral-500 leading-relaxed mt-1">
              {t("heldOrder.noChargeNote")}
            </p>
          </div>
        </div>
      )}

      {showTermsMessage && (
        <p role="alert" className={GUARD_MESSAGE}>
          {t("terms.required")}
        </p>
      )}

      {showAddressMessage && (
        <p role="alert" className={GUARD_MESSAGE}>
          {t("terms.addressRequired")}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleClick}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          className="h-14 w-full sm:w-auto sm:min-w-[240px] sm:px-8 bg-[var(--color-action-primary)] text-white text-body-sm font-bold tracking-[0.2em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-ui hover:bg-[var(--color-action-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? t("placingOrder")
            : quoteRequired
              ? t("heldOrder.placeOrder")
              : t("terms.placeOrder")}
        </button>

        <Link
          href={{ pathname: "/shop", query: { cart: "open" } }}
          className="text-center sm:text-start text-[0.8125rem] underline underline-offset-[3px] text-neutral-700 hover:text-neutral-900 transition-colors"
        >
          ‹ {t("returnToCart")}
        </Link>
      </div>

      {error && (
        <p className="text-[0.8125rem] text-[var(--color-error)] leading-snug">
          {error}
        </p>
      )}
    </div>
  );
}

function getErrorMessage(
  code: string,
  t: ReturnType<typeof useTranslations<"checkout">>,
): string {
  const map: Record<string, string> = {
    UNAUTHENTICATED: t("orderErrors.unauthorized"),
    VALIDATION_ERROR: t("orderErrors.noAddress"),
    EMPTY_CART: t("orderErrors.emptyCart"),
    ID_VERIFICATION_REQUIRED: t("orderErrors.verificationRequired"),
    ADDRESS_NOT_FOUND: t("orderErrors.addressNotFound"),
    INSUFFICIENT_STOCK: t("orderErrors.insufficientStock"),
    COUPON_NOT_APPLICABLE: t("orderErrors.couponNotApplicable"),
    COUPON_FREE_SHIPPING_NOT_APPLICABLE: t(
      "orderErrors.couponFreeShippingQuoteRequired",
    ),
    POINTS_NOT_AVAILABLE: t("orderErrors.pointsNotAvailable"),
    POINTS_BELOW_MINIMUM: t("orderErrors.pointsInvalid"),
    POINTS_OVER_LIMIT: t("orderErrors.pointsInvalid"),
    POINTS_INSUFFICIENT_BALANCE: t("orderErrors.pointsInsufficient"),
    POINTS_RATE_CHANGED: t("orderErrors.pointsRateChanged"),
    PAYMENT_INIT_FAILED: t("orderErrors.paymentFailed"),
  };
  return map[code] ?? t("orderErrors.generic");
}
