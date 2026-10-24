"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import { PUBLISH_STATUS_LABELS } from "@/lib/utils/product-status";
import type { PublishStatus } from "@/app/generated/prisma/client";
import type {
  AdminProductSort,
  AdminProductStockFilter,
} from "@/lib/db/queries/products";

export interface ProductFilterValues {
  status: PublishStatus | "ALL";
  sort: AdminProductSort;
  q: string;
  category: string;
  brand: string;
  stock: AdminProductStockFilter | "";
  min: string;
  max: string;
  requiresId: boolean;
  accessories: boolean;
  b2b: boolean;
  isNew: boolean;
  featured: boolean;
  noImage: boolean;
}

export interface ProductFilterCategory {
  id: string;
  nameEn: string;
  isVisible: boolean;
  children: { id: string; nameEn: string; isVisible: boolean }[];
}

interface Props {
  values: ProductFilterValues;
  counts: Record<PublishStatus | "ALL", number>;
  brands: { value: string; label: string }[];
  categories: ProductFilterCategory[];
}

const STATUS_TABS: (PublishStatus | "ALL")[] = [
  "ALL",
  "PUBLISHED",
  "DRAFT",
  "ARCHIVED",
];

const SORT_OPTIONS: { value: AdminProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "stock_asc", label: "Stock: Low to High" },
  { value: "name", label: "Name: A–Z" },
];

const STOCK_LABELS: Record<AdminProductStockFilter, string> = {
  in: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

const FLAG_FILTERS: {
  key: "requiresId" | "accessories" | "b2b" | "isNew" | "featured" | "noImage";
  param: string;
  label: string;
}[] = [
  { key: "requiresId", param: "id", label: "Requires ID" },
  { key: "accessories", param: "accessories", label: "Has accessories" },
  { key: "b2b", param: "b2b", label: "B2B available" },
  { key: "isNew", param: "new", label: "New arrival" },
  { key: "featured", param: "featured", label: "Featured" },
  { key: "noImage", param: "noimage", label: "Missing images" },
];

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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
};

const textButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

const NBSP2 = "\u00a0\u00a0";

export default function ProductFilterBar({
  values,
  counts,
  brands,
  categories,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(values.q);
  const [minValue, setMinValue] = useState(values.min);
  const [maxValue, setMaxValue] = useState(values.max);
  const [moreOpen, setMoreOpen] = useState(
    FLAG_FILTERS.some((f) => values[f.key]),
  );

  const propKey = `${values.q}|${values.min}|${values.max}`;
  const [prevKey, setPrevKey] = useState(propKey);
  if (prevKey !== propKey) {
    setPrevKey(propKey);
    setSearchValue(values.q);
    setMinValue(values.min);
    setMaxValue(values.max);
  }

  type Override = Partial<ProductFilterValues>;

  function push(override: Override) {
    const next: ProductFilterValues = {
      ...values,
      q: searchValue.trim(),
      min: minValue.trim(),
      max: maxValue.trim(),
      ...override,
    };
    const params = new URLSearchParams();
    if (next.status !== "ALL") params.set("status", next.status);
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.brand) params.set("brand", next.brand);
    if (next.stock) params.set("stock", next.stock);
    if (next.min) params.set("min", next.min);
    if (next.max) params.set("max", next.max);
    for (const f of FLAG_FILTERS) {
      if (next[f.key]) params.set(f.param, "1");
    }
    if (next.sort !== "newest") params.set("sort", next.sort);

    const qs = params.toString();
    const href = `/admin/products${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function applyPrice() {
    if (minValue.trim() === values.min && maxValue.trim() === values.max) return;
    push({});
  }

  function categoryName(id: string): string {
    for (const c of categories) {
      if (c.id === id) return c.nameEn;
      const child = c.children.find((ch) => ch.id === id);
      if (child) return `${c.nameEn} › ${child.nameEn}`;
    }
    return id;
  }

  const chips: { key: string; label: string; remove: Override }[] = [];
  if (values.q) {
    chips.push({ key: "q", label: `Search: ${values.q}`, remove: { q: "" } });
  }
  if (values.category) {
    chips.push({
      key: "category",
      label: `Category: ${categoryName(values.category)}`,
      remove: { category: "" },
    });
  }
  if (values.brand) {
    chips.push({
      key: "brand",
      label: `Brand: ${brands.find((b) => b.value === values.brand)?.label ?? values.brand}`,
      remove: { brand: "" },
    });
  }
  if (values.stock) {
    chips.push({
      key: "stock",
      label: STOCK_LABELS[values.stock],
      remove: { stock: "" },
    });
  }
  if (values.min || values.max) {
    chips.push({
      key: "price",
      label: `Price: ${values.min || "0"}–${values.max || "any"}`,
      remove: { min: "", max: "" },
    });
  }
  for (const f of FLAG_FILTERS) {
    if (values[f.key]) {
      chips.push({ key: f.key, label: f.label, remove: { [f.key]: false } });
    }
  }

  function clearAll() {
    setSearchValue("");
    setMinValue("");
    setMaxValue("");
    push({
      q: "",
      category: "",
      brand: "",
      stock: "",
      min: "",
      max: "",
      requiresId: false,
      accessories: false,
      b2b: false,
      isNew: false,
      featured: false,
      noImage: false,
    });
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        role="tablist"
        aria-label="Product status"
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-shop-divider)",
          marginBottom: "1rem",
        }}
      >
        {STATUS_TABS.map((s) => {
          const active = values.status === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => push({ status: s })}
              style={{
                background: "none",
                border: "none",
                borderBottom: active
                  ? "2px solid #0b0b0b"
                  : "2px solid transparent",
                marginBottom: "-1px",
                padding: "0.5rem 0",
                fontSize: "var(--text-body)",
                fontWeight: active ? "var(--font-bold)" : "var(--font-medium)",
                color: active ? "#0b0b0b" : "#6b6b6b",
                cursor: "pointer",
              }}
            >
              {s === "ALL" ? "All" : PUBLISH_STATUS_LABELS[s]} ({counts[s]})
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1rem 1.25rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "240px" }}>
            <label htmlFor="product-filter-search" style={labelStyle}>
              Search
            </label>
            <input
              id="product-filter-search"
              type="text"
              dir="ltr"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") push({ q: searchValue.trim() });
              }}
              placeholder="Search by name, SKU, or brand…"
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={() => push({ q: searchValue.trim() })}
            style={blackButton}
          >
            Search
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "200px" }}>
            <Select
              label="Category"
              id="product-filter-category"
              value={values.category}
              onChange={(e) => push({ category: e.target.value })}
            >
              <option value="">All categories</option>
              {categories.map((c) =>
                c.children.length === 0 ? (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                    {c.isVisible ? "" : " (hidden)"}
                  </option>
                ) : (
                  <optgroup
                    key={c.id}
                    label={`${c.nameEn}${c.isVisible ? "" : " (hidden)"}`}
                  >
                    <option value={c.id}>All {c.nameEn}</option>
                    {c.children.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {NBSP2}
                        {ch.nameEn}
                        {ch.isVisible ? "" : " (hidden)"}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </Select>
          </div>

          <div style={{ minWidth: "160px" }}>
            <Select
              label="Brand"
              id="product-filter-brand"
              value={values.brand}
              onChange={(e) => push({ brand: e.target.value })}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: "160px" }}>
            <Select
              label="Stock"
              id="product-filter-stock"
              value={values.stock}
              onChange={(e) =>
                push({ stock: e.target.value as AdminProductStockFilter | "" })
              }
            >
              <option value="">Any</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>

          <div style={{ width: "7rem" }}>
            <label htmlFor="product-filter-min" style={labelStyle}>
              Min price
            </label>
            <input
              id="product-filter-min"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice();
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ width: "7rem" }}>
            <label htmlFor="product-filter-max" style={labelStyle}>
              Max price
            </label>
            <input
              id="product-filter-max"
              type="number"
              min={0}
              inputMode="decimal"
              dir="ltr"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPrice();
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ minWidth: "200px" }}>
            <Select
              label="Sort"
              id="product-filter-sort"
              value={values.sort}
              onChange={(e) => push({ sort: e.target.value as AdminProductSort })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            style={textButton}
          >
            {moreOpen ? "Fewer filters" : "More filters"}
          </button>
        </div>

        {moreOpen && (
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {FLAG_FILTERS.map((f) => (
              <label
                key={f.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "var(--text-body)",
                  color: "#0b0b0b",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={values[f.key]}
                  onChange={(e) => push({ [f.key]: e.target.checked })}
                  style={{ accentColor: "#0b0b0b" }}
                />
                {f.label}
              </label>
            ))}
          </div>
        )}

        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {chips.map((chip) => (
              <span
                key={chip.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.25rem 0.25rem 0.25rem 0.625rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  border: "1px solid var(--color-shop-divider)",
                }}
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter: ${chip.label}`}
                  onClick={() => {
                    if (chip.key === "q") setSearchValue("");
                    if (chip.key === "price") {
                      setMinValue("");
                      setMaxValue("");
                    }
                    push(chip.remove);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0 0.375rem",
                    fontSize: "var(--text-body)",
                    lineHeight: 1,
                    color: "#0b0b0b",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} style={textButton}>
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
