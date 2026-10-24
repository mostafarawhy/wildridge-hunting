"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DataTable from "@/components/admin/DataTable";
import {
  setBrandVisibilityAction,
  deleteBrandAction,
} from "@/lib/actions/brand";
import type { AdminBrandRow } from "@/lib/db/queries/brands";

interface Props {
  initial: AdminBrandRow[];
}

type Tab = "ALL" | "SHOWN" | "HIDDEN";

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

const blackLink: React.CSSProperties = {
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

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[-_/&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
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

function AddBrandLink() {
  return (
    <Link
      href="/admin/brands/new"
      onClick={() => startNavigationProgress("/admin/brands/new")}
      style={blackLink}
    >
      Add brand
    </Link>
  );
}

function RowActions({
  brand,
  busy,
  onToggleVisibility,
  onDelete,
}: {
  brand: AdminBrandRow;
  busy: boolean;
  onToggleVisibility: (brand: AdminBrandRow) => void;
  onDelete: (brand: AdminBrandRow) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const menuOpen = menu !== null;

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
    if (rect.bottom + 200 > window.innerHeight) {
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
          onToggleVisibility(brand);
        }}
        style={{ ...smallBlackButton, opacity: busy ? 0.6 : 1 }}
      >
        {brand.isVisible ? "Hide" : "Show"}
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
              href={`/admin/brands/${brand.id}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/brands/${brand.id}`);
              }}
              style={menuItem}
            >
              Edit
            </Link>
            {brand.productCount === 0 ? (
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(null);
                  onDelete(brand);
                }}
                style={{ ...menuItem, color: "var(--color-error)" }}
              >
                Delete…
              </button>
            ) : (
              <>
                <div role="menuitem" aria-disabled="true" style={menuItemMuted}>
                  {`Can't delete: used by ${plural(brand.productCount, "product", "products")}`}
                </div>
                <Link
                  role="menuitem"
                  href={`/admin/products?brand=${brand.slug}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/products?brand=${brand.slug}`);
                  }}
                  style={{ ...menuItem, textDecoration: "underline" }}
                >
                  Show its products
                </Link>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function BrandsManager({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandRow | null>(null);
  const [pending, setPending] = useState(false);

  const counts: Record<Tab, number> = {
    ALL: initial.length,
    SHOWN: initial.filter((b) => b.isVisible).length,
    HIDDEN: initial.filter((b) => !b.isVisible).length,
  };

  const words = normalize(q).split(" ").filter(Boolean);
  const filtersActive = words.length > 0 || tab !== "ALL";

  const rows = initial.filter((b) => {
    if (tab === "SHOWN" && !b.isVisible) return false;
    if (tab === "HIDDEN" && b.isVisible) return false;
    if (words.length > 0) {
      const haystack = normalize(
        `${b.nameEn} ${b.nameAr ?? ""} ${b.nameRu ?? ""} ${b.slug}`,
      );
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });

  function clearAll() {
    setQ("");
    setTab("ALL");
  }

  async function toggleVisibility(brand: AdminBrandRow) {
    const next = !brand.isVisible;
    setBusyId(brand.id);
    const result = await setBrandVisibilityAction(brand.id, next);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(next ? "Brand is now visible." : "Brand is now hidden.");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true);
    const result = await deleteBrandAction(deleteTarget.id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Brand deleted.");
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div>
      <AdminPageHeader
        title="Brands"
        subtitle="The brands products are filed under and shoppers filter by."
        actions={initial.length > 0 ? <AddBrandLink /> : undefined}
      />

      {initial.length === 0 ? (
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
            No brands yet.
          </p>
          <AddBrandLink />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <div
              role="tablist"
              aria-label="Brand status"
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                borderBottom: "1px solid var(--color-shop-divider)",
                marginBottom: "1rem",
              }}
            >
              {TABS.map((t) => {
                const active = tab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.value)}
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
                padding: "1rem 1.25rem",
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-shop-divider)",
              }}
            >
              <label htmlFor="brand-filter-search" style={labelStyle}>
                Search
              </label>
              <input
                id="brand-filter-search"
                type="text"
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQ("");
                }}
                placeholder="Name in any language, or web handle"
                style={inputStyle}
              />
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
                ? `Showing ${rows.length} of ${plural(initial.length, "brand", "brands")}`
                : plural(initial.length, "brand", "brands")}
            </p>
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
                No brands match.
              </p>
              <button type="button" onClick={clearAll} style={textButton}>
                Clear all
              </button>
            </div>
          ) : (
            <DataTable
              rows={rows}
              getRowKey={(row) => row.id}
              onRowClick={(row) => {
                const href = `/admin/brands/${row.id}`;
                startNavigationProgress(href);
                router.push(href);
              }}
              columns={[
                {
                  key: "brand",
                  header: "Brand",
                  render: (row) => (
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#0b0b0b", fontWeight: "var(--font-bold)" }}>
                        {row.nameEn}
                      </p>
                      {(row.nameAr || row.nameRu) && (
                        <p style={mutedSmall}>
                          {row.nameAr && <bdi dir="rtl">{row.nameAr}</bdi>}
                          {row.nameAr && row.nameRu && " · "}
                          {row.nameRu}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "slug",
                  header: "Web handle",
                  render: (row) => (
                    <span dir="ltr" style={mutedSmall}>
                      {row.slug}
                    </span>
                  ),
                },
                {
                  key: "products",
                  header: "Products",
                  align: "end",
                  render: (row) => (
                    <span dir="ltr" style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`/admin/products?brand=${row.slug}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          startNavigationProgress(
                            `/admin/products?brand=${row.slug}`,
                          );
                        }}
                        style={{ color: "#0b0b0b", textDecoration: "underline" }}
                      >
                        {row.productCount}
                      </Link>
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusPill shown={row.isVisible} />,
                },
                {
                  key: "actions",
                  header: "",
                  align: "end",
                  render: (row) => (
                    <RowActions
                      brand={row}
                      busy={busyId === row.id}
                      onToggleVisibility={(b) => void toggleVisibility(b)}
                      onDelete={setDeleteTarget}
                    />
                  ),
                },
              ]}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!pending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete brand"
        message={`Delete "${deleteTarget?.nameEn ?? ""}"? It's removed from the admin and the store filter. The audit log keeps its history.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={pending}
        destructive
        requireTypedConfirm
      />
    </div>
  );
}
