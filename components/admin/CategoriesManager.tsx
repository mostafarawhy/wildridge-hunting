"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DataTable from "@/components/admin/DataTable";
import CategoryMoveModal from "@/components/admin/CategoryMoveModal";
import {
  reorderCategoryAction,
  setCategoryVisibilityAction,
  deleteCategoryAction,
} from "@/lib/actions/category";
import type { AdminCategoryNode } from "@/lib/db/queries/categories";

type CategoryNode = AdminCategoryNode["children"][number];

interface Props {
  initial: AdminCategoryNode[];
}

interface Row {
  node: CategoryNode;
  parent: AdminCategoryNode | null;
}

interface DisplayRow extends Row {
  context: boolean;
  inside: number;
}

type Tab = "ALL" | "SHOWN" | "HIDDEN";
type Sort = "store" | "name" | "most" | "fewest";

interface Filters {
  q: string;
  tab: Tab;
  group: string;
  level: string;
  products: string;
  sort: Sort;
}

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
};

const MENU_WIDTH = 240;

const TABS: { value: Tab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SHOWN", label: "Shown" },
  { value: "HIDDEN", label: "Hidden" },
];

const NAV_GROUP_LABELS: Record<string, string> = {
  RIFLES: "Rifles & Pistols",
  OPTICS: "Optics",
  AMMO: "Ammo",
  ACCESSORIES: "Accessories",
};

const GROUP_VALUES = ["RIFLES", "OPTICS", "AMMO", "ACCESSORIES", "OWN"];
const LEVEL_VALUES = ["top", "sub"];
const PRODUCT_VALUES = ["empty", "unpublished"];
const SORT_VALUES: Sort[] = ["store", "name", "most", "fewest"];

const DEFAULT_FILTERS: Filters = {
  q: "",
  tab: "ALL",
  group: "",
  level: "",
  products: "",
  sort: "store",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
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

const smallBlackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2rem",
  paddingInline: "0.875rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--radius-none)",
  cursor: "pointer",
};

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.625rem 1rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textAlign: "start",
  textDecoration: "none",
  background: "none",
  border: "none",
  borderRadius: 0,
  cursor: "pointer",
};

const menuItemMuted: React.CSSProperties = {
  ...menuItem,
  color: "#6b6b6b",
  cursor: "default",
};

const mutedSmall: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const markStyle: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  color: "inherit",
  padding: 0,
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[-_/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function highlight(text: string, words: string[]): React.ReactNode {
  const ranges: [number, number][] = [];
  for (const word of words) {
    if (!/^[a-z0-9 ]+$/.test(word)) continue;
    const match = new RegExp(word.replace(/ /g, "[ -]"), "i").exec(text);
    if (match) ranges.push([match.index, match.index + match[0].length]);
  }
  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], i) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={i} style={markStyle}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function parseFilters(params: { get(name: string): string | null }): Filters {
  const status = params.get("status");
  const group = params.get("group") ?? "";
  const level = params.get("level") ?? "";
  const products = params.get("products") ?? "";
  const sort = params.get("sort") as Sort | null;
  return {
    q: params.get("q") ?? "",
    tab: status === "shown" ? "SHOWN" : status === "hidden" ? "HIDDEN" : "ALL",
    group: GROUP_VALUES.includes(group) ? group : "",
    level: LEVEL_VALUES.includes(level) ? level : "",
    products: PRODUCT_VALUES.includes(products) ? products : "",
    sort: sort && SORT_VALUES.includes(sort) ? sort : "store",
  };
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        transform: expanded ? undefined : "rotate(-90deg)",
        transition: "transform 150ms",
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function StatusPill({ shown }: { shown: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        backgroundColor: shown ? "#dcfce7" : "#f3f4f6",
        color: shown ? "#166534" : "#374151",
      }}
    >
      {shown ? "Shown" : "Hidden"}
    </span>
  );
}

function RowActions({
  row,
  busy,
  showOrder,
  canUp,
  canDown,
  onToggleVisibility,
  onReorder,
  onMove,
  onDelete,
}: {
  row: Row;
  busy: boolean;
  showOrder: boolean;
  canUp: boolean;
  canDown: boolean;
  onToggleVisibility: (row: Row) => void;
  onReorder: (row: Row, direction: "up" | "down") => void;
  onMove: (row: Row) => void;
  onDelete: (row: Row) => void;
}) {
  const { node, parent } = row;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const menuOpen = menu !== null;

  const canDelete = node.productCount === 0 && node.childCount === 0;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenu(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(null);
        triggerRef.current?.focus();
      }
    }
    function close() {
      setMenu(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = document.documentElement.dir === "rtl";
    const left = Math.max(
      8,
      Math.min(
        rtl ? rect.left : rect.right - MENU_WIDTH,
        window.innerWidth - MENU_WIDTH - 8,
      ),
    );
    if (rect.bottom + 380 > window.innerHeight) {
      setMenu({ left, bottom: window.innerHeight - rect.top + 4 });
    } else {
      setMenu({ left, top: rect.bottom + 4 });
    }
  }

  function navigate(href: string) {
    setMenu(null);
    startNavigationProgress(href);
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "0.5rem",
      }}
    >
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility(row);
        }}
        style={{ ...smallBlackButton, opacity: busy ? 0.6 : 1 }}
      >
        {node.isVisible ? "Hide" : "Show"}
      </button>

      <button
        ref={triggerRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={toggleMenu}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          padding: 0,
          background: "none",
          border: "none",
          color: "#0b0b0b",
          cursor: "pointer",
        }}
      >
        <DotsIcon />
      </button>

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: menu.left,
              top: menu.top,
              bottom: menu.bottom,
              width: MENU_WIDTH,
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
              boxShadow: "var(--shadow-modal)",
              paddingBlock: "0.25rem",
              zIndex: 300,
            }}
          >
            <Link
              role="menuitem"
              href={`/admin/categories/${node.id}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/categories/${node.id}`);
              }}
              style={menuItem}
            >
              Edit
            </Link>
            {node.isVisible && (
              <a
                role="menuitem"
                href={`/en/shop/${node.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(null);
                }}
                style={menuItem}
              >
                View on store
              </a>
            )}
            {!parent && (
              <Link
                role="menuitem"
                href={`/admin/categories/new?parent=${node.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/categories/new?parent=${node.id}`);
                }}
                style={menuItem}
              >
                Add subcategory
              </Link>
            )}
            {showOrder &&
              (["up", "down"] as const).map((direction) => {
                const enabled = direction === "up" ? canUp : canDown;
                const label = direction === "up" ? "Move up" : "Move down";
                return enabled ? (
                  <button
                    key={direction}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenu(null);
                      onReorder(row, direction);
                    }}
                    style={menuItem}
                  >
                    {label}
                  </button>
                ) : (
                  <div
                    key={direction}
                    role="menuitem"
                    aria-disabled="true"
                    style={menuItemMuted}
                  >
                    {label}
                  </div>
                );
              })}
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
                onMove(row);
              }}
              style={menuItem}
            >
              Move to…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
                onToggleVisibility(row);
              }}
              style={menuItem}
            >
              {node.isVisible ? "Hide" : "Show"}
            </button>
            {canDelete ? (
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(null);
                  onDelete(row);
                }}
                style={{ ...menuItem, color: "var(--color-error)" }}
              >
                Delete…
              </button>
            ) : (
              <>
                <div role="menuitem" aria-disabled="true" style={menuItemMuted}>
                  {node.productCount > 0
                    ? `Can't delete: holds ${plural(node.productCount, "product", "products")}`
                    : `Can't delete: has ${plural(node.childCount, "subcategory", "subcategories")}`}
                </div>
                {node.productCount > 0 && (
                  <Link
                    role="menuitem"
                    href={`/admin/products?category=${node.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/products?category=${node.id}`);
                    }}
                    style={{ ...menuItem, textDecoration: "underline" }}
                  >
                    Show its products
                  </Link>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function CategoriesManager({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() =>
    parseFilters(searchParams),
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const [hideTarget, setHideTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [showTarget, setShowTarget] = useState<Row | null>(null);
  const [moveTarget, setMoveTarget] = useState<Row | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);

    const params = new URLSearchParams(window.location.search);
    const sync = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    sync("q", next.q.trim());
    sync("status", next.tab === "ALL" ? "" : next.tab.toLowerCase());
    sync("group", next.group);
    sync("level", next.level);
    sync("products", next.products);
    sync("sort", next.sort === "store" ? "" : next.sort);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}`,
    );
  }

  function clearAll() {
    update({
      q: "",
      tab: DEFAULT_FILTERS.tab,
      group: "",
      level: "",
      products: "",
    });
  }

  const allRows: Row[] = [];
  for (const parent of initial) {
    allRows.push({ node: parent, parent: null });
    for (const child of parent.children) {
      allRows.push({ node: child, parent });
    }
  }

  const counts: Record<Tab, number> = {
    ALL: allRows.length,
    SHOWN: allRows.filter((r) => r.node.isVisible).length,
    HIDDEN: allRows.filter((r) => !r.node.isVisible).length,
  };

  const words = normalize(filters.q).split(" ").filter(Boolean);
  const searchActive = words.length > 0;
  const treeMode = filters.sort === "store";
  const filtersActive =
    searchActive ||
    filters.tab !== "ALL" ||
    filters.group !== "" ||
    filters.level !== "" ||
    filters.products !== "";

  function matchesRow(row: Row): boolean {
    const { node, parent } = row;
    if (filters.tab === "SHOWN" && !node.isVisible) return false;
    if (filters.tab === "HIDDEN" && node.isVisible) return false;
    if (filters.level === "top" && parent) return false;
    if (filters.level === "sub" && !parent) return false;
    if (filters.group) {
      const group = (parent ? parent.navGroup : node.navGroup) ?? "OWN";
      if (group !== filters.group) return false;
    }
    if (
      filters.products === "empty" &&
      !(node.productCount === 0 && node.childCount === 0)
    ) {
      return false;
    }
    if (
      filters.products === "unpublished" &&
      !(node.publishedCount < node.productCount)
    ) {
      return false;
    }
    if (searchActive) {
      const haystack = normalize(
        `${node.nameEn} ${node.nameAr} ${node.nameRu ?? ""} ${node.slug} shop ${node.slug}`,
      );
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  }

  const matched = allRows.filter(matchesRow);

  function compareRows(a: Row, b: Row) {
    const byName = a.node.nameEn.localeCompare(b.node.nameEn);
    if (filters.sort === "most") {
      return b.node.productCount - a.node.productCount || byName;
    }
    if (filters.sort === "fewest") {
      return a.node.productCount - b.node.productCount || byName;
    }
    return byName;
  }

  const rows: DisplayRow[] = [];
  if (treeMode) {
    for (const parent of initial) {
      const parentRow: Row = { node: parent, parent: null };
      const kids: Row[] = parent.children
        .map((child) => ({ node: child, parent }))
        .filter(matchesRow);
      const parentMatches = matchesRow(parentRow);
      if (!parentMatches && kids.length === 0) continue;
      rows.push({
        ...parentRow,
        context: !parentMatches,
        inside: parentMatches ? 0 : kids.length,
      });
      if (searchActive || !collapsed.has(parent.id)) {
        for (const kid of kids) rows.push({ ...kid, context: false, inside: 0 });
      }
    }
  } else {
    for (const row of [...matched].sort(compareRows)) {
      rows.push({ ...row, context: false, inside: 0 });
    }
  }

  const parentsWithChildren = initial.filter((p) => p.children.length > 0);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runVisibility(row: Row, isVisible: boolean) {
    setBusyId(row.node.id);
    const result = await setCategoryVisibilityAction(row.node.id, isVisible);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(
      isVisible ? "Category is now visible." : "Category is now hidden.",
    );
    router.refresh();
    return true;
  }

  function toggleVisibility(row: Row) {
    if (!row.node.isVisible) {
      if (row.node.productCount === 0 && row.node.childCount === 0) {
        setShowTarget(row);
        return;
      }
      void runVisibility(row, true);
      return;
    }
    if (row.node.productCount === 0 && row.node.childCount === 0) {
      void runVisibility(row, false);
      return;
    }
    setHideTarget(row);
  }

  async function confirmShow() {
    if (!showTarget) return;
    setPending(true);
    const ok = await runVisibility(showTarget, true);
    setPending(false);
    if (ok) setShowTarget(null);
  }

  async function confirmHide() {
    if (!hideTarget) return;
    setPending(true);
    const ok = await runVisibility(hideTarget, false);
    setPending(false);
    if (ok) setHideTarget(null);
  }

  async function reorder(row: Row, direction: "up" | "down") {
    setBusyId(row.node.id);
    const result = await reorderCategoryAction(row.node.id, direction);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Order updated.");
    router.refresh();
  }

  function openMove(row: Row) {
    setMoveTarget(row);
    setMoveOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true);
    const result = await deleteCategoryAction(deleteTarget.node.id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Category deleted.");
    setDeleteTarget(null);
    router.refresh();
  }

  function hideMessage(row: Row | null) {
    if (!row) return "";
    const { node } = row;
    let message = `Hide "${node.nameEn}"? It leaves the store menu and its page shows no products.`;
    if (node.productCount > 0) {
      message += ` Its ${plural(node.productCount, "product", "products")} still appear in All products and search.`;
    }
    if (node.childCount > 0) {
      message += " Its subcategories leave the menu too.";
    }
    return message;
  }

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        subtitle="Organise the store menu and category pages."
        actions={
          <Link
            href="/admin/categories/new"
            style={{
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
              textDecoration: "none",
              borderRadius: "0",
            }}
          >
            New category
          </Link>
        }
      />

      {initial.length === 0 ? (
        <p style={{ fontSize: "var(--text-body)", color: "#6b6b6b", margin: 0 }}>
          No categories yet.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <div
              role="tablist"
              aria-label="Category status"
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                borderBottom: "1px solid var(--color-shop-divider)",
                marginBottom: "1rem",
              }}
            >
              {TABS.map((t) => {
                const active = filters.tab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => update({ tab: t.value })}
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
                    {t.label} ({counts[t.value]})
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
              <div>
                <label htmlFor="category-filter-search" style={labelStyle}>
                  Search
                </label>
                <input
                  id="category-filter-search"
                  type="text"
                  dir="auto"
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") update({ q: "" });
                  }}
                  placeholder="Name in any language, or web address"
                  style={inputStyle}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
                <Select
                  id="category-filter-group"
                  label="Menu group"
                  value={filters.group}
                  onChange={(e) => update({ group: e.target.value })}
                >
                  <option value="">All menu groups</option>
                  <option value="RIFLES">Rifles &amp; Pistols</option>
                  <option value="OPTICS">Optics</option>
                  <option value="AMMO">Ammo</option>
                  <option value="ACCESSORIES">Accessories</option>
                  <option value="OWN">Own menu item</option>
                </Select>
                <Select
                  id="category-filter-level"
                  label="Level"
                  value={filters.level}
                  onChange={(e) => update({ level: e.target.value })}
                >
                  <option value="">All levels</option>
                  <option value="top">Top level</option>
                  <option value="sub">Subcategories</option>
                </Select>
                <Select
                  id="category-filter-products"
                  label="Products"
                  value={filters.products}
                  onChange={(e) => update({ products: e.target.value })}
                >
                  <option value="">Any products</option>
                  <option value="empty">Empty</option>
                  <option value="unpublished">Has unpublished</option>
                </Select>
                <Select
                  id="category-filter-sort"
                  label="Sort"
                  value={filters.sort}
                  onChange={(e) => update({ sort: e.target.value as Sort })}
                >
                  <option value="store">Store order</option>
                  <option value="name">Name A–Z</option>
                  <option value="most">Most products</option>
                  <option value="fewest">Fewest products</option>
                </Select>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
              marginBottom: "0.75rem",
            }}
          >
            <p style={{ ...mutedSmall, margin: 0 }}>
              {filtersActive
                ? `Showing ${matched.length} of ${plural(allRows.length, "category", "categories")}`
                : plural(allRows.length, "category", "categories")}
            </p>
            {treeMode && !searchActive && parentsWithChildren.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setCollapsed(new Set())}
                  style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed(new Set(parentsWithChildren.map((p) => p.id)))
                  }
                  style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                >
                  Collapse all
                </button>
              </>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearAll}
                style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
              >
                Clear all
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-shop-divider)",
                padding: "3rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <p style={{ fontSize: "var(--text-body)", color: "#6b6b6b", margin: 0 }}>
                No categories match.
              </p>
              <button type="button" onClick={clearAll} style={textButton}>
                Clear all
              </button>
            </div>
          ) : (
            <DataTable
              rows={rows}
              getRowKey={(row) => row.node.id}
              onRowClick={(row) => {
                const href = `/admin/categories/${row.node.id}`;
                startNavigationProgress(href);
                router.push(href);
              }}
              columns={[
                {
                  key: "category",
                  header: "Category",
                  render: (row) => {
                    const { node, parent } = row;
                    const isChild = parent !== null;
                    const treeChild = treeMode && isChild;
                    const hasKids = !isChild && node.childCount > 0;
                    const expanded = !collapsed.has(node.id);

                    const meta: React.ReactNode[] = [
                      <span key="slug" dir="ltr">
                        /shop/{highlight(node.slug, words)}
                      </span>,
                    ];
                    if (!isChild) {
                      meta.push(
                        node.navGroup
                          ? (NAV_GROUP_LABELS[node.navGroup] ?? node.navGroup)
                          : "Own menu item",
                      );
                      if (node.childCount > 0) {
                        meta.push(
                          plural(node.childCount, "subcategory", "subcategories"),
                        );
                      }
                    }
                    if (!treeMode && parent) meta.push(`in ${parent.nameEn}`);
                    if (row.context) meta.push(`${row.inside} matching inside`);

                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.375rem",
                          paddingInlineStart: treeChild ? "1.75rem" : undefined,
                          opacity: row.context ? 0.55 : 1,
                        }}
                      >
                        {treeChild && (
                          <span
                            aria-hidden="true"
                            style={{
                              display: "inline-block",
                              flexShrink: 0,
                              width: "12px",
                              height: "14px",
                              borderInlineStart: "1px solid #d0cbc4",
                              borderBottom: "1px solid #d0cbc4",
                            }}
                          />
                        )}
                        {treeMode && !isChild && (
                          <span
                            style={{
                              display: "inline-flex",
                              flexShrink: 0,
                              width: "1.25rem",
                              height: "1.25rem",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {hasKids && (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                aria-label={
                                  expanded
                                    ? "Hide subcategories"
                                    : "Show subcategories"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCollapsed(node.id);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "1.25rem",
                                  height: "1.25rem",
                                  padding: 0,
                                  background: "none",
                                  border: "none",
                                  color: "#0b0b0b",
                                  cursor: "pointer",
                                }}
                              >
                                <ChevronIcon expanded={expanded} />
                              </button>
                            )}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              color: "#0b0b0b",
                              fontWeight: isChild
                                ? "var(--font-medium)"
                                : "var(--font-bold)",
                            }}
                          >
                            {highlight(node.nameEn, words)}
                            <bdi
                              dir="rtl"
                              style={{
                                marginInlineStart: "0.5rem",
                                fontWeight: "var(--font-normal)",
                                color: "#6b6b6b",
                              }}
                            >
                              {node.nameAr}
                            </bdi>
                          </p>
                          <p style={mutedSmall}>
                            {meta.map((part, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                {part}
                              </span>
                            ))}
                          </p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "products",
                  header: "Products",
                  align: "end",
                  render: (row) => (
                    <span
                      dir="ltr"
                      style={{
                        whiteSpace: "nowrap",
                        opacity: row.context ? 0.55 : 1,
                      }}
                    >
                      <Link
                        href={`/admin/products?category=${row.node.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          startNavigationProgress(
                            `/admin/products?category=${row.node.id}`,
                          );
                        }}
                        style={{ color: "#0b0b0b", textDecoration: "underline" }}
                      >
                        {row.node.productCount}
                      </Link>
                      {row.node.publishedCount !== row.node.productCount && (
                        <span style={{ color: "#6b6b6b" }}>
                          {" "}
                          · {row.node.publishedCount} published
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <span style={{ opacity: row.context ? 0.55 : 1 }}>
                      <StatusPill shown={row.node.isVisible} />
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  align: "end",
                  render: (row) => {
                    const siblings = row.parent ? row.parent.children : initial;
                    const index = siblings.findIndex(
                      (s) => s.id === row.node.id,
                    );
                    return (
                      <RowActions
                        row={row}
                        busy={busyId === row.node.id}
                        showOrder={treeMode}
                        canUp={index > 0}
                        canDown={index >= 0 && index < siblings.length - 1}
                        onToggleVisibility={toggleVisibility}
                        onReorder={(r, direction) => void reorder(r, direction)}
                        onMove={openMove}
                        onDelete={setDeleteTarget}
                      />
                    );
                  },
                },
              ]}
            />
          )}
        </>
      )}

      <CategoryMoveModal
        open={moveOpen}
        category={
          moveTarget
            ? {
                id: moveTarget.node.id,
                nameEn: moveTarget.node.nameEn,
                parentId: moveTarget.parent?.id ?? null,
                childCount: moveTarget.node.childCount,
              }
            : null
        }
        parents={initial}
        onClose={() => setMoveOpen(false)}
        onMoved={() => setMoveOpen(false)}
      />

      <ConfirmDialog
        open={!!showTarget}
        onClose={() => {
          if (!pending) setShowTarget(null);
        }}
        onConfirm={() => {
          void confirmShow();
        }}
        title="Show category"
        message={`Show "${showTarget?.node.nameEn ?? ""}"? It has no products yet, so its page will be empty.`}
        confirmLabel="Show"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />

      <ConfirmDialog
        open={!!hideTarget}
        onClose={() => {
          if (!pending) setHideTarget(null);
        }}
        onConfirm={() => {
          void confirmHide();
        }}
        title="Hide category"
        message={hideMessage(hideTarget)}
        confirmLabel="Hide"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!pending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete category"
        message={`Delete "${deleteTarget?.node.nameEn ?? ""}"? It's removed from the store and the admin. The audit log keeps its history.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={pending}
        destructive
        requireTypedConfirm
      />
    </div>
  );
}
