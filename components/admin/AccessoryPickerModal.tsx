"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import FadeImage from "@/components/ui/FadeImage";
import PublishStatusPill from "@/components/ui/PublishStatusPill";
import { useToast } from "@/components/ui/Toast";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { linkAccessoryAction } from "@/lib/actions/product-accessory";
import type { LinkableAccessory } from "@/lib/db/queries/products";

interface Props {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  items: LinkableAccessory[];
  linkedCount: number;
  onLinked: () => void;
}

type StockFilter = "" | "in" | "low" | "out";
type StatusFilter = "" | "PUBLISHED" | "DRAFT" | "ARCHIVED";

const NBSP2 = "  ";

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

function stockInfo(item: LinkableAccessory): { word: string; color: string } {
  const isOut = item.stockQuantity === 0;
  const isLow = !isOut && item.stockQuantity <= item.lowStockThreshold;
  return {
    word: isOut ? "Out of stock" : isLow ? "Low stock" : "In stock",
    color: isOut ? "#991b1b" : isLow ? "#854d0e" : "#166534",
  };
}

function stockKey(item: LinkableAccessory): StockFilter {
  if (item.stockQuantity === 0) return "out";
  return item.stockQuantity <= item.lowStockThreshold ? "low" : "in";
}

interface CategoryGroup {
  id: string;
  name: string;
  children: Map<string, string>;
}

function buildCategoryGroups(items: LinkableAccessory[]): CategoryGroup[] {
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

export default function AccessoryPickerModal({
  open,
  onClose,
  productId,
  productName,
  items,
  linkedCount,
  onLinked,
}: Props) {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [stock, setStock] = useState<StockFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [highlightSku, setHighlightSku] = useState<string | null>(null);
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localLinked, setLocalLinked] = useState<ReadonlySet<string>>(
    new Set(),
  );

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

  const isLinked = (item: LinkableAccessory) =>
    item.linked || localLinked.has(item.sku);

  const needle = search.trim().toLowerCase();
  const filtersActive =
    needle !== "" ||
    category !== "" ||
    brand !== "" ||
    stock !== "" ||
    status !== "";

  const matching = items.filter((item) => {
    if (
      needle &&
      !item.nameEn.toLowerCase().includes(needle) &&
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
    ...matching.filter((item) => !isLinked(item)),
    ...matching.filter((item) => isLinked(item)),
  ];

  const alreadyLinked = items.filter((item) => isLinked(item)).length;
  const highlighted =
    visible.find((item) => item.sku === highlightSku) ?? visible[0] ?? null;
  const highlightedSku = highlighted?.sku ?? null;

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
    setHighlightSku(null);
  }

  function handleClose() {
    clearFilters();
    setErrors({});
    setLocalLinked(new Set());
    onClose();
  }

  async function link(item: LinkableAccessory) {
    if (pendingSku || isLinked(item)) return;
    setErrors({});
    setPendingSku(item.sku);

    const result = await linkAccessoryAction(productId, item.sku);

    setPendingSku(null);

    if (!result.success) {
      setErrors({ [item.sku]: result.error });
      return;
    }

    toast.success("Accessory linked.");
    setLocalLinked((prev) => new Set(prev).add(item.sku));
    onLinked();
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

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted && !isLinked(highlighted)) void link(highlighted);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth={960} ariaLabel="Add accessories">
      <style>{`
        .apm-body { display: flex; gap: 1.25rem; align-items: flex-start; }
        .apm-list { flex: 0 0 58%; max-width: 58%; max-height: 26rem; overflow-y: auto; border: 1px solid var(--color-shop-divider); margin: 0; padding: 0; list-style: none; }
        .apm-preview { flex: 1; min-width: 0; }
        .apm-filter { flex: 1 1 11rem; min-width: 0; }
        @media (max-width: 719px) {
          .apm-list { flex-basis: 100%; max-width: 100%; }
          .apm-preview { display: none; }
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
          <p style={eyebrow}>Accessories</p>
          <h2
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
              margin: 0,
            }}
          >
            Add accessories
          </h2>
          <p style={{ ...mutedText, color: "#4b4b4b" }}>
            {productName} · {linkedCount} linked
          </p>
          <p style={mutedText}>
            Search or filter, then select Link. Each link saves straight away;
            remove or reorder links on the product page.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No products can be linked"
            body="Rifles and pistols can't be accessories, and deleted products aren't listed."
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
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, SKU or brand"
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="apm-filter">
                  <Select
                    label="Category"
                    id="apm-category"
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
                <div className="apm-filter">
                  <Select
                    label="Brand"
                    id="apm-brand"
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
                <div className="apm-filter">
                  <Select
                    label="Stock"
                    id="apm-stock"
                    value={stock}
                    onChange={(e) => setStock(e.target.value as StockFilter)}
                  >
                    <option value="">Any</option>
                    <option value="in">In stock</option>
                    <option value="low">Low stock</option>
                    <option value="out">Out of stock</option>
                  </Select>
                </div>
                <div className="apm-filter">
                  <Select
                    label="Status"
                    id="apm-status"
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <p style={mutedText}>
                  {visible.length} of {items.length} products · {alreadyLinked}{" "}
                  already linked
                </p>
                <p style={mutedText}>↑ ↓ to move · Enter to link</p>
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
              <div className="apm-body">
                <ul ref={listRef} className="apm-list">
                  {visible.map((item) => {
                    const linked = isLinked(item);
                    const active = item.sku === highlightedSku;
                    const stockView = stockInfo(item);
                    const error = errors[item.sku];
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
                              · {item.brand} · {item.categoryNameEn}
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
                            {error && (
                              <span
                                role="alert"
                                style={{ fontSize: 13, color: "#991b1b" }}
                              >
                                {error}
                              </span>
                            )}
                          </div>
                        </div>

                        {linked ? (
                          <span
                            style={{
                              fontSize: 13,
                              color: "#166534",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            ✓ Linked
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingSku !== null}
                            onClick={() => {
                              void link(item);
                            }}
                            style={{
                              ...blackButton,
                              height: "2rem",
                              paddingInline: "0.875rem",
                              flexShrink: 0,
                              opacity: pendingSku !== null ? 0.4 : 1,
                              cursor:
                                pendingSku !== null ? "not-allowed" : "pointer",
                            }}
                          >
                            {pendingSku === item.sku ? "Linking…" : "Link"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="apm-preview">
                  {highlighted && (
                    <PickerPreview
                      key={highlighted.sku}
                      item={highlighted}
                      linked={isLinked(highlighted)}
                      busy={pendingSku !== null}
                      linking={pendingSku === highlighted.sku}
                      onLink={() => {
                        void link(highlighted);
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            paddingTop: "0.875rem",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={mutedText}>
            Rifles and pistols can&apos;t be linked as accessories, so they
            aren&apos;t listed.
          </p>
          <button type="button" onClick={handleClose} style={textButton}>
            Done
          </button>
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
  linked,
  busy,
  linking,
  onLink,
}: {
  item: LinkableAccessory;
  linked: boolean;
  busy: boolean;
  linking: boolean;
  onLink: () => void;
}) {
  const stockView = stockInfo(item);
  const hint = linked
    ? "Already linked to this product."
    : item.publishStatus !== "PUBLISHED"
      ? "Hidden on the store until published. You can link it now; shoppers see it once it's published."
      : "Added to the end of this product's accessory list.";

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Category", value: item.categoryNameEn },
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
      {!linked && (
        <button
          type="button"
          disabled={busy}
          onClick={onLink}
          style={{
            ...blackButton,
            width: "100%",
            opacity: busy ? 0.4 : 1,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {linking ? "Linking…" : "Link accessory"}
        </button>
      )}
      <a
        href={`/admin/products/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "var(--text-body-sm)",
          color: "#0b0b0b",
          textDecoration: "underline",
          alignSelf: "flex-start",
        }}
      >
        Open product page
      </a>
    </div>
  );
}
