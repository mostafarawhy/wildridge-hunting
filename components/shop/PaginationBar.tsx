"use client";

import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useCallback } from "react";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface PaginationBarProps {
  totalPages: number;
  siblings?: number;
}

const PAGE_PARAM = "page";

function buildPageRange(
  current: number,
  total: number,
  siblings: number,
): (number | "...")[] {
  if (total <= 1) return [1];

  const range: number[] = [];
  for (
    let i = Math.max(2, current - siblings);
    i <= Math.min(total - 1, current + siblings);
    i++
  ) {
    range.push(i);
  }

  const result: (number | "...")[] = [];

  if (range[0] > 2) result.push(1, "...");
  else result.push(1);

  result.push(...range);

  if (range.length === 0 || range[range.length - 1] < total - 1)
    result.push("...", total);
  else result.push(total);

  return result;
}

function formatPageNumber(n: number, locale: string): string {
  if (locale === "ar") return n.toLocaleString("ar-EG");
  return String(n);
}

function PageButton({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="w-11 h-11 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        borderRadius: "var(--radius-md)",
        border: active
          ? "2px solid var(--color-action-primary)"
          : "2px solid transparent",
        backgroundColor: active
          ? "var(--color-action-primary)"
          : "var(--color-shop-divider)",
        color: active ? "var(--primitive-white)" : "var(--primitive-black)",
        fontWeight: active ? "var(--font-semibold)" : "var(--font-normal)",
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.borderColor = "var(--color-action-primary)";
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function ArrowButton({
  onClick,
  disabled = false,
  label,
  direction,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  direction: "prev" | "next";
}) {
  const locale = useLocale();
  const isRtl = locale === "ar";


  const pointsLeft =
    (direction === "prev" && !isRtl) || (direction === "next" && isRtl);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-11 h-11 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        borderRadius: "var(--radius-md)",
        border: "2px solid transparent",
        backgroundColor: "var(--color-shop-divider)",
        color: "var(--primitive-black)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = "var(--color-action-primary)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {pointsLeft ? (
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}

function PaginationBarInner({ totalPages, siblings = 1 }: PaginationBarProps) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Number(searchParams.get(PAGE_PARAM) ?? 1);

  const navigate = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 1) {
        params.delete(PAGE_PARAM);
      } else {
        params.set(PAGE_PARAM, String(page));
      }
      startNavigationProgress();
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  if (totalPages <= 1) return null;

  const pages = buildPageRange(currentPage, totalPages, siblings);

  return (
    <nav
      aria-label={t("pagination_nav")}
      className="flex items-center justify-center gap-2 px-4 py-6"
      style={{ borderTop: "1px solid var(--color-shop-divider)" }}
    >
      <ArrowButton
        onClick={() => navigate(currentPage - 1)}
        disabled={currentPage === 1}
        label={t("pagination_prev")}
        direction="prev"
      />

      <div className="flex items-center gap-2">
        {pages.map((entry, i) =>
          entry === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="w-11 h-11 flex items-center justify-center"
              style={{
                color: "var(--primitive-black)",
                fontSize: "var(--text-body)",
              }}
            >
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              onClick={() => navigate(entry as number)}
              active={entry === currentPage}
              label={String(entry)}
            >
              <span style={{ fontSize: "var(--text-body)" }}>
                {formatPageNumber(entry as number, locale)}
              </span>
            </PageButton>
          ),
        )}
      </div>

      <ArrowButton
        onClick={() => navigate(currentPage + 1)}
        disabled={currentPage === totalPages}
        label={t("pagination_next")}
        direction="next"
      />
    </nav>
  );
}

export default function PaginationBar(props: PaginationBarProps) {
  return (
    <Suspense fallback={<div style={{ height: "68px" }} />}>
      <PaginationBarInner {...props} />
    </Suspense>
  );
}
