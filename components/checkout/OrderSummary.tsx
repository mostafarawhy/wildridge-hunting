"use client";

import FadeImage from "@/components/ui/FadeImage";
import { StarOutlineIcon } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { getImageUrl } from "@/lib/utils/images";
import {
  formatAED,
  multiplyMoney,
  roundMoney,
  sumMoney,
} from "@/lib/utils/currency";
import {
  computeOrderPointsWithRules,
  pointsToAed,
} from "@/lib/utils/loyalty-points";
import PromoCodeBlock from "./PromoCodeBlock";
import LoyaltyPointsBlock from "./LoyaltyPointsBlock";
import type { CheckoutProjection } from "@/lib/db/queries/checkout";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";

interface OrderSummaryProps {
  projection: CheckoutProjection;
  locale: "en" | "ar" | "ru";
  hasAddress: boolean;
}

function OrderItem({
  item,
  locale,
}: {
  item: CheckoutProjection["cart"]["items"][number];
  locale: "en" | "ar" | "ru";
}) {
  const t = useTranslations("checkout");
  return (
    <div className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
      <div className="relative shrink-0">
        <div className="relative h-[72px] w-[72px] overflow-hidden border border-neutral-200 bg-white">
          {item.productImageUrl ? (
            <FadeImage
              src={getImageUrl(item.productImageUrl)}
              alt={item.productName}
              fill
              sizes="72px"
              className="object-contain p-2"
            />
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
        </div>
        <span
          className="absolute -top-2 -start-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-neutral-900 text-white text-[0.625rem] font-bold flex items-center justify-center"
          dir="ltr"
        >
          ×{item.quantity}
        </span>
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <p className="text-[0.875rem] font-semibold text-neutral-900 leading-snug">
          {item.productName}
        </p>
        {item.quantity > 1 && (
          <p className="text-[0.75rem] text-neutral-500 leading-snug mt-1">
            {t.rich("unitEach", {
              price: () => (
                <span dir="ltr" className="tabular-nums">
                  {formatAED(item.unitPriceAed, locale)}
                </span>
              ),
            })}
          </p>
        )}
      </div>

      <p
        className="text-[0.9375rem] font-semibold text-neutral-900 shrink-0 tabular-nums pt-1"
        dir="ltr"
      >
        {formatAED(multiplyMoney(item.unitPriceAed, item.quantity), locale)}
      </p>
    </div>
  );
}

type CheckoutFormValue = ReturnType<typeof useCheckoutForm>;

function computeSummaryFigures(
  projection: CheckoutProjection,
  hasAddress: boolean,
  form: Pick<
    CheckoutFormValue,
    "methods" | "selectedMethodId" | "appliedCoupon" | "pointsInEffect" | "redeemRule"
  >,
) {
  const { methods, selectedMethodId, appliedCoupon, pointsInEffect, redeemRule } =
    form;
  const method = methods.find((m) => m.id === selectedMethodId) ?? null;
  const subtotal = projection.cart.totals.subtotalAed;
  const shippingPrice = hasAddress && method !== null ? method.priceAed : null;
  const goodsDiscount =
    appliedCoupon && !appliedCoupon.freeShipping
      ? Math.min(appliedCoupon.discountAmount, subtotal)
      : 0;
  const couponFreeShipping =
    (appliedCoupon?.freeShipping ?? false) &&
    shippingPrice !== null &&
    (method?.freeShippingEligible ?? false);
  const shippingIsFree = (method?.isFree ?? false) || couponFreeShipping;
  const pointsDiscount = pointsToAed(pointsInEffect, redeemRule);
  const grandTotal = sumMoney([
    subtotal,
    -goodsDiscount,
    -pointsDiscount,
    shippingIsFree ? 0 : (shippingPrice ?? 0),
  ]);
  return {
    method,
    subtotal,
    shippingPrice,
    goodsDiscount,
    couponFreeShipping,
    shippingIsFree,
    pointsDiscount,
    grandTotal,
  };
}

export function useSummaryTotal(
  projection: CheckoutProjection,
  hasAddress: boolean,
): number {
  const form = useCheckoutForm();
  return computeSummaryFigures(projection, hasAddress, form).grandTotal;
}

export default function OrderSummary({
  projection,
  locale,
  hasAddress,
}: OrderSummaryProps) {
  const t = useTranslations("checkout");
  const ts = useTranslations("checkout.success");
  const form = useCheckoutForm();
  const {
    appliedCoupon,
    quoteRequired,
    isResolvingShipping,
    freeShippingThresholdAed,
    pointsInEffect,
    pointsBalance,
  } = form;
  const { cart, verification, vatRate } = projection;

  const {
    method,
    subtotal,
    shippingPrice,
    goodsDiscount,
    couponFreeShipping,
    shippingIsFree,
    pointsDiscount,
  } = computeSummaryFigures(projection, hasAddress, form);
  const grandTotal = useSummaryTotal(projection, hasAddress);
  const remainingToFree =
    freeShippingThresholdAed === null
      ? 0
      : roundMoney(freeShippingThresholdAed - subtotal);
  const goodsBase = Math.max(
    0,
    sumMoney([subtotal, -goodsDiscount, -pointsDiscount]),
  );
  const vatAed =
    vatRate > 0 ? roundMoney(goodsBase - goodsBase / (1 + vatRate)) : 0;
  const points = cart.loyalty.enabled
    ? computeOrderPointsWithRules({
        lines: cart.items.map((item) => ({
          lineTotal: item.lineSubtotalAed.toFixed(2),
          quantity: item.quantity,
          rule: item.loyaltyRule,
        })),
        discountTotal: roundMoney(
          sumMoney([goodsDiscount, pointsDiscount]),
        ).toFixed(2),
        earnRate: cart.loyalty.earnRate,
      })
    : 0;

  return (
    <div className="border border-[var(--color-shop-divider)] border-t-[3px] border-t-[var(--color-action-primary)] bg-white">
      {/* Items list */}
      <div className="px-6 py-6 divide-y divide-neutral-100">
        {cart.items.map((item) => (
          <OrderItem key={item.id} item={item} locale={locale} />
        ))}
      </div>

      {/* Subtotal */}
      <div className="px-6 py-4 border-t border-neutral-200 flex justify-between items-center">
        <span className="text-[0.8125rem] text-neutral-700">
          {t("subtotal")}
        </span>
        <span
          className="text-[0.9375rem] font-semibold text-neutral-900 tabular-nums"
          dir="ltr"
        >
          {formatAED(subtotal, locale)}
        </span>
      </div>

      {goodsDiscount > 0 && (
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-700">
            {t("discount")}{" "}
            <span
              dir="ltr"
              className="font-semibold text-neutral-900 uppercase"
            >
              {appliedCoupon?.code}
            </span>
          </span>
          <span
            className="text-[0.9375rem] font-semibold tabular-nums"
            style={{ color: "var(--color-positive)" }}
            dir="ltr"
          >
            -{formatAED(goodsDiscount, locale)}
          </span>
        </div>
      )}

      {pointsDiscount > 0 && (
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-700">
            {t("pointsLine")}
            <span dir="ltr" className="text-neutral-500">
              {" "}· {pointsInEffect.toLocaleString("en-US")}
            </span>
          </span>
          <span
            className="text-[0.9375rem] font-semibold tabular-nums"
            style={{ color: "var(--color-positive)" }}
            dir="ltr"
          >
            -{formatAED(pointsDiscount, locale)}
          </span>
        </div>
      )}

      {/* Shipping line */}
      <div className="px-6 py-4 border-t border-neutral-200">
        {isResolvingShipping ? (
          <p className="text-[0.8125rem] text-neutral-500">
            {t("shippingSection.resolving")}
          </p>
        ) : quoteRequired ? (
          <div className="flex justify-between items-center">
            <span className="block text-[0.8125rem] text-neutral-700">
              {ts("shipping")}
            </span>
            <span className="text-[0.875rem] text-neutral-500">
              {t("orderSummaryPanel.shippingToBeQuoted")}
            </span>
          </div>
        ) : hasAddress && method !== null && shippingPrice !== null ? (
          <div className="flex justify-between items-center">
            <div>
              <span className="block text-[0.8125rem] text-neutral-700">
                {ts("shipping")}
              </span>
              <span className="block text-[0.6875rem] text-neutral-500 mt-0.5">
                {locale === "ar"
                  ? method.nameAr
                  : locale === "ru"
                    ? method.nameRu
                    : method.nameEn}
              </span>
            </div>
            {shippingIsFree || shippingPrice === 0 ? (
              <span className="text-[0.875rem] font-semibold text-[var(--color-positive)]">
                {t("freeShipping")}
              </span>
            ) : (
              <span
                className="text-[0.875rem] font-medium text-neutral-900 tabular-nums"
                dir="ltr"
              >
                {formatAED(shippingPrice, locale)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-neutral-500">
            {t("orderSummaryPanel.enterAddressNote")}
          </p>
        )}
      </div>

      {/* Free shipping reward line */}
      {hasAddress &&
        !quoteRequired &&
        freeShippingThresholdAed !== null && (
          <div className="px-6 pb-4">
            {shippingIsFree ? (
              <p
                className="text-[0.8125rem] font-medium flex items-center gap-1.5"
                style={{ color: "var(--color-positive)" }}
              >
                <svg
                  width="12"
                  height="10"
                  viewBox="0 0 12 10"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M1 5L4 8L11 1"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t("freeShippingUnlocked")}
              </p>
            ) : !couponFreeShipping && remainingToFree > 0 ? (
              <p className="text-[0.8125rem] text-neutral-600">
                {t.rich("addForFreeShipping", {
                  amt: () => (
                    <span dir="ltr" className="tabular-nums">
                      {formatAED(remainingToFree, locale)}
                    </span>
                  ),
                })}
              </p>
            ) : null}
          </div>
        )}

      {/* Total */}
      <div
        className={
          "px-6 py-5 border-t border-neutral-200 flex justify-between items-baseline" +
          (isResolvingShipping ? " opacity-50 transition-opacity" : "")
        }
      >
        <span className="text-[0.9375rem] font-semibold text-neutral-900">
          {quoteRequired ? t("heldOrder.provisionalTotal") : t("total")}
        </span>
        <span
          className="text-[1.75rem] font-bold tracking-tight text-neutral-900 tabular-nums leading-none"
          dir="ltr"
        >
          {formatAED(grandTotal, locale)}
        </span>
      </div>

      {vatAed > 0 && (
        <div
          className={
            "px-6 pb-5 flex justify-between items-center -mt-3" +
            (isResolvingShipping ? " opacity-50 transition-opacity" : "")
          }
        >
          <span className="text-[0.6875rem] text-neutral-500">
            {t("vatIncluded", { rate: Math.round(vatRate * 100) })}
          </span>
          <span
            className="text-[0.6875rem] text-neutral-500 tabular-nums"
            dir="ltr"
          >
            {formatAED(vatAed, locale)}
          </span>
        </div>
      )}
      {quoteRequired && (
        <p
          className={
            "px-6 pb-5 -mt-3 text-[0.6875rem] text-neutral-500 leading-snug" +
            (isResolvingShipping ? " opacity-50 transition-opacity" : "")
          }
        >
          {t("heldOrder.provisionalTotalNote")}
        </p>
      )}

      {points > 0 && (
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-between items-start gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-neutral-700">
              <span
                style={{ color: "var(--color-accent)", display: "flex" }}
              >
                <StarOutlineIcon size={14} />
              </span>
              {t("pointsEarnLabel")}
            </span>
            <span className="block text-[0.6875rem] text-neutral-500 mt-0.5">
              {t("pointsEarnNote")}
            </span>
          </div>
          <span className="text-[0.875rem] font-semibold text-neutral-900 shrink-0">
            <span dir="ltr" className="tabular-nums">
              {points.toLocaleString("en-US")}
            </span>{" "}
            {t("pointsUnit")}
          </span>
        </div>
      )}

      {/* Promo */}
      <div className="px-6 py-5 border-t border-neutral-200">
        <PromoCodeBlock />
      </div>

      {pointsBalance > 0 && (
        <div className="px-6 py-5 border-t border-neutral-200">
          <LoyaltyPointsBlock />
        </div>
      )}

      {/* Verification reminder note (only when required) */}
      {verification.required && verification.status !== "APPROVED" && (
        <div className="px-6 pb-5">
          <div className="flex items-start gap-2.5 p-3.5 border border-[var(--color-action-primary)]/20 bg-[var(--color-action-primary)]/[0.03]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="shrink-0 mt-0.5"
            >
              <path
                d="M7 1L1 4V8C1 10.76 3.68 13.26 7 14C10.32 13.26 13 10.76 13 8V4L7 1Z"
                stroke="var(--color-action-primary)"
                strokeWidth="1.2"
              />
              <path
                d="M7 5V8"
                stroke="var(--color-action-primary)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="7" cy="10" r="0.6" fill="var(--color-action-primary)" />
            </svg>
            <p className="text-[0.6875rem] text-[var(--color-action-primary)] leading-relaxed">
              {t("idRequiredNote")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
