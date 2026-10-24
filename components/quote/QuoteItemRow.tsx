"use client";

import FadeImage from "@/components/ui/FadeImage";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import QuantitySelector from "@/components/ui/QuantitySelector";
import { useQuoteStore } from "@/lib/stores/quote-store";
import { getImageUrl } from "@/lib/utils/images";
import type { QuoteLine } from "@/lib/stores/quote-store";

interface QuoteItemRowProps {
  line: QuoteLine;
  locale: string;
}

export default function QuoteItemRow({ line, locale }: QuoteItemRowProps) {
  const t = useTranslations("cart");
  const closeDrawer = useQuoteStore((s) => s.closeDrawer);
  const updateQty = useQuoteStore((s) => s.updateQty);
  const removeLine = useQuoteStore((s) => s.removeLine);

  const displayName =
    locale === "ar"
      ? line.nameAr
      : locale === "ru"
        ? (line.nameRu ?? line.nameEn)
        : line.nameEn;

  const imageUrl = line.primaryImageKey
    ? getImageUrl(line.primaryImageKey)
    : null;

  return (
    <li
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--color-auth-divider)",
      }}
    >
      <div className="flex gap-4">
        <div
          className="shrink-0 relative"
          style={{
            width: 80,
            height: 80,
            backgroundColor: "var(--color-auth-input-bg)",
            border: "1px solid var(--color-auth-input-border)",
            borderRadius: "var(--radius-none)",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <FadeImage
              src={imageUrl}
              alt={displayName}
              fill
              className="object-contain p-1"
              sizes="80px"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ color: "var(--color-auth-input-placeholder)" }}
            >
              <PlaceholderIcon />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <Link
            onClick={closeDrawer}
            href={`/shop/${line.categorySlug}/${line.slugEn}`}
            className="text-body font-semibold leading-snug hover:opacity-60 transition-opacity line-clamp-2"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {displayName}
          </Link>

          {line.selectedAddons.length > 0 && (
            <ul className="flex flex-col gap-0.5" style={{ listStyle: "none" }}>
              {line.selectedAddons.map((addon) => {
                const addonName =
                  locale === "ar"
                    ? addon.nameAr
                    : locale === "ru"
                      ? (addon.nameRu ?? addon.nameEn)
                      : addon.nameEn;
                return (
                  <li
                    key={addon.addonId}
                    className="text-body-sm"
                    style={{ color: "var(--color-auth-input-placeholder)" }}
                  >
                    + {addonName}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 mt-2">
            <QuantitySelector
              value={line.quantity}
              mode="input"
              min={1}
              onChange={(q) => updateQty(line.lineId, q)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeLine(line.lineId)}
          aria-label={t("remove")}
          className="shrink-0 flex items-start pt-0.5 cursor-pointer transition-opacity hover:opacity-50"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-error)",
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points="3 6 5 6 21 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 6V4h6v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle
        cx="8.5"
        cy="8.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M21 15l-5-5L5 21"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}