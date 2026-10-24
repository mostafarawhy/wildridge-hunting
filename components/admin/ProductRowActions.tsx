"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  deleteProductAction,
  setProductStatusAction,
} from "@/lib/actions/product";
import type { PublishStatus } from "@/app/generated/prisma/client";

interface Props {
  id: string;
  name: string;
  status: PublishStatus;
  slugEn: string;
  categorySlug: string;
}

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
};

const MENU_WIDTH = 208;

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

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

export default function ProductRowActions({
  id,
  name,
  status,
  slugEn,
  categorySlug,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

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
    if (rect.bottom + 260 > window.innerHeight) {
      setMenu({ left, bottom: window.innerHeight - rect.top + 4 });
    } else {
      setMenu({ left, top: rect.bottom + 4 });
    }
  }

  async function changeStatus(next: PublishStatus, successMessage: string) {
    setPending(true);
    const result = await setProductStatusAction(id, next);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(successMessage);
    router.refresh();
    return true;
  }

  async function confirmArchive() {
    const ok = await changeStatus("ARCHIVED", "Product archived.");
    if (ok) setArchiveOpen(false);
  }

  async function confirmDelete() {
    setPending(true);
    const result = await deleteProductAction(id);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    toast.success("Product deleted.");
    router.refresh();
  }

  function pickStatus(next: PublishStatus) {
    setMenu(null);
    if (next === "ARCHIVED") {
      setArchiveOpen(true);
      return;
    }
    void changeStatus(
      next,
      next === "PUBLISHED" ? "Product published." : "Moved to draft.",
    );
  }

  const statusItems: { value: PublishStatus; label: string }[] = [
    { value: "PUBLISHED", label: "Publish" },
    { value: "DRAFT", label: "Move to draft" },
    { value: "ARCHIVED", label: "Archive" },
  ];

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
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (status === "PUBLISHED") setArchiveOpen(true);
          else void changeStatus("PUBLISHED", "Product published.");
        }}
        style={{ ...smallBlackButton, opacity: pending ? 0.6 : 1 }}
      >
        {status === "PUBLISHED" ? "Archive" : "Publish"}
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
              href={`/admin/products/${id}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
                startNavigationProgress(`/admin/products/${id}`);
              }}
              style={menuItem}
            >
              Edit
            </Link>
            {status === "PUBLISHED" && (
              <a
                role="menuitem"
                href={`/en/shop/${categorySlug}/${slugEn}`}
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
            {statusItems
              .filter((item) => item.value !== status)
              .map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickStatus(item.value);
                  }}
                  style={menuItem}
                >
                  {item.label}
                </button>
              ))}
            {status !== "PUBLISHED" && (
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(null);
                  setDeleteOpen(true);
                }}
                style={{ ...menuItem, color: "var(--color-error)" }}
              >
                Delete…
              </button>
            )}
          </div>,
          document.body,
        )}

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={confirmArchive}
        title="Archive product"
        message={`Archive "${name}"? It disappears from the store until you publish it again.`}
        confirmLabel="Archive"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete product"
        message={`Delete "${name}"? It's removed from the catalog and from shopping carts. Order history keeps it.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={pending}
        requireTypedConfirm
      />
    </div>
  );
}
