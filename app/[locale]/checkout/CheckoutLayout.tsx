"use client";

import { BRAND } from "@/lib/config/brand";
import { useRef } from "react";
import BrandMark from "@/components/ui/BrandMark";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import ContactSection from "@/components/checkout/ContactSection";
import BillingDetailsSection from "@/components/checkout/BillingDetailsSection";
import ShippingMethodSection from "@/components/checkout/ShippingMethodSection";
import VerificationSection from "@/components/checkout/VerificationSection";
import PaymentSection from "@/components/checkout/PaymentSection";
import CheckoutSteps from "@/components/checkout/CheckoutSteps";
import OrderSummary, { useSummaryTotal } from "@/components/checkout/OrderSummary";
import SummaryDisclosure from "@/components/checkout/SummaryDisclosure";
import { formatAED } from "@/lib/utils/currency";
import {
  CheckoutFormProvider,
  useCheckoutForm,
  type AppliedCoupon,
} from "./CheckoutFormContext";
import PlaceOrderButton from "@/components/checkout/PlaceOrderButton";
import type { CheckoutProjection } from "@/lib/db/queries/checkout";

interface CheckoutLayoutProps {
  projection: CheckoutProjection;
  locale: "en" | "ar" | "ru";
  availableReward: AppliedCoupon | null;
}

export default function CheckoutLayout({
  projection,
  locale,
  availableReward,
}: CheckoutLayoutProps) {
  const { customer, addresses, defaultAddressId, verification, serviceableCountries } = projection;
  const seedAddressId = defaultAddressId ?? addresses[0]?.id ?? null;

  const hasAddress = addresses.length > 0;

  return (
    <CheckoutFormProvider defaultAddressId={seedAddressId} initialMethods={projection.methods} initialSelectedMethodId={projection.selectedMethodId} initialAvailableReward={availableReward} initialQuoteRequired={projection.quoteRequired} initialFreeShippingThresholdAed={projection.freeShippingThresholdAed} pointsBalance={projection.customer.loyaltyPoints} redeemRule={projection.redeemRule} goodsSubtotalAed={projection.cart.totals.subtotalAed}>
      <div className="min-h-dvh bg-white">
        <div className="mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 min-h-dvh">
          <div className="bg-white order-2 lg:order-1 relative">
            <div className="max-w-[580px] pt-12 lg:pt-16 pb-28">
              <CheckoutHeader />

              <CheckoutSteps current="details" />

              <ContactSection email={customer.email} />

              <BillingDetailsSection
                addresses={addresses}
                defaultAddressId={defaultAddressId}
                serviceableCountries={serviceableCountries}
              />

              <ShippingMethodSection locale={locale} hasAddress={hasAddress} />

              <VerificationSection
                verification={verification}
                locale={locale}
              />

              <PaymentSection />

              <TermsAgreement locale={locale} />
            </div>
          </div>

          <aside className="order-1 lg:order-2 bg-white">
            <div className="lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto pt-12 lg:pt-16 pb-12 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              <SummaryAside
                projection={projection}
                locale={locale}
                hasAddress={hasAddress}
              />
            </div>
          </aside>
        </div>
      </div>
    </CheckoutFormProvider>
  );
}

function SummaryAside({
  projection,
  locale,
  hasAddress,
}: {
  projection: CheckoutProjection;
  locale: "en" | "ar" | "ru";
  hasAddress: boolean;
}) {
  const grandTotal = useSummaryTotal(projection, hasAddress);

  return (
    <SummaryDisclosure totalLabel={formatAED(grandTotal, locale)}>
      <OrderSummary
        projection={projection}
        locale={locale}
        hasAddress={hasAddress}
      />
    </SummaryDisclosure>
  );
}

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

function TermsAgreement({ locale }: { locale: "en" | "ar" | "ru" }) {
  const t = useTranslations("checkout.terms");
  const { termsAccepted, setTermsAccepted } = useCheckoutForm();
  const termsInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2 flex flex-col gap-6">
      <p className="text-[0.8125rem] text-neutral-500 leading-relaxed">
        {t.rich("privacyBody", {
          link: (chunks) => (
            <Link
              href="/privacy" target="_blank" rel="noopener noreferrer"
              className="text-neutral-900 underline underline-offset-[3px] hover:text-[var(--color-content-link)] transition-colors"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>

      <label className="flex items-start gap-3 cursor-pointer group">
        <span
          className={
            "relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors has-[:focus]:outline has-[:focus]:outline-2 has-[:focus]:outline-offset-2 has-[:focus]:outline-[var(--color-action-primary)] " +
            (termsAccepted
              ? "bg-[var(--color-action-primary)] border-[var(--color-action-primary)]"
              : "bg-white border-neutral-400 group-hover:border-neutral-700")
          }
        >
          <input
            ref={termsInputRef}
            type="checkbox"
            className="sr-only"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          {termsAccepted && (
            <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-[0.8125rem] text-neutral-700 leading-snug pt-0.5">
          {t.rich("agreeBody", {
            link: (chunks) => (
              <Link
                href="/terms" target="_blank" rel="noopener noreferrer"
                className="text-neutral-900 underline underline-offset-[3px] hover:text-[var(--color-content-link)] transition-colors"
              >
                {chunks}
              </Link>
            ),
          })}
          <span className="text-[var(--color-error)] ms-1">*</span>
        </span>
      </label>

      <PlaceOrderButton locale={locale} termsInputRef={termsInputRef} />
    </div>
  );
}
