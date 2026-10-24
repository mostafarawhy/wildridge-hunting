"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import CategoryMoveModal from "@/components/admin/CategoryMoveModal";
import {
  deleteCategoryAction,
  setCategoryVisibilityAction,
} from "@/lib/actions/category";

interface Props {
  category: {
    id: string;
    nameEn: string;
    slug: string;
    isVisible: boolean;
    parentId: string | null;
    productCount: number;
    extraProductCount: number;
    childCount: number;
  };
  parents: { id: string; nameEn: string }[];
  dirty: boolean;
}

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
};

const MENU_WIDTH = 240;

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  paddingInline: "1rem",
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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function CategoryPageActions({
  category,
  parents,
  dirty,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const menuOpen = menu !== null;
  const {
    id,
    nameEn,
    slug,
    isVisible,
    parentId,
    productCount,
    extraProductCount,
    childCount,
  } = category;
  const isEmpty = productCount === 0 && childCount === 0;

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
    if (rect.bottom + 300 > window.innerHeight) {
      setMenu({ left, bottom: window.innerHeight - rect.top + 4 });
    } else {
      setMenu({ left, top: rect.bottom + 4 });
    }
  }

  function navigate(href: string) {
    setMenu(null);
    startNavigationProgress(href);
  }

  async function changeVisibility(next: boolean) {
    setPending(true);
    const result = await setCategoryVisibilityAction(id, next);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(
      next ? "Category is now visible." : "Category is now hidden.",
    );
    router.refresh();
    return true;
  }

  function onPrimary() {
    if (!isVisible) {
      if (isEmpty && extraProductCount === 0) setShowOpen(true);
      else void changeVisibility(true);
      return;
    }
    if (isEmpty) void changeVisibility(false);
    else setHideOpen(true);
  }

  async function confirmShow() {
    const ok = await changeVisibility(true);
    if (ok) setShowOpen(false);
  }

  async function confirmHide() {
    const ok = await changeVisibility(false);
    if (ok) setHideOpen(false);
  }

  async function confirmDelete() {
    setPending(true);
    const result = await deleteCategoryAction(id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Category deleted.");
    startNavigationProgress("/admin/categories");
    router.push("/admin/categories");
  }

  let hideMessage = `Hide "${nameEn}"? It leaves the store menu and its page shows no products.`;
  if (productCount > 0) {
    hideMessage += ` Its ${plural(productCount, "product", "products")} leave the store until it's shown again, including All products and search.`;
  }
  if (childCount > 0) {
    hideMessage += " Its subcategories leave the menu too.";
  }

  let deleteMessage = `Delete "${nameEn}"? It's removed from the store and the admin. The audit log keeps its history.`;
  if (extraProductCount > 0) {
    deleteMessage += ` ${plural(extraProductCount, "product", "products")} also listed here will be taken off it.`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <StatusPill shown={isVisible} />

      <button
        type="button"
        disabled={pending}
        onClick={onPrimary}
        style={{ ...primaryButton, opacity: pending ? 0.6 : 1 }}
      >
        {isVisible ? "Hide" : "Show in store"}
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
            {isVisible && (
              <a
                role="menuitem"
                href={`/en/shop/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenu(null)}
                style={menuItem}
              >
                View on store
              </a>
            )}
            <Link
              role="menuitem"
              href={`/admin/products?category=${id}`}
              onClick={() => navigate(`/admin/products?category=${id}`)}
              style={menuItem}
            >
              View its products
            </Link>
            {parentId === null && (
              <Link
                role="menuitem"
                href={`/admin/categories/new?parent=${id}`}
                onClick={() => navigate(`/admin/categories/new?parent=${id}`)}
                style={menuItem}
              >
                Add subcategory
              </Link>
            )}
            {dirty ? (
              <div role="menuitem" aria-disabled="true" style={menuItemMuted}>
                Save or discard your changes first.
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  setMoveOpen(true);
                }}
                style={menuItem}
              >
                Move to…
              </button>
            )}
            {isEmpty ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  setDeleteOpen(true);
                }}
                style={{ ...menuItem, color: "var(--color-error)" }}
              >
                Delete…
              </button>
            ) : (
              <>
                <div role="menuitem" aria-disabled="true" style={menuItemMuted}>
                  {productCount > 0
                    ? `Can't delete: holds ${plural(productCount, "product", "products")}`
                    : `Can't delete: has ${plural(childCount, "subcategory", "subcategories")}`}
                </div>
                {productCount > 0 && (
                  <Link
                    role="menuitem"
                    href={`/admin/products?category=${id}`}
                    onClick={() => navigate(`/admin/products?category=${id}`)}
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

      <ConfirmDialog
        open={showOpen}
        onClose={() => {
          if (!pending) setShowOpen(false);
        }}
        onConfirm={() => {
          void confirmShow();
        }}
        title="Show category"
        message={`Show "${nameEn}"? It has no products yet, so its page will be empty.`}
        confirmLabel="Show"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />

      <ConfirmDialog
        open={hideOpen}
        onClose={() => {
          if (!pending) setHideOpen(false);
        }}
        onConfirm={() => {
          void confirmHide();
        }}
        title="Hide category"
        message={hideMessage}
        confirmLabel="Hide"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (!pending) setDeleteOpen(false);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete category"
        message={deleteMessage}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={pending}
        destructive
        requireTypedConfirm
      />

      <CategoryMoveModal
        open={moveOpen}
        category={{ id, nameEn, parentId, childCount }}
        parents={parents}
        onClose={() => setMoveOpen(false)}
        onMoved={() => setMoveOpen(false)}
      />
    </div>
  );
}
