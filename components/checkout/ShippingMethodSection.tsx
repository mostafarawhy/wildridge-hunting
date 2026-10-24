"use client";

import { useTranslations } from "next-intl";
import { SectionHeading } from "./FormPrimitives";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";
import { formatAED } from "@/lib/utils/currency";

interface Props {
  locale: "en" | "ar" | "ru";
  hasAddress: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────
 * ShippingMethodSection
 * ─────────────────────────────────────────────────────────────────────── */

export default function ShippingMethodSection({ locale, hasAddress }: Props) {
  const t = useTranslations("checkout");
  const { methods, selectedMethodId, setSelectedMethodId, isResolvingShipping, shippingError, quoteRequired } =
    useCheckoutForm();

  function localizedName(m: { nameEn: string; nameAr: string; nameRu: string }) {
    if (locale === "ar") return m.nameAr || m.nameEn;
    if (locale === "ru") return m.nameRu || m.nameEn;
    return m.nameEn;
  }

  let body: React.ReactNode;

  if (shippingError) {
    body = (
      <p className="text-[0.8125rem] text-[var(--color-status-danger-text)]">
        {t("shippingSection.error")}
      </p>
    );
  } else if (!hasAddress) {
    body = (
      <p className="text-[0.8125rem] text-neutral-500">
        {t("orderSummaryPanel.enterAddressNote")}
      </p>
    );
  } else if (quoteRequired) {
    body = (
      <p className="text-[0.8125rem] text-neutral-500">
        {t("shippingSection.quoteNote")}
      </p>
    );
  } else if (methods.length === 0 && !isResolvingShipping) {
    body = (
      <p className="text-[0.8125rem] text-neutral-500">
        {t("shippingSection.unavailableNote")}
      </p>
    );
  } else {
    body = (
      <>
        {isResolvingShipping && (
          <p className="text-[0.8125rem] text-neutral-500 mb-3">
            {t("shippingSection.resolving")}
          </p>
        )}
        <div
          className={
            "flex flex-col gap-3" +
            (isResolvingShipping ? " opacity-60 pointer-events-none" : "")
          }
        >
          {methods.map((m) => {
            const isSelected = selectedMethodId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMethodId(m.id)}
                className={
                  "text-start px-5 py-4 border bg-white flex items-start gap-3 transition-colors " +
                  (isSelected
                    ? "border-[var(--color-action-primary)]"
                    : "border-neutral-200 hover:border-neutral-400")
                }
              >
                <span
                  className={
                    "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors " +
                    (isSelected ? "border-[var(--color-action-primary)]" : "border-neutral-300")
                  }
                >
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-action-primary)]" />
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-neutral-900 leading-snug">
                    {localizedName(m)}
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  {m.isFree ? (
                    <span
                      className="font-semibold"
                      style={{ color: "var(--color-positive)" }}
                    >
                      {t("freeShipping")}
                    </span>
                  ) : (
                    <span dir="ltr" className="tabular-nums text-[0.9375rem] font-medium text-neutral-900">
                      {formatAED(m.priceAed, locale)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <section className="mb-12">
      <SectionHeading title={t("shippingSection.title")} />
      {body}
    </section>
  );
}
