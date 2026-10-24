"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import FadeImage from "@/components/ui/FadeImage";
import { formatAED } from "@/lib/utils/currency";
import type { FeaturedPickerItem } from "@/lib/db/queries/collections";

interface Props {
  open: boolean;
  onClose: () => void;
  items: FeaturedPickerItem[];
  placesLeft: number;
  onAdd: (skus: string[]) => void;
}

const NBSP2 = "  ";
const PATH_SEPARATOR = " › ";

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

function brandOf(item: FeaturedPickerItem): string {
  return item.brand?.nameEn ?? "";
}

function categoryName(item: FeaturedPickerItem): string {
  const at = item.categoryLabel.lastIndexOf(PATH_SEPARATOR);
  return at === -1 ? item.categoryLabel : item.categoryLabel.slice(at + PATH_SEPARATOR.length);
}

function parentName(item: FeaturedPickerItem): string | null {
  const at = item.categoryLabel.lastIndexOf(PATH_SEPARATOR);
  return at === -1 ? null : item.categoryLabel.slice(0, at);
}

interface CategoryGroup {
  id: string;
  name: string;
  children: Map<string, string>;
}

function buildCategoryGroups(items: FeaturedPickerItem[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const item of items) {
    const parent = parentName(item);
    if (item.parentCategoryId && parent) {
      let group = groups.get(item.parentCategoryId);
      if (!group) {
        group = { id: item.parentCategoryId, name: parent, children: new Map() };
        groups.set(group.id, group);
      }
      group.children.set(item.categoryId, categoryName(item));
    } else if (!groups.has(item.categoryId)) {
      groups.set(item.categoryId, {
        id: item.categoryId,
        name: categoryName(item),
        children: new Map(),
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function FeaturedProductPickerModal({
  open,
  onClose,
  items,
  placesLeft,
  onAdd,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [highlightSku, setHighlightSku] = useState<string | null>(null);
  const [ticked, setTicked] = useState<readonly string[]>([]);

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
      [...new Set(items.map(brandOf).filter((b) => b !== ""))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );
  const itemBySku = useMemo(
    () => new Map(items.map((i) => [i.sku, i])),
    [items],
  );

  const needle = search.trim().toLowerCase();
  const filtersActive = needle !== "" || category !== "" || brand !== "";

  const visible = items.filter((item) => {
    if (
      needle &&
      !item.nameEn.toLowerCase().includes(needle) &&
      !item.nameAr.toLowerCase().includes(needle) &&
      !(item.nameRu ?? "").toLowerCase().includes(needle) &&
      !item.sku.toLowerCase().includes(needle) &&
      !brandOf(item).toLowerCase().includes(needle)
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
    if (brand && brandOf(item) !== brand) return false;
    return true;
  });

  const left = Math.max(0, placesLeft - ticked.length);
  const selectable = visible.filter((item) => !ticked.includes(item.sku));
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
    setHighlightSku(null);
  }

  function handleClose() {
    clearFilters();
    setTicked([]);
    onClose();
  }

  function toggle(item: FeaturedPickerItem) {
    setTicked((prev) => {
      if (prev.includes(item.sku)) return prev.filter((sku) => sku !== item.sku);
      if (prev.length >= placesLeft) return prev;
      return [...prev, item.sku];
    });
  }

  function selectAllMatching() {
    setTicked((prev) => {
      const room = Math.max(0, placesLeft - prev.length);
      return [
        ...prev,
        ...visible
          .map((i) => i.sku)
          .filter((sku) => !prev.includes(sku))
          .slice(0, room),
      ];
    });
  }

  function submit(skus: string[]) {
    if (skus.length === 0) return;
    onAdd(skus);
    handleClose();
  }

  function addCurrent() {
    if (ticked.length > 0) {
      submit([...ticked]);
      return;
    }
    if (highlighted && placesLeft > 0) submit([highlighted.sku]);
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
        .fpp-body { display: flex; gap: 1.25rem; align-items: flex-start; }
        .fpp-list { flex: 0 0 58%; max-width: 58%; max-height: 26rem; overflow-y: auto; border: 1px solid var(--color-shop-divider); margin: 0; padding: 0; list-style: none; outline: none; }
        .fpp-preview { flex: 1; min-width: 0; }
        .fpp-filter { flex: 1 1 11rem; min-width: 0; }
        @media (max-width: 719px) {
          .fpp-list { flex-basis: 100%; max-width: 100%; }
          .fpp-preview { display: none; }
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
          <p style={eyebrow}>Homepage · Featured products</p>
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
          <p style={mutedText}>
            Search or filter, tick products, then add them. Only products live on
            the shop are listed.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No products to add"
            body="Every product live on the shop is already picked, or none are live yet."
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
                <div className="fpp-filter">
                  <Select
                    label="Category"
                    id="fpp-category"
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
                <div className="fpp-filter">
                  <Select
                    label="Brand"
                    id="fpp-brand"
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
                  {visible.length} of {items.length} products ·{" "}
                  {plural(left, "place", "places")} left
                </p>
                <p style={mutedText}>↑ ↓ move · Space tick · Enter add</p>
                {selectable.length > 0 && left > 0 && (
                  <button
                    type="button"
                    onClick={selectAllMatching}
                    style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                  >
                    Select all matching
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
              <div className="fpp-body">
                <ul
                  ref={listRef}
                  className="fpp-list"
                  tabIndex={0}
                  aria-label="Products"
                  onKeyDown={(e) => handleKeyDown(e, true)}
                >
                  {visible.map((item) => {
                    const isTicked = ticked.includes(item.sku);
                    const active = item.sku === highlightedSku;
                    const full = !isTicked && left === 0;
                    return (
                      <li
                        key={item.sku}
                        data-sku={item.sku}
                        onMouseEnter={() => setHighlightSku(item.sku)}
                        onClick={() => setHighlightSku(item.sku)}
                        style={{
                          display: "flex",
                          alignItems: "center",
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
                        <input
                          type="checkbox"
                          aria-label={`Tick ${item.nameEn}`}
                          checked={isTicked}
                          disabled={full}
                          onChange={() => toggle(item)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 16,
                            height: 16,
                            flexShrink: 0,
                            accentColor: "#0b0b0b",
                            cursor: full ? "not-allowed" : "pointer",
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
                            src={item.imageUrl}
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
                            </span>
                            {brandOf(item) && ` · ${brandOf(item)}`}
                          </span>
                          <span style={{ fontSize: 13, color: "#9a9a9a" }}>
                            {item.categoryLabel}
                          </span>
                          <span dir="ltr" style={{ fontSize: 13, color: "#0b0b0b" }}>
                            {formatAED(item.price, "en")}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="fpp-preview">
                  {highlighted && (
                    <PickerPreview
                      key={highlighted.sku}
                      item={highlighted}
                      isTicked={ticked.includes(highlighted.sku)}
                      canTick={left > 0 || ticked.includes(highlighted.sku)}
                      onToggle={() => toggle(highlighted)}
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
              onClick={() => {
                if (ticked.length === 0) {
                  searchRef.current?.focus();
                  return;
                }
                submit([...ticked]);
              }}
              style={blackButton}
            >
              {ticked.length === 0
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
  isTicked,
  canTick,
  onToggle,
}: {
  item: FeaturedPickerItem;
  isTicked: boolean;
  canTick: boolean;
  onToggle: () => void;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Category", value: item.categoryLabel },
    { label: "Brand", value: brandOf(item) || "—" },
    { label: "Price", value: <span dir="ltr">{formatAED(item.price, "en")}</span> },
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
          src={item.imageUrl}
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
      <button
        type="button"
        disabled={!canTick}
        onClick={onToggle}
        style={{
          ...blackButton,
          width: "100%",
          opacity: canTick ? 1 : 0.5,
          cursor: canTick ? "pointer" : "not-allowed",
        }}
      >
        {isTicked ? "Ticked ✓ · Untick" : "Tick"}
      </button>
    </div>
  );
}
