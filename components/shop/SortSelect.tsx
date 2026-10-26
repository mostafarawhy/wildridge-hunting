"use client";

import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

export interface SortSelectProps {
  defaultSort?: SortValue;
}

export type SortValue = "featured" | "newest" | "price_asc" | "price_desc";

const SORT_PARAM = "sort";
const PAGE_PARAM = "page";

const SORT_KEYS: Record<SortValue, string> = {
  featured: "sort_featured",
  newest: "sort_newest",
  price_asc: "sort_price_asc",
  price_desc: "sort_price_desc",
};

export function useCatalogSort(defaultSort: SortValue = "featured") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (searchParams.get(SORT_PARAM) as SortValue) ?? defaultSort;

  const setSort = useCallback(
    (value: SortValue) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(SORT_PARAM, value);
      params.delete(PAGE_PARAM);

      startNavigationProgress();
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const options = (Object.entries(SORT_KEYS) as [SortValue, string][]).map(
    ([value, labelKey]) => ({ value, labelKey }),
  );

  return { current, setSort, options };
}

function SortSelectInner({ defaultSort = "featured" }: SortSelectProps) {
  const t = useTranslations("shop");
  const { current, setSort: handleChange } = useCatalogSort(defaultSort);

  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={t("sort_label")}
        value={current}
        onChange={(e) => handleChange(e.target.value as SortValue)}
        className="appearance-none cursor-pointer pe-8 ps-0 h-9 transition-colors text-body-sm"
        style={{
          backgroundColor: "transparent",
          color: "var(--primitive-black)",
          border: "none",
          borderBottom: "1px solid var(--primitive-black)",
          borderRadius: "var(--radius-none)",
          outline: "none",
          fontWeight: "var(--font-medium)",
          letterSpacing: "var(--tracking-wide)",
        }}
      >
        {(Object.entries(SORT_KEYS) as [SortValue, string][]).map(
          ([value, key]) => (
            <option
              key={value}
              value={value}
              style={{
                backgroundColor: "var(--primitive-white)",
                color: "var(--primitive-black)",
              }}
            >
              {t(key)}
            </option>
          ),
        )}
      </select>

      <span
        className="absolute pointer-events-none"
        style={{
          insetInlineEnd: "0.25rem",
          color: "var(--primitive-black)",
          top: "50%",
          transform: "translateY(-50%)",
        }}
        aria-hidden="true"
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

export default function SortSelect(props: SortSelectProps) {
  return (
    <Suspense
      fallback={
        <div
          className="h-5 w-32"
          style={{ borderBottom: "1px solid var(--primitive-black)" }}
        />
      }
    >
      <SortSelectInner {...props} />
    </Suspense>
  );
}
