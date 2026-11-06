"use client";

import { BRAND } from "@/lib/config/brand";
import { useState, useTransition } from "react";
import FadeImage from "@/components/ui/FadeImage";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { FloatingInput, SectionHeading } from "./FormPrimitives";
import CheckoutSteps from "./CheckoutSteps";
import CheckoutBrandBar from "./CheckoutBrandBar";
import SummaryDisclosure from "./SummaryDisclosure";
import { submitMockPaymentAction } from "@/lib/actions/mock-payment";
import type { OrderConfirmationProjection } from "@/lib/db/queries/order";
import { getCountryName } from "@/lib/data/countries";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface Props {
  projection: OrderConfirmationProjection;
  locale: "en" | "ar" | "ru";
}

const DECLINED_CARD = "4000000000000002";
const SUCCESS_CARD_PAN = "4111 1111 1111 1111";
const SUCCESS_CARD_NAME = "Test Customer";
const SUCCESS_CARD_EXPIRY = "12/30";
const SUCCESS_CARD_CVC = "123";

const LADDER_ROW = "px-6 py-4 border-t border-neutral-200 flex justify-between items-center";
const LADDER_LABEL = "text-[0.8125rem] text-neutral-700";
const LADDER_MONEY = "text-[0.9375rem] font-semibold text-neutral-900 tabular-nums";
const CAPS_LABEL =
  "text-[0.6875rem] font-bold tracking-[0.16em] uppercase text-neutral-900 rtl:tracking-normal rtl:normal-case rtl:text-[0.8125rem]";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function brandOf(pan: string): string {
  if (pan.startsWith("4")) return "VISA";
  if (pan.startsWith("5")) return "MASTERCARD";
  if (pan.startsWith("3")) return "AMEX";
  return "CARD";
}

function expiryIsValid(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length !== 4) return false;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const end = new Date(year, month, 1);
  return end > now;
}

export default function MockPaymentForm({ projection, locale }: Props) {
  const t = useTranslations("checkout.pay");
  const tc = useTranslations("checkout");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [pan, setPan] = useState(SUCCESS_CARD_PAN);
  const [name, setName] = useState(SUCCESS_CARD_NAME);
  const [expiry, setExpiry] = useState(SUCCESS_CARD_EXPIRY);
  const [cvc, setCvc] = useState(SUCCESS_CARD_CVC);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = projection.shippingAddress;
  const productItems = projection.items.filter((i) => i.itemType === "PRODUCT");
  const addonItems = projection.items.filter((i) => i.itemType === "ADDON");
  const cleanPan = digitsOnly(pan);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (cleanPan.length < 13 || cleanPan.length > 19) {
      next.pan = t("cardNumberError");
    }
    if (name.trim().length === 0) {
      next.name = t("nameError");
    }
    if (!expiryIsValid(expiry)) {
      next.expiry = t("expiryError");
    }
    const cleanCvc = digitsOnly(cvc);
    if (cleanCvc.length < 3 || cleanCvc.length > 4) {
      next.cvc = t("cvcError");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    setError(null);
    setDeclined(false);
    if (!validate()) return;

    const outcome = cleanPan === DECLINED_CARD ? "DECLINED" : "SUCCESS";

    startTransition(async () => {
      const result = await submitMockPaymentAction({
        orderId: projection.id,
        outcome,
        locale,
      });

      if (!result.success) {
        setError(t(`errors.${result.errorCode}`));
        return;
      }

      if (result.data.outcome === "DECLINED" || !result.data.redirectUrl) {
        setDeclined(true);
        return;
      }

      startNavigationProgress();
      router.push(result.data.redirectUrl);
    });
  }

  return (
    <div className="min-h-dvh bg-white">
      <CheckoutBrandBar />
      <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 min-h-dvh">
        <div className="bg-white order-2 lg:order-1 relative">
          <div className="max-w-[580px] pt-4 lg:pt-16 pb-28">
            <CheckoutSteps current="payment" />

            <div className="mb-10 border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
                <span className="inline-flex items-center gap-2 text-[0.75rem] font-bold tracking-[0.12em] uppercase text-neutral-500 rtl:tracking-normal rtl:normal-case rtl:text-[0.8125rem]">
                  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
                    <path
                      d="M3 6V4a3 3 0 016 0v2"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="1"
                      y="6"
                      width="10"
                      height="7"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                  {t("secureHeading")}
                </span>
                <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.12em] uppercase text-amber-900 rtl:tracking-normal rtl:normal-case">
                  {t("sandboxChip")}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[0.8125rem] text-neutral-500">
                  {t("payee")}
                </span>
                <span
                  dir="ltr"
                  className="text-[0.9375rem] font-semibold text-neutral-900"
                >
                  {BRAND.name}
                </span>
              </div>
            </div>

            <div className="mb-10 border border-neutral-200 border-s-[3px] border-s-[var(--color-status-warning)] bg-white px-5 py-4">
              <p className="text-[0.8125rem] font-semibold text-[#92400e] leading-snug">
                {t("sandboxTitle")}
              </p>
              <p className="text-[0.75rem] text-neutral-700 leading-relaxed mt-1">
                {t("sandboxBody")}
              </p>
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <p className={CAPS_LABEL + " block mb-3"}>
                  {t("testCardsTitle")}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[0.8125rem] text-neutral-700 tabular-nums"
                      dir="ltr"
                    >
                      4111 1111 1111 1111
                    </span>
                    <span className="text-[0.75rem] text-neutral-500">
                      {t("testCardSuccess")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[0.8125rem] text-neutral-700 tabular-nums"
                      dir="ltr"
                    >
                      4000 0000 0000 0002
                    </span>
                    <span className="text-[0.75rem] text-neutral-500">
                      {t("testCardDeclined")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {declined && (
              <div className="mb-10 border border-neutral-200 border-s-[3px] border-s-[var(--color-action-danger)] bg-white px-5 py-4">
                <p className="text-[0.8125rem] font-semibold text-[var(--color-action-danger)] leading-snug">
                  {t("declinedTitle")}
                </p>
                <p className="text-[0.75rem] text-neutral-700 leading-relaxed mt-1">
                  {t("declinedBody")}
                </p>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0 flex-1">
                <SectionHeading title={t("cardHeading")} />
              </div>
              <p className="shrink-0 text-[0.8125rem] text-neutral-500">
                {t("payingFor", { orderNumber: projection.orderNumber })}
                {projection.quoteRequestNumber && (
                  <>
                    {" · "}
                    {t("payingForQuote", {
                      quoteNumber: projection.quoteRequestNumber,
                    })}
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-4 mb-14">
              <div className="relative">
                <FloatingInput
                  label={t("cardNumber")}
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  disabled={isPending}
                  error={fieldErrors.pan ?? null}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                />
                {cleanPan.length >= 1 && (
                  <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[0.625rem] font-bold tracking-wide text-neutral-400">
                    {brandOf(cleanPan)}
                  </span>
                )}
              </div>

              <FloatingInput
                label={t("nameOnCard")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                error={fieldErrors.name ?? null}
                autoComplete="off"
              />

              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label={t("expiry")}
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  disabled={isPending}
                  error={fieldErrors.expiry ?? null}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                />
                <FloatingInput
                  label={t("cvc")}
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  disabled={isPending}
                  error={fieldErrors.cvc ?? null}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="mb-10">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[0.8125rem] font-semibold text-neutral-900">
                  {t("billingAddress")}
                </p>
                <p className="text-[0.8125rem] text-neutral-500">
                  {t("billingSet")}
                </p>
              </div>
              <p className="mt-2 text-[0.875rem] text-neutral-700 leading-relaxed">
                {address.addressLine1}
                {address.addressLine2 && <>, {address.addressLine2}</>}
                <br />
                {address.city}, {address.emirate}
                {address.postalCode && <> {address.postalCode}</>},{" "}
                {getCountryName(address.country)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              aria-disabled={isPending}
              className="h-14 w-full bg-[var(--color-action-primary)] text-white text-body-sm font-bold tracking-[0.2em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-ui hover:bg-[var(--color-action-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? t("submitting")
                : t("payNow", {
                    total: formatAED(projection.totalAed, locale),
                  })}
            </button>

            <p className="text-[0.75rem] text-neutral-500 mt-3 leading-relaxed">
              {isPending ? t("dontClose") : t("noChargeNote")}
            </p>

            {error && (
              <p className="text-[0.8125rem] text-[var(--color-error)] mt-3 leading-snug">
                {error}
              </p>
            )}

            {projection.quoteRequestNumber && (
              <div className="mt-6">
                <Link
                  href={`/account/orders/${projection.id}`}
                  className="text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] hover:text-[var(--color-content-link)] transition-colors"
                >
                  {t("contactTeam")}
                </Link>
              </div>
            )}
          </div>
        </div>

        <aside className="order-1 lg:order-2 bg-white">
          <div className="lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto pt-0 lg:pt-16 pb-0 lg:pb-12 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <SummaryDisclosure totalLabel={formatAED(projection.totalAed, locale)}>
            <div className="border border-[var(--color-shop-divider)] border-t-[3px] border-t-[var(--color-action-primary)] bg-white">
              <div className="px-6 py-6 divide-y divide-neutral-100">
                {productItems.map((product) => {
                  const children = addonItems.filter(
                    (a) => a.parentOrderItemId === product.id,
                  );
                  return (
                    <div
                      key={product.id}
                      className="py-5 first:pt-0 last:pb-0"
                    >
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

              <div className={LADDER_ROW}>
                <span className={LADDER_LABEL}>{tc("subtotal")}</span>
                <span className={LADDER_MONEY} dir="ltr">
                  {formatAED(projection.subtotalAed, locale)}
                </span>
              </div>

              {projection.addonTotalAed > 0 && (
                <div className={LADDER_ROW}>
                  <span className={LADDER_LABEL}>{t("addons")}</span>
                  <span className={LADDER_MONEY} dir="ltr">
                    {formatAED(projection.addonTotalAed, locale)}
                  </span>
                </div>
              )}

              <div className={LADDER_ROW}>
                <span className={LADDER_LABEL}>{t("shipping")}</span>
                {projection.shippingCostAed === 0 &&
                projection.shippingMethod !== null ? (
                  <span className="text-[0.9375rem] font-semibold text-[var(--color-positive)]">
                    {tc("freeShipping")}
                  </span>
                ) : (
                  <span className={LADDER_MONEY} dir="ltr">
                    {formatAED(projection.shippingCostAed, locale)}
                  </span>
                )}
              </div>

              {projection.discountAmountAed > 0 && (
                <div className={LADDER_ROW}>
                  <span className={LADDER_LABEL}>{t("discount")}</span>
                  <span
                    className="text-[0.9375rem] font-semibold tabular-nums"
                    style={{ color: "var(--color-positive)" }}
                    dir="ltr"
                  >
                    -{formatAED(projection.discountAmountAed, locale)}
                  </span>
                </div>
              )}

              <div className="px-6 py-5 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-[0.9375rem] font-semibold text-neutral-900">
                  {t("total")}
                </span>
                <span
                  className="text-[1.75rem] font-bold tracking-tight text-neutral-900 tabular-nums leading-none"
                  dir="ltr"
                >
                  {formatAED(projection.totalAed, locale)}
                </span>
              </div>

              {projection.taxAmountAed > 0 && (
                <div className="px-6 pb-5 -mt-3 flex justify-between items-center">
                  <span className="text-[0.6875rem] text-neutral-500">
                    {tc("vatIncluded", {
                      rate: Math.round(projection.vatRate * 100),
                    })}
                  </span>
                  <span
                    className="text-[0.6875rem] text-neutral-500 tabular-nums"
                    dir="ltr"
                  >
                    {formatAED(projection.taxAmountAed, locale)}
                  </span>
                </div>
              )}
            </div>

            <div className="border border-neutral-200 bg-white mt-6">
              <div className="px-6 py-5">
                <p className={CAPS_LABEL + " block mb-4"}>{t("afterTitle")}</p>
                <ol className="flex flex-col gap-3">
                  {[t("afterStep1"), t("afterStep2"), t("afterStep3")].map(
                    (step, i) => (
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
                    ),
                  )}
                </ol>
              </div>
            </div>
            </SummaryDisclosure>
          </div>
        </aside>
      </div>
    </div>
  );
}
