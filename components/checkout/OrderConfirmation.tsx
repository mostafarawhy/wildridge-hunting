"use client";

import { BRAND } from "@/lib/config/brand";
import { useState } from "react";
import BrandMark from "@/components/ui/BrandMark";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import FadeImage from "@/components/ui/FadeImage";
import { StarOutlineIcon } from "@/components/ui/icons";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { getImageUrl } from "@/lib/utils/images";
import { getCountryName } from "@/lib/data/countries";
import { retryOrderPaymentAction } from "@/lib/actions/orders";
import type { OrderConfirmationProjection } from "@/lib/db/queries/order";
import type { StoreIdentity } from "@/lib/utils/store-identity";
import DemoEmailNote from "@/components/layout/DemoEmailNote";

interface Props {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
  variant: "confirmed" | "failed";
  store: StoreIdentity;
}

const EYEBROW =
  "text-[0.6875rem] font-bold tracking-[0.16em] uppercase text-neutral-500 rtl:tracking-normal rtl:normal-case rtl:text-[0.8125rem]";
const BUTTON =
  "inline-flex items-center justify-center gap-2 h-14 px-8 w-full sm:w-auto text-[0.75rem] font-bold tracking-[0.2em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.9375rem] transition-colors";
const PRIMARY =
  BUTTON +
  " bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed";
const OUTLINE =
  BUTTON +
  " border-[1.5px] border-[var(--color-action-primary)] text-[var(--color-action-primary)] hover:bg-[var(--color-action-secondary-hover-bg)]";
const TEXT_LINK = "text-[0.8125rem] underline underline-offset-[3px]";
const CARD = "border border-[var(--color-shop-divider)]";

export default function OrderConfirmation({
  projection,
  locale,
  variant,
  store,
}: Props) {
  const t = useTranslations("checkout.success");
  const failed = variant === "failed";

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto max-w-[1120px] px-6 sm:px-8 py-10 sm:py-14">
        <CheckoutHeader />
        {failed ? (
          <FailedBody projection={projection} locale={locale} t={t} />
        ) : (
          <ConfirmedBody
            projection={projection}
            locale={locale}
            store={store}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

type SuccessT = ReturnType<typeof useTranslations>;

function CheckoutHeader() {
  const tNav = useTranslations("nav");
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-4 mb-14 group"
      aria-label={tNav("aria_home")}
    >
      <BrandMark size={104} />
      <span
        dir="ltr"
        className="brand-wordmark brand-wordmark--checkout text-[var(--primitive-black)]"
      >
        {BRAND.wordmark}
      </span>
    </Link>
  );
}

function shippingMethodNameOf(
  projection: OrderConfirmationProjection,
  locale: "en" | "ar" | "ru",
): string | null {
  const method = projection.shippingMethod;
  if (!method) return null;
  if (locale === "ar") return method.nameAr;
  if (locale === "ru") return method.nameRu ?? method.nameEn;
  return method.nameEn;
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConfirmedBody({
  projection,
  locale,
  store,
  t,
}: {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
  store: StoreIdentity;
  t: SuccessT;
}) {
  const tc = useTranslations("checkout");
  const tr = useTranslations("checkout.receipt");

  const lastSettlement =
    projection.settlements[projection.settlements.length - 1];
  const paidOnIso = projection.paidAt ?? lastSettlement?.paidAt ?? null;
  const paid = paidOnIso !== null;
  const shipped =
    projection.status === "SHIPPED" || projection.status === "DELIVERED";
  const delivered = projection.status === "DELIVERED";
  const shippingMethodName = shippingMethodNameOf(projection, locale);
  const address = projection.shippingAddress;
  const paymentLabel =
    projection.paymentProvider === "NGENIUS"
      ? tr("paymentCard")
      : tr("paymentOffline");

  const steps = [
    {
      key: "placed",
      label: t("stepPlaced"),
      done: paid,
      date: formatDisplayDate(projection.createdAt, locale),
    },
    {
      key: "paid",
      label: t("stepPaid"),
      done: paid,
      date: paidOnIso ? formatDisplayDate(paidOnIso, locale) : null,
    },
    { key: "shipped", label: t("stepShipped"), done: shipped, date: null },
    { key: "delivered", label: t("stepDelivered"), done: delivered, date: null },
  ];

  const nextSteps = [t("next1"), t("next2")];
  if (projection.regulated) nextSteps.push(t("next3Id"));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="order-1 lg:col-start-1 lg:row-start-1 flex flex-col gap-8">
        <div>
          <div className="inline-flex items-center justify-center w-11 h-11 mb-6 bg-[var(--color-action-primary)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10L8.5 14.5L16 6"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className={EYEBROW + " mb-2"}>
            {t("orderLabel")}{" "}
            <span dir="ltr" className="tabular-nums">
              {projection.orderNumber}
            </span>
          </p>
          <h1 className="text-[1.75rem] sm:text-[2rem] font-bold leading-tight text-[var(--color-action-primary)] mb-3">
            {t("title")}
          </h1>
          <p className="text-[0.9375rem] text-neutral-600 leading-relaxed">
            {t("subtitle", { email: projection.customerEmail })}
          </p>
          <DemoEmailNote />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link href={`/account/orders/${projection.id}`} className={PRIMARY}>
            {t("viewOrder")}
          </Link>
          <Link
            href={`/receipt/${projection.id}?print=1`}
            target="_blank"
            rel="noopener"
            className={OUTLINE}
          >
            <DownloadIcon />
            {t("saveReceipt")}
          </Link>
          <Link
            href="/shop"
            className={TEXT_LINK + " text-neutral-900 text-center sm:ms-2"}
          >
            {t("continueShopping")}
          </Link>
        </div>

        <div className={CARD + " px-5 py-5"}>
          <div className="hidden sm:grid grid-cols-4 gap-4">
            {steps.map((step) => (
              <div key={step.key}>
                <div
                  className={
                    "h-[3px] mb-3 " +
                    (step.done
                      ? "bg-[var(--color-action-primary)]"
                      : "bg-neutral-200")
                  }
                />
                <p
                  className={
                    "text-[0.8125rem] " +
                    (step.done
                      ? "font-bold text-neutral-900"
                      : "text-neutral-500")
                  }
                >
                  {step.label}
                </p>
                {step.date && step.done && (
                  <p className="text-[0.75rem] text-neutral-500 mt-0.5">
                    {step.date}
                  </p>
                )}
              </div>
            ))}
          </div>
          <ul className="sm:hidden flex flex-col gap-3">
            {steps.map((step) => (
              <li key={step.key} className="flex items-center gap-3">
                <span
                  className={
                    step.done
                      ? "text-[var(--color-action-primary)]"
                      : "text-neutral-400"
                  }
                  aria-hidden="true"
                >
                  {step.done ? "●" : "○"}
                </span>
                <span
                  className={
                    "text-[0.8125rem] flex-1 " +
                    (step.done
                      ? "font-bold text-neutral-900"
                      : "text-neutral-500")
                  }
                >
                  {step.label}
                </span>
                {step.date && step.done && (
                  <span className="text-[0.75rem] text-neutral-500">
                    {step.date}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
        <div
          className={
            CARD +
            " border-t-[3px] border-t-[var(--color-action-primary)] bg-white lg:sticky lg:top-8"
          }
        >
          <div className="px-6 py-4 border-b border-[var(--color-shop-divider)] flex justify-between items-center gap-4">
            <span className={EYEBROW}>{t("orderSummary")}</span>
            <span className="text-[0.875rem] font-semibold text-neutral-900">
              {store.name}
            </span>
          </div>

          <div className="px-6 py-4 border-b border-[var(--color-shop-divider)] space-y-2">
            <MetaRow label={tr("orderNumber")}>
              <span dir="ltr" className="tabular-nums">
                {projection.orderNumber}
              </span>
            </MetaRow>
            <MetaRow label={tr("orderDate")}>
              {formatDisplayDate(projection.createdAt, locale)}
            </MetaRow>
            <MetaRow label={tr("payment")}>
              {paidOnIso
                ? `${paymentLabel} · ${formatDisplayDate(paidOnIso, locale)}`
                : paymentLabel}
            </MetaRow>
          </div>

          <ItemRows projection={projection} locale={locale} />
          <Ladder
            projection={projection}
            locale={locale}
            t={t}
            terminalLabel={t("total")}
          />
        </div>
      </div>

      <div className="order-3 lg:col-start-1 lg:row-start-2 flex flex-col gap-8">
        <div className={CARD + " px-6 py-5"}>
          <p className={EYEBROW + " mb-3"}>{t("delivery")}</p>
          <p className="text-[0.9375rem] font-semibold text-neutral-900">
            {address.fullName}
          </p>
          <p className="text-[0.875rem] text-neutral-600 mt-1 leading-relaxed">
            {address.addressLine1}
            {address.addressLine2 && <>, {address.addressLine2}</>}
            <br />
            {address.city}, {address.emirate}
            {address.postalCode && <> {address.postalCode}</>}
            <br />
            {getCountryName(address.country)}
          </p>
          {shippingMethodName && (
            <p className="text-[0.8125rem] text-neutral-500 mt-3">
              {shippingMethodName}
            </p>
          )}
        </div>

        <div className={CARD + " px-6 py-5"}>
          <p className={EYEBROW + " mb-4"}>{t("nextTitle")}</p>
          <ol className="flex flex-col gap-3">
            {nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 flex h-5 w-5 items-center justify-center border border-[var(--color-action-primary)] text-[0.625rem] font-bold text-[var(--color-action-primary)] tabular-nums"
                  dir="ltr"
                >
                  {i + 1}
                </span>
                <span className="text-[0.8125rem] text-neutral-600 leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {projection.loyaltyPointsEarned > 0 &&
          projection.loyaltyPointsFrozen && (
            <div
              className={
                CARD + " px-6 py-4 flex justify-between items-start gap-4"
              }
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-neutral-700">
                  <span
                    style={{ color: "var(--color-accent)", display: "flex" }}
                  >
                    <StarOutlineIcon size={14} />
                  </span>
                  {tc("pointsEarnLabel")}
                </span>
                <span className="block text-[0.6875rem] text-neutral-500 mt-0.5">
                  {tc("pointsEarnNote")}
                </span>
              </div>
              <span className="text-[0.875rem] font-semibold text-neutral-900 shrink-0">
                <span dir="ltr" className="tabular-nums">
                  {projection.loyaltyPointsEarned.toLocaleString("en-US")}
                </span>{" "}
                {tc("pointsUnit")}
              </span>
            </div>
          )}

        <p className="text-[0.875rem] text-neutral-600">
          {t("helpPrompt")}{" "}
          <Link
            href={`/account/support?order=${projection.id}`}
            className={TEXT_LINK + " text-[var(--color-action-primary)]"}
          >
            {t("contactSupport")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className={EYEBROW}>{label}</span>
      <span className="text-[0.8125rem] text-neutral-700">{children}</span>
    </div>
  );
}

function ItemRows({
  projection,
  locale,
}: {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
}) {
  const tc = useTranslations("checkout");
  const productItems = projection.items.filter((i) => i.itemType === "PRODUCT");
  const addonItems = projection.items.filter((i) => i.itemType === "ADDON");

  return (
    <div className="px-6 py-6 divide-y divide-neutral-100">
      {productItems.map((product) => {
        const children = addonItems.filter(
          (a) => a.parentOrderItemId === product.id,
        );
        return (
          <div key={product.id} className="py-5 first:pt-0 last:pb-0">
            <div className="flex items-start gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0">
                <div className="relative h-full w-full overflow-hidden border border-neutral-200 bg-white">
                  {product.imageUrl ? (
                    <FadeImage
                      src={getImageUrl(product.imageUrl)}
                      alt={product.name}
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
                  ×{product.quantity}
                </span>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[0.875rem] font-semibold text-neutral-900 leading-snug">
                  {product.name}
                </p>
                {product.quantity > 1 && (
                  <p className="text-[0.75rem] text-neutral-500 leading-snug mt-1">
                    {tc.rich("unitEach", {
                      price: () => (
                        <span dir="ltr" className="tabular-nums">
                          {formatAED(product.unitPriceAed, locale)}
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
                {formatAED(product.lineTotalAed, locale)}
              </p>
            </div>

            {children.map((addon) => (
              <div
                key={addon.id}
                className="flex items-start gap-4 mt-3 ps-[88px]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] text-neutral-500 leading-snug">
                    + {addon.name}
                  </p>
                  <p
                    className="text-[0.6875rem] text-neutral-400 leading-snug mt-0.5 tabular-nums"
                    dir="ltr"
                  >
                    {formatAED(addon.unitPriceAed, locale)} ×{" "}
                    {addon.quantity}
                  </p>
                </div>
                <p
                  className="text-[0.8125rem] text-neutral-500 shrink-0 tabular-nums"
                  dir="ltr"
                >
                  {formatAED(addon.lineTotalAed, locale)}
                </p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Ladder({
  projection,
  locale,
  t,
  terminalLabel,
}: {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
  t: SuccessT;
  terminalLabel: string;
}) {
  const tc = useTranslations("checkout");
  const taxAed = projection.taxAmountAed;
  const effectiveRate = Math.round(projection.vatRate * 100);
  const shippingMethodName = shippingMethodNameOf(projection, locale);

  return (
    <div className="px-6 py-4 border-t border-neutral-200 space-y-2.5">
      <div className="flex justify-between items-center">
        <span className="text-[0.8125rem] text-neutral-500">
          {t("subtotal")}
        </span>
        <span
          className="text-[0.8125rem] text-neutral-700 tabular-nums"
          dir="ltr"
        >
          {formatAED(projection.subtotalAed, locale)}
        </span>
      </div>

      {projection.addonTotalAed > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-500">
            {t("addons")}
          </span>
          <span
            className="text-[0.8125rem] text-neutral-700 tabular-nums"
            dir="ltr"
          >
            {formatAED(projection.addonTotalAed, locale)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <span className="text-[0.8125rem] text-neutral-500">
            {t("shipping")}
          </span>
          {shippingMethodName && (
            <p className="text-[0.6875rem] text-neutral-500">
              {shippingMethodName}
            </p>
          )}
          {projection.discountAmountAed === 0 &&
            projection.couponCode &&
            projection.shippingCostAed === 0 && (
              <p className="text-[0.6875rem] text-[var(--color-positive)]">
                {t("freeShipping")}{" "}
                <span dir="ltr">· {projection.couponCode}</span>
              </p>
            )}
        </div>
        {projection.shippingCostAed === 0 && projection.shippingMethod !== null ? (
          <span className="text-[0.8125rem] font-semibold text-[var(--color-positive)]">
            {tc("freeShipping")}
          </span>
        ) : (
          <span
            className="text-[0.8125rem] text-neutral-700 tabular-nums"
            dir="ltr"
          >
            {formatAED(projection.shippingCostAed, locale)}
          </span>
        )}
      </div>

      {projection.discountAmountAed > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-500">
            {t("discount")}
            {projection.couponCode && (
              <span className="text-neutral-400 ms-1" dir="ltr">
                · {projection.couponCode}
              </span>
            )}
          </span>
          <span
            className="text-[0.8125rem] tabular-nums"
            dir="ltr"
            style={{ color: "var(--color-positive)" }}
          >
            -{formatAED(projection.discountAmountAed, locale)}
          </span>
        </div>
      )}

      {projection.loyaltyPointsUsed > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-500">
            {t("points")}
            <span className="text-neutral-400 ms-1" dir="ltr">
              · {projection.loyaltyPointsUsed.toLocaleString("en-US")}
            </span>
          </span>
          <span
            className="text-[0.8125rem] tabular-nums"
            dir="ltr"
            style={{ color: "var(--color-positive)" }}
          >
            -{formatAED(projection.loyaltyDiscountAmountAed, locale)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-baseline pt-2 border-t border-neutral-100">
        <span className="text-[0.9375rem] font-semibold text-neutral-900">
          {terminalLabel}
        </span>
        <span
          className="text-[1.375rem] font-bold tracking-tight text-neutral-900 tabular-nums leading-none"
          dir="ltr"
        >
          {formatAED(projection.totalAed, locale)}
        </span>
      </div>

      {taxAed > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-[0.8125rem] text-neutral-500">
            {tc("vatIncluded", { rate: effectiveRate })}
          </span>
          <span
            className="text-[0.8125rem] text-neutral-500 tabular-nums"
            dir="ltr"
          >
            {formatAED(taxAed, locale)}
          </span>
        </div>
      )}
    </div>
  );
}

function FailedBody({
  projection,
  locale,
  t,
}: {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
  t: SuccessT;
}) {
  const tp = useTranslations("account.orders.payment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTryAgain() {
    setError(null);
    setLoading(true);
    const result = await retryOrderPaymentAction(
      { orderId: projection.id, expectedTotal: projection.totalAed },
      locale,
    );
    if (result.success) {
      window.location.href = result.data.redirectUrl;
      return;
    }
    setLoading(false);
    setError(tp(`errors.${result.errorCode}`));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="order-1">
        <div className="inline-flex items-center justify-center w-11 h-11 mb-6 border-2 border-[var(--color-action-primary)]">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 6L14 14M14 6L6 14"
              stroke="var(--color-error)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className={EYEBROW + " mb-2"}>
          {t("orderLabel")}{" "}
          <span dir="ltr" className="tabular-nums">
            {projection.orderNumber}
          </span>
        </p>
        <h1 className="text-[1.75rem] sm:text-[2rem] font-bold leading-tight text-[var(--color-action-primary)] mb-3">
          {t("titleFailed")}
        </h1>
        <p className="text-[0.9375rem] text-neutral-600 leading-relaxed mb-8">
          {t("subtitleFailed")}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleTryAgain}
            disabled={loading}
            aria-disabled={loading}
            className={PRIMARY}
          >
            {t("tryAgain")}
          </button>
          <Link href={`/account/orders/${projection.id}`} className={OUTLINE}>
            {t("viewOrder")}
          </Link>
        </div>

        {error && (
          <p
            className="text-[0.8125rem] text-neutral-700 leading-snug mt-4"
            style={{
              borderInlineStart: "3px solid var(--color-action-primary)",
              paddingInlineStart: "0.75rem",
            }}
          >
            {error}
          </p>
        )}

        <p className="text-[0.875rem] text-neutral-600 mt-8">
          {t("stillStuck")}{" "}
          <Link
            href={`/account/support?order=${projection.id}`}
            className={TEXT_LINK + " text-[var(--color-action-primary)]"}
          >
            {t("contactSupport")}
          </Link>
        </p>
      </div>

      <div className="order-2">
        <div className={CARD + " bg-white lg:sticky lg:top-8"}>
          <div className="px-6 py-4 border-b border-[var(--color-shop-divider)]">
            <span className={EYEBROW}>{t("orderSummary")}</span>
          </div>
          <ItemRows projection={projection} locale={locale} />
          <Ladder
            projection={projection}
            locale={locale}
            t={t}
            terminalLabel={t("toPay")}
          />
        </div>
      </div>
    </div>
  );
}
