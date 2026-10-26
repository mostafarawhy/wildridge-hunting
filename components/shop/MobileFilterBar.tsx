"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import BottomSheet from "@/components/ui/BottomSheet";
import FiltersSidebar, {
  type FiltersSidebarProps,
} from "@/components/shop/FiltersSidebar";
import { useCatalogSort } from "@/components/shop/SortSelect";

type MobileFilterBarProps = FiltersSidebarProps & { totalCount: number };

const controlClass =
  "h-11 rounded-[8px] text-body-sm flex items-center justify-center gap-2 cursor-pointer active:opacity-70";

const controlStyle = {
  backgroundColor: "var(--primitive-white)",
  border: "1px solid var(--color-shop-divider)",
  color: "var(--primitive-black)",
} as const;

function MobileFilterBarInner({
  totalCount,
  ...sidebarProps
}: MobileFilterBarProps) {
  const t = useTranslations("shop");
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const { current, setSort, options } = useCatalogSort();
  const sortLabel = t(
    (options.find((o) => o.value === current) ?? options[0]).labelKey,
  );

  const n =
    searchParams.getAll("brand").length +
    searchParams.getAll("actionType").length +
    searchParams.getAll("caliber").length +
    (searchParams.get("inStock") === "true" ? 1 : 0) +
    (searchParams.get("newArrivals") === "true" ? 1 : 0) +
    (searchParams.get("requiresId") === "true" ||
    searchParams.get("noIdRequired") === "true"
      ? 1
      : 0) +
    (searchParams.has("minPrice") || searchParams.has("maxPrice") ? 1 : 0);

  return (
    <div
      className="lg:hidden grid grid-cols-2 transition-[top] duration-200 ease-out motion-reduce:transition-none"
      style={{
        position: "sticky",
        top: "var(--header-offset, 0px)",
        zIndex: 30,
        backgroundColor: "var(--color-shop-bg)",
        borderBottom: "1px solid var(--color-shop-divider)",
        padding: "8px 12px",
        gap: "8px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={controlClass}
        style={controlStyle}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 4H9M13 4H14M2 12H3M7 12H14M9 2V6M3 10V14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>{t("filters_title")}</span>
        {n > 0 && (
          <span
            className="text-eyebrow inline-flex items-center justify-center"
            style={{
              backgroundColor: "var(--color-action-primary)",
              color: "var(--color-action-primary-fg)",
              borderRadius: "var(--radius-full)",
              minWidth: "18px",
              height: "18px",
              paddingInline: "5px",
            }}
          >
            {n}
          </span>
        )}
      </button>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sortOpen}
        aria-label={`${t("sort_label")}: ${sortLabel}`}
        onClick={() => setSortOpen(true)}
        className={controlClass}
        style={controlStyle}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 4v16" />
          <path d="m3 16 4 4 4-4" />
          <path d="M17 20V4" />
          <path d="m13 8 4-4 4 4" />
        </svg>
        <span className="truncate">{sortLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <BottomSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        ariaLabel={t("sort_label")}
        title={t("sort_label")}
        closeLabel={t("close")}
      >
        <ul
          role="list"
          className="px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          {options.map((o) => {
            const selected = o.value === current;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    setSort(o.value);
                    setSortOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 text-start cursor-pointer rounded-[10px] transition-colors duration-150 active:bg-[color-mix(in_srgb,var(--primitive-black)_6%,transparent)] [@media(hover:hover)]:hover:bg-[color-mix(in_srgb,var(--primitive-black)_6%,transparent)]"
                  style={{
                    minHeight: "56px",
                    ...(selected
                      ? {
                          backgroundColor:
                            "color-mix(in srgb, var(--color-action-primary) 10%, transparent)",
                        }
                      : {}),
                  }}
                >
                  <span
                    className="text-body-lg"
                    style={{
                      color: "var(--primitive-black)",
                      fontWeight: selected
                        ? "var(--font-semibold)"
                        : "var(--font-normal)",
                    }}
                  >
                    {t(o.labelKey)}
                  </span>
                  {selected && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-action-primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={t("filters_title")}
        title={t("filters_title")}
        closeLabel={t("close")}
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-12 uppercase tracking-widest text-body-sm cursor-pointer"
            style={{
              backgroundColor: "var(--color-action-primary)",
              color: "var(--primitive-white)",
            }}
          >
            {t("show_results", { count: totalCount })}
          </button>
        }
      >
        <FiltersSidebar {...sidebarProps} />
      </BottomSheet>
    </div>
  );
}

export default function MobileFilterBar(props: MobileFilterBarProps) {
  return (
    <Suspense
      fallback={
        <div
          className="lg:hidden"
          style={{
            height: "calc(2.75rem + 17px)",
            backgroundColor: "var(--color-shop-bg)",
            borderBottom: "1px solid var(--color-shop-divider)",
            padding: "8px 12px",
            boxSizing: "border-box",
          }}
        />
      }
    >
      <MobileFilterBarInner {...props} />
    </Suspense>
  );
}
