"use client";

import { Suspense, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

interface AdminPaginationBarProps {
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
      style={{
        width: "2.5rem",
        height: "2.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        backgroundColor: "#0b0b0b",
        color: "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : active ? 1 : 0.45,
        transition: "border-color 150ms",
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.borderColor = "#0b0b0b";
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.borderColor = "var(--color-shop-divider)";
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: "2.5rem",
        height: "2.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "0",
        backgroundColor: "#0b0b0b",
        color: "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1,
        transition: "border-color 150ms",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {direction === "prev" ? (
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

function AdminPaginationBarInner({
  totalPages,
  siblings = 1,
}: AdminPaginationBarProps) {
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
      const qs = params.toString();
      const href = `${pathname}${qs ? `?${qs}` : ""}`;
      startNavigationProgress(href);
      router.push(href, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  if (totalPages <= 1) return null;

  const pages = buildPageRange(currentPage, totalPages, siblings);

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "1.5rem 1rem",
      }}
    >
      <ArrowButton
        onClick={() => navigate(currentPage - 1)}
        disabled={currentPage === 1}
        label="Previous page"
        direction="prev"
      />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {pages.map((entry, i) =>
          entry === "..." ? (
            <span
              key={`ellipsis-${i}`}
              style={{
                width: "2.5rem",
                height: "2.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b6b6b",
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
              <span style={{ fontSize: "var(--text-body)" }}>{entry}</span>
            </PageButton>
          ),
        )}
      </div>

      <ArrowButton
        onClick={() => navigate(currentPage + 1)}
        disabled={currentPage === totalPages}
        label="Next page"
        direction="next"
      />
    </nav>
  );
}

export default function AdminPaginationBar(props: AdminPaginationBarProps) {
  return (
    <Suspense fallback={<div style={{ height: "68px" }} />}>
      <AdminPaginationBarInner {...props} />
    </Suspense>
  );
}
