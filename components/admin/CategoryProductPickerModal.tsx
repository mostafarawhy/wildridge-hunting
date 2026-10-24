"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import FadeImage from "@/components/ui/FadeImage";
import PublishStatusPill from "@/components/ui/PublishStatusPill";
import { useToast } from "@/components/ui/Toast";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { addProductsToCategoryAction } from "@/lib/actions/product-category";
import type { CategoryPickerItem } from "@/lib/db/queries/categories";

interface Props {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  pathLabel: string;
  live: boolean;
  items: CategoryPickerItem[];
  onAdded: () => void;
}

type StockFilter = "" | "in" | "low" | "out";
type StatusFilter = "" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const NBSP2 = "  ";

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
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

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  margin: 0,
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function stockInfo(item: CategoryPickerItem): { word: string; color: string } {
  const isOut = item.stockQuantity === 0;
  const isLow = !isOut && item.stockQuantity <= item.lowStockThreshold;
  return {
    word: isOut ? "Out of stock" : isLow ? "Low stock" : "In stock",
    color: isOut ? "#991b1b" : isLow ? "#854d0e" : "#166534",
  };
}

function stockKey(item: CategoryPickerItem): StockFilter {
  if (item.stockQuantity === 0) return "out";
  return item.stockQuantity <= item.lowStockThreshold ? "low" : "in";
}

function mainPath(item: CategoryPickerItem): string {
  return item.parentCategoryNameEn
    ? `${item.parentCategoryNameEn} › ${item.categoryNameEn}`
    : item.categoryNameEn;
}

interface CategoryGroup {
  id: string;
  name: string;
  children: Map<string, string>;
}

function buildCategoryGroups(items: CategoryPickerItem[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const item of items) {
    if (item.parentCategoryId && item.parentCategoryNameEn) {
      let group = groups.get(item.parentCategoryId);
      if (!group) {
        group = {
          id: item.parentCategoryId,
          name: item.parentCategoryNameEn,
          children: new Map(),
        };
        groups.set(group.id, group);
      }
      group.children.set(item.categoryId, item.categoryNameEn);
    } else if (!groups.has(item.categoryId)) {
      groups.set(item.categoryId, {
        id: item.categoryId,
        name: item.categoryNameEn,
        children: new Map(),
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CategoryProductPickerModal({
  open,
  onClose,
  categoryId,
  categoryName,
  pathLabel,
  live,
  items,
  onAdded,
}: Props) {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [stock, setStock] = useState<StockFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [hideHere, setHideHere] = useState(true);
  const [highlightSku, setHighlightSku] = useState<string | null>(null);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const categoryGroups = useMemo(() => buildCategoryGroups(items), [items]);
  const brands = useMemo(
    () =>
      [...new Set(items.map((i) => i.brand))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );
  const itemBySku = useMemo(
    () => new Map(items.map((i) => [i.sku, i])),
    [items],
  );

  const needle = search.trim().toLowerCase();
  const filtersActive =
    needle !== "" ||
    category !== "" ||
    brand !== "" ||
    stock !== "" ||
    status !== "" ||
    !hideHere;

  const matching = items.filter((item) => {
    if (hideHere && item.here !== null) return false;
    if (
      needle &&
      !item.nameEn.toLowerCase().includes(needle) &&
      !item.nameAr.toLowerCase().includes(needle) &&
      !(item.nameRu ?? "").toLowerCase().includes(needle) &&
      !item.sku.toLowerCase().includes(needle) &&
      !item.brand.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (
      category &&
      item.categoryId !== category &&
      item.parentCategoryId !== category
    ) {
      return false;
    }
    if (brand && item.brand !== brand) return false;
    if (stock && stockKey(item) !== stock) return false;
    if (status && item.publishStatus !== status) return false;
    return true;
  });
  const visible = [
    ...matching.filter((item) => item.here === null),
    ...matching.filter((item) => item.here !== null),
  ];
  const selectable = visible.filter((item) => item.here === null);

  const alreadyHere = items.filter((item) => item.here !== null).length;
  const highlighted =
    visible.find((item) => item.sku === highlightSku) ?? visible[0] ?? null;
  const highlightedSku = highlighted?.sku ?? null;

  const tickedNames = ticked
    .map((sku) => itemBySku.get(sku)?.nameEn)
    .filter((name): name is string => !!name);

  useEffect(() => {
    if (!highlightedSku) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-sku="${CSS.escape(highlightedSku)}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [highlightedSku]);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setBrand("");
    setStock("");
    setStatus("");
    setHideHere(true);
    setHighlightSku(null);
  }

  function handleClose() {
    clearFilters();
    setTicked([]);
    setError(null);
    onClose();
  }

  function toggle(item: CategoryPickerItem) {
    if (item.here !== null) return;
    setError(null);
    setTicked((prev) =>
      prev.includes(item.sku)
        ? prev.filter((sku) => sku !== item.sku)
        : [...prev, item.sku],
    );
  }

  function selectAllMatching() {
    setError(null);
    setTicked((prev) => [
      ...prev,
      ...selectable.map((i) => i.sku).filter((sku) => !prev.includes(sku)),
    ]);
  }

  async function submit(skus: string[]) {
    if (pending || skus.length === 0) return;
    setError(null);
    setPending(true);

    const result = await addProductsToCategoryAction(categoryId, skus);

    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    toast.success(
      `${plural(result.data.count, "product", "products")} added.`,
    );
    onAdded();
    handleClose();
  }

  function addCurrent() {
    if (ticked.length > 0) {
      void submit([...ticked]);
      return;
    }
    if (highlighted && highlighted.here === null) {
      void submit([highlighted.sku]);
    }
  }

  function moveHighlight(step: 1 | -1) {
    if (visible.length === 0) return;
    const index = visible.findIndex((item) => item.sku === highlightedSku);
    const next = Math.min(
      visible.length - 1,
      Math.max(0, (index === -1 ? 0 : index) + step),
    );
    setHighlightSku(visible[next].sku);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLElement>,
    allowSpace: boolean,
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === " " && allowSpace) {
      e.preventDefault();
      if (highlighted) toggle(highlighted);
    } else if (e.key === "Enter") {
      e.preventDefault();
      addCurrent();
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      maxWidth={960}
      ariaLabel="Add products"
    >
      <style>{`
        .cpp-body { display: flex; gap: 1.25rem; align-items: flex-start; }
        .cpp-list { flex: 0 0 58%; max-width: 58%; max-height: 26rem; overflow-y: auto; border: 1px solid var(--color-shop-divider); margin: 0; padding: 0; list-style: none; outline: none; }
        .cpp-preview { flex: 1; min-width: 0; }
        .cpp-filter { flex: 1 1 11rem; min-width: 0; }
        @media (max-width: 719px) {
          .cpp-list { flex-basis: 100%; max-width: 100%; }
          .cpp-preview { display: none; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            paddingInlineEnd: "2.5rem",
          }}
        >
          <p style={eyebrow}>Category · {categoryName}</p>
          <h2
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
              margin: 0,
            }}
          >
            Add products
          </h2>
          <p style={{ ...mutedText, color: "#4b4b4b" }}>
            {pathLabel} · {plural(items.length, "product", "products")} ·{" "}
            {live ? "Shown on store" : "Hidden on store"}
          </p>
          <p style={mutedText}>
            Search or filter, tick products, then add them. Each product keeps
            its main category and web address.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No products yet"
            body="Create a product first, then add it to this category."
          />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                ref={searchRef}
                type="text"
                dir="ltr"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, needle === "")}
                placeholder="Search by name, SKU or brand"
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="cpp-filter">
                  <Select
                    label="Category"
                    id="cpp-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {categoryGroups.map((group) =>
                      group.children.size === 0 ? (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ) : (
                        <optgroup key={group.id} label={group.name}>
                          <option value={group.id}>All {group.name}</option>
                          {[...group.children.entries()]
                            .sort((a, b) => a[1].localeCompare(b[1]))
                            .map(([childId, childName]) => (
                              <option key={childId} value={childId}>
                                {NBSP2}
                                {childName}
                              </option>
                            ))}
                        </optgroup>
                      ),
                    )}
                  </Select>
                </div>
                <div className="cpp-filter">
                  <Select
                    label="Brand"
                    id="cpp-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  >
                    <option value="">All brands</option>
                    {brands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="cpp-filter">
                  <Select
                    label="Stock"
                    id="cpp-stock"
                    value={stock}
                    onChange={(e) => setStock(e.target.value as StockFilter)}
                  >
                    <option value="">Any</option>
                    <option value="in">In stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                  </Select>
                </div>
                <div className="cpp-filter">
                  <Select
                    label="Status"
                    id="cpp-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  >
                    <option value="">Any</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </Select>
                </div>
              </div>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  cursor: "pointer",
                  alignSelf: "flex-start",
                }}
              >
                <input
                  type="checkbox"
                  checked={hideHere}
                  onChange={(e) => setHideHere(e.target.checked)}
                  style={{ accentColor: "#0b0b0b" }}
                />
                Hide products already here
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <p style={mutedText}>
                  {visible.length} of {items.length} products · {alreadyHere}{" "}
                  already here
                </p>
                <p style={mutedText}>↑ ↓ move · Space tick · Enter add</p>
                {selectable.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllMatching}
                    style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                  >
                    Select all {selectable.length} matching
                  </button>
                )}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                title="No products match these filters"
                body="Try another name or SKU, or widen the filters."
                onClear={clearFilters}
              />
            ) : (
              <div className="cpp-body">
                <ul
                  ref={listRef}
                  className="cpp-list"
                  tabIndex={0}
                  aria-label="Products"
                  onKeyDown={(e) => handleKeyDown(e, true)}
                >
                  {visible.map((item) => {
                    const isTicked = ticked.includes(item.sku);
                    const active = item.sku === highlightedSku;
                    const stockView = stockInfo(item);
                    const here = item.here !== null;
                    return (
                      <li
                        key={item.sku}
                        data-sku={item.sku}
                        onMouseEnter={() => setHighlightSku(item.sku)}
                        onClick={() => setHighlightSku(item.sku)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          padding: "0.625rem 0.75rem",
                          borderBottom: "1px solid var(--color-shop-divider)",
                          borderInlineStart: active
                            ? "2px solid #0b0b0b"
                            : "2px solid transparent",
                          backgroundColor: active
                            ? "var(--color-auth-input-bg)"
                            : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Tick ${item.nameEn}`}
                            checked={isTicked}
                            disabled={here}
                            onChange={() => toggle(item)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 16,
                              height: 16,
                              flexShrink: 0,
                              accentColor: "#0b0b0b",
                              cursor: here ? "not-allowed" : "pointer",
                            }}
                          />
                          <div
                            style={{
                              position: "relative",
                              width: 44,
                              height: 44,
                              flexShrink: 0,
                              backgroundColor: "var(--color-auth-input-bg)",
                              border: "1px solid var(--color-auth-input-border)",
                              overflow: "hidden",
                            }}
                          >
                            <FadeImage
                              src={getImageUrl(item.storageKey)}
                              alt={item.nameEn}
                              fill
                              sizes="44px"
                              className="object-contain"
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.125rem",
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "var(--text-body)",
                                color: "#0b0b0b",
                                fontWeight: 500,
                              }}
                            >
                              {item.nameEn}
                            </span>
                            <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                              <span
                                dir="ltr"
                                style={{ fontFamily: "var(--font-mono, monospace)" }}
                              >
                                {item.sku}
                              </span>{" "}
                              · {item.brand}
                            </span>
                            <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                              Main: {mainPath(item)}
                              {item.alsoIn.length > 0 &&
                                ` · also in ${item.alsoIn.length}`}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <span dir="ltr" style={{ color: "#0b0b0b" }}>
                                {formatAED(item.price, "en")}
                              </span>
                              <span style={{ color: stockView.color }}>
                                {stockView.word}
                              </span>
                              {item.publishStatus !== "PUBLISHED" && (
                                <PublishStatusPill status={item.publishStatus} />
                              )}
                            </span>
                          </div>
                        </div>

                        {here && (
                          <span
                            style={{
                              fontSize: 13,
                              color: "#166534",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {item.here === "main"
                              ? "✓ Main category"
                              : "✓ Already here"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="cpp-preview">
                  {highlighted && (
                    <PickerPreview
                      key={highlighted.sku}
                      item={highlighted}
                      categoryName={categoryName}
                      isTicked={ticked.includes(highlighted.sku)}
                      onToggle={() => toggle(highlighted)}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" style={{ ...mutedText, color: "#991b1b" }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            paddingTop: "0.875rem",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          {ticked.length > 0 ? (
            <p
              style={{
                ...mutedText,
                color: "#0b0b0b",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <span>
                {ticked.length} ticked: {tickedNames.slice(0, 3).join(", ")}
                {tickedNames.length > 3 && ` +${tickedNames.length - 3} more`}
              </span>
              <button
                type="button"
                onClick={() => setTicked([])}
                style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
              >
                Clear
              </button>
            </p>
          ) : (
            <p style={mutedText}>Nothing ticked yet</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button type="button" onClick={handleClose} style={textButton}>
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (ticked.length === 0) {
                  searchRef.current?.focus();
                  return;
                }
                void submit([...ticked]);
              }}
              style={{
                ...blackButton,
                opacity: pending ? 0.6 : 1,
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              {pending
                ? "Adding…"
                : ticked.length === 0
                  ? "Tick products to add"
                  : `Add ${plural(ticked.length, "product", "products")}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EmptyState({
  title,
  body,
  onClear,
}: {
  title: string;
  body: string;
  onClear?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.375rem",
        padding: "2.5rem 1rem",
        textAlign: "center",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
          margin: 0,
        }}
      >
        {title}
      </p>
      <p style={mutedText}>{body}</p>
      {onClear && (
        <button type="button" onClick={onClear} style={textButton}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function PickerPreview({
  item,
  categoryName,
  isTicked,
  onToggle,
}: {
  item: CategoryPickerItem;
  categoryName: string;
  isTicked: boolean;
  onToggle: () => void;
}) {
  const stockView = stockInfo(item);
  const here = item.here !== null;
  const hint = here
    ? "Already on this category page."
    : item.publishStatus !== "PUBLISHED"
      ? "Hidden on the store until published. It lists here once it is."
      : `Appears on ${categoryName} as soon as it's added.`;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Main category",
      value: (
        <Link
          href={`/admin/categories/${item.categoryId}`}
          onClick={() =>
            startNavigationProgress(`/admin/categories/${item.categoryId}`)
          }
          style={{ color: "#0b0b0b", textDecoration: "underline" }}
        >
          {mainPath(item)}
        </Link>
      ),
    },
    {
      label: "Also in",
      value:
        item.alsoIn.length > 0
          ? item.alsoIn.map((c) => c.label).join(", ")
          : "—",
    },
    { label: "Brand", value: item.brand },
    {
      label: "Price",
      value: <span dir="ltr">{formatAED(item.price, "en")}</span>,
    },
    {
      label: "Stock",
      value: (
        <span dir="ltr" style={{ color: stockView.color }}>
          {item.stockQuantity} · {stockView.word}
        </span>
      ),
    },
    { label: "Status", value: <PublishStatusPill status={item.publishStatus} /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          backgroundColor: "var(--color-auth-input-bg)",
          border: "1px solid var(--color-auth-input-border)",
          overflow: "hidden",
        }}
      >
        <FadeImage
          src={getImageUrl(item.storageKey)}
          alt={item.nameEn}
          fill
          sizes="(min-width: 720px) 380px, 0px"
          className="object-contain"
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: 0,
          }}
        >
          {item.nameEn}
        </p>
        <span
          dir="ltr"
          style={{
            fontSize: 13,
            color: "#6b6b6b",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {item.sku}
        </span>
      </div>
      <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "var(--text-body-sm)",
            }}
          >
            <dt style={{ color: "#6b6b6b" }}>{row.label}</dt>
            <dd style={{ margin: 0, color: "#0b0b0b", textAlign: "end" }}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p style={mutedText}>{hint}</p>
      {!here && (
        <button
          type="button"
          onClick={onToggle}
          style={{ ...blackButton, width: "100%" }}
        >
          {isTicked ? "Ticked ✓ · Untick" : "Tick"}
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <a
          href={`/admin/products/${item.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#0b0b0b",
            textDecoration: "underline",
          }}
        >
          Open product page ↗
        </a>
        {item.publishStatus === "PUBLISHED" && item.mainLive && (
          <a
            href={`/en/shop/${item.categorySlug}/${item.slugEn}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              textDecoration: "underline",
            }}
          >
            View on store ↗
          </a>
        )}
      </div>
    </div>
  );
}
