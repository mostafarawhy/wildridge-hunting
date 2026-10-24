"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

interface SummaryDisclosureProps {
  totalLabel: string;
  children: ReactNode;
}

export default function SummaryDisclosure({
  totalLabel,
  children,
}: SummaryDisclosureProps) {
  const t = useTranslations("checkout");
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="lg:hidden mb-4 flex w-full items-center justify-between gap-3 border border-[var(--color-shop-divider)] bg-white px-4 py-3 text-start"
      >
        <span className="inline-flex items-center gap-2 text-[0.875rem] font-semibold text-neutral-900">
          {open ? t("summaryHide") : t("summaryShow")}
          <svg
            width="11"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            aria-hidden="true"
            className={"transition-transform " + (open ? "rotate-180" : "")}
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          dir="ltr"
          className="text-[0.9375rem] font-semibold text-neutral-900 tabular-nums"
        >
          {totalLabel}
        </span>
      </button>

      <div id={panelId} className={open ? "block" : "hidden lg:block"}>
        {children}
      </div>
    </div>
  );
}
