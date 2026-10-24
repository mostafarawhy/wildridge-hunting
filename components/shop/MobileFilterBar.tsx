"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import BottomSheet from "@/components/ui/BottomSheet";
import FiltersSidebar, {
  type FiltersSidebarProps,
} from "@/components/shop/FiltersSidebar";
import SortSelect from "@/components/shop/SortSelect";

type MobileFilterBarProps = FiltersSidebarProps & { totalCount: number };

function MobileFilterBarInner({
  totalCount,
  ...sidebarProps
}: MobileFilterBarProps) {
  const t = useTranslations("shop");
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

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
      className="lg:hidden flex"
      style={{
        position: "sticky",
        top: "var(--spacing-header)",
        zIndex: 30,
        backgroundColor: "var(--primitive-white)",
        borderBottom: "1px solid var(--color-shop-divider)",
        height: "48px",
      }}
    >
      <div className="flex-1 flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 text-body-sm cursor-pointer"
          style={{ color: "var(--primitive-black)" }}
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
                backgroundColor: "var(--primitive-black)",
                color: "var(--primitive-white)",
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
      </div>
      <div
        className="flex-1 flex items-center justify-center"
        style={{ borderInlineStart: "1px solid var(--color-shop-divider)" }}
      >
        <SortSelect />
      </div>

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
            height: "48px",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        />
      }
    >
      <MobileFilterBarInner {...props} />
    </Suspense>
  );
}
