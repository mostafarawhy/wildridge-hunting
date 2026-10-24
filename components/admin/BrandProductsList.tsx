"use client";

import { useState } from "react";
import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import PublishStatusPill from "@/components/ui/PublishStatusPill";
import type { BrandProductRow } from "@/lib/db/queries/brands";

interface Props {
  brandName: string;
  rows: BrandProductRow[];
}

type StatusFilter = "" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const PAGE_SIZE = 20;

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
  margin: 0,
};

const heading: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1.5px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const textLink: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: 13,
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function BrandProductsList({ brandName, rows }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [showAll, setShowAll] = useState(false);

  const total = rows.length;
  const publishedCount = rows.filter(
    (r) => r.publishStatus === "PUBLISHED",
  ).length;

  const needle = search.trim().toLowerCase();
  const matching = rows.filter((r) => {
    if (
      needle &&
      !r.nameEn.toLowerCase().includes(needle) &&
      !r.nameAr.toLowerCase().includes(needle) &&
      !r.sku.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (status && r.publishStatus !== status) return false;
    return true;
  });
  const visible = showAll ? matching : matching.slice(0, PAGE_SIZE);

  return (
    <div style={{ ...card, marginTop: "1.5rem" }}>
      <style>{`
        .bpl-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--color-shop-divider); }
        .bpl-meta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: flex-end; }
        .bpl-filter { flex: 0 1 11rem; min-width: 0; }
        @media (max-width: 719px) {
          .bpl-row { grid-template-columns: minmax(0, 1fr); gap: 0.5rem; }
          .bpl-meta { justify-content: flex-start; }
          .bpl-filter { flex-basis: 100%; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p style={eyebrow}>Products</p>
        <h2 style={heading}>
          {plural(total, "product", "products")} under {brandName}
        </h2>
        <p style={mutedText}>{publishedCount} published</p>
      </div>

      {total === 0 ? (
        <p style={mutedText}>No products use this brand yet.</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <input
                type="text"
                dir="ltr"
                aria-label="Search products of this brand"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowAll(false);
                }}
                placeholder="Search by name or SKU"
                style={inputStyle}
              />
            </div>
            <div className="bpl-filter">
              <Select
                label="Status"
                id="bpl-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter);
                  setShowAll(false);
                }}
              >
                <option value="">Any</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
          </div>

          {matching.length === 0 ? (
            <p style={mutedText}>No products match these filters.</p>
          ) : (
            <div>
              {visible.map((row) => (
                <div key={row.id} className="bpl-row">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.125rem",
                      minWidth: 0,
                    }}
                  >
                    <Link
                      href={`/admin/products/${row.id}`}
                      onClick={() =>
                        startNavigationProgress(`/admin/products/${row.id}`)
                      }
                      style={{
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        fontWeight: 500,
                      }}
                    >
                      {row.nameEn}
                    </Link>
                    <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                      <span
                        dir="ltr"
                        style={{ fontFamily: "var(--font-mono, monospace)" }}
                      >
                        {row.sku}
                      </span>
                      {" · "}
                      <bdi dir="rtl">{row.nameAr}</bdi>
                    </span>
                  </div>
                  <div className="bpl-meta">
                    <span style={{ fontSize: 13, color: "#6b6b6b" }}>
                      {row.mainCategory.nameEn}
                    </span>
                    <PublishStatusPill status={row.publishStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showAll && matching.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                ...textLink,
                alignSelf: "flex-start",
                fontSize: "var(--text-body)",
              }}
            >
              Show all {matching.length}
            </button>
          )}
        </>
      )}
    </div>
  );
}
