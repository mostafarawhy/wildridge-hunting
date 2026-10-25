"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuoteStore } from "@/lib/stores/quote-store";
import Drawer from "@/components/ui/Drawer";
import QuoteItemRow from "./QuoteItemRow";
import QuoteSummary from "./QuoteSummary";
import Button from "@/components/ui/Button";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

const QuoteSubmitModal = dynamic(() => import("./QuoteSubmitModal"), {
  ssr: false,
});

interface QuoteDrawerProps {
  addresses: CustomerAddressProjection[];
  serviceableCountries: { code: string; name: string }[];
}

export default function QuoteDrawer({
  addresses,
  serviceableCountries,
}: QuoteDrawerProps) {
  const t = useTranslations("quote");
  const locale = useLocale();
  const router = useRouter();
  const open = useQuoteStore((s) => s.open);
  const closeDrawer = useQuoteStore((s) => s.closeDrawer);
  const lines = useQuoteStore((s) => s.lines);
  const [note, setNote] = useState("");
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitLoaded, setSubmitLoaded] = useState(false);

  return (
    <>
      <Drawer
        open={open}
        onClose={closeDrawer}
        width={440}
        ariaLabel={t("title")}
      >
        <div
          className="flex items-center justify-between px-6 py-5 shrink-0"
          style={{
            borderBottom: "1px solid var(--color-auth-divider)",
            backgroundColor: "var(--color-auth-form-bg)",
          }}
        >
          <h2
            className="text-ui font-bold tracking-widest uppercase"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close quote drawer"
            className="flex items-center justify-center w-8 h-8 cursor-pointer transition-opacity hover:opacity-50"
            style={{
              background: "none",
              border: "none",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-12"
            style={{ backgroundColor: "var(--color-auth-form-bg)" }}
          >
            <DocumentEmptyIcon />
            <p
              className="text-body-lg"
              style={{ color: "var(--color-auth-input-placeholder)" }}
            >
              {t("empty")}
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                closeDrawer();
                startNavigationProgress("/shop");
                router.push("/shop");
              }}
            >
              {t("empty_cta")}
            </Button>
          </div>
        ) : (
          <>
            <ul
              className="flex-1 overflow-y-auto flex flex-col"
              style={{ gap: 0, backgroundColor: "var(--color-auth-form-bg)" }}
              role="list"
            >
              {lines.map((line) => (
                <QuoteItemRow key={line.lineId} line={line} locale={locale} />
              ))}
            </ul>
            <QuoteSummary
              onOpenSubmit={() => {
                closeDrawer();
                setSubmitLoaded(true);
                setSubmitModalOpen(true);
              }}
            />
          </>
        )}
      </Drawer>
      {submitLoaded && (
        <QuoteSubmitModal
          open={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          locale={locale}
          initialAddresses={addresses}
          serviceableCountries={serviceableCountries}
          note={note}
          onNoteChange={setNote}
        />
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentEmptyIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-auth-input-border)" }}
    >
      <path
        d="M34 8H16a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V18z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M34 8v10h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="30"
        x2="36"
        y2="30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}
