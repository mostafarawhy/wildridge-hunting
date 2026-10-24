"use client";

import { useQuoteStore, selectQuoteCount } from "@/lib/stores/quote-store";
import { useTranslations } from "next-intl";

export default function QuoteIconBadge() {
  const t = useTranslations("nav");
  const openDrawer = useQuoteStore((s) => s.openDrawer);
  const itemCount = useQuoteStore(selectQuoteCount);

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={t("aria_quote", { count: itemCount })}
      className="relative cursor-pointer transition-opacity duration-150 hover:opacity-70"
      style={{
        background: "none",
        border: "none",
        color: "var(--color-content-primary)",
        padding: 0,
      }}
    >
      <QuoteIcon />
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute flex items-center justify-center"
          style={{
            top: "-6px",
            insetInlineEnd: "-7px",
            minWidth: "16px",
            height: "16px",
            padding: "0 3px",
            backgroundColor: "var(--color-action-primary)",
            color: "var(--color-action-primary-fg)",
            fontSize: "var(--text-badge)",
            fontWeight: "var(--font-bold)",
            borderRadius: "var(--radius-full)",
            lineHeight: 1,
          }}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}

function QuoteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}
