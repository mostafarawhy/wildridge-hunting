"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  deleteProductAction,
  setProductStatusAction,
} from "@/lib/actions/product";
import { PUBLISH_STATUS_LABELS } from "@/lib/utils/product-status";
import type { PublishStatus } from "@/app/generated/prisma/client";

interface Props {
  productId: string;
  name: string;
  status: PublishStatus;
  dirty: boolean;
}

const DOT_COLORS: Record<PublishStatus, string> = {
  PUBLISHED: "#22c55e",
  DRAFT: "#9ca3af",
  ARCHIVED: "#f59e0b",
};

const STATUS_LINES: Record<PublishStatus, string> = {
  PUBLISHED: "Published · visible on the store",
  DRAFT: "Draft · hidden from the store",
  ARCHIVED: "Archived · hidden from the store",
};

const STATUS_ITEMS: { value: PublishStatus; label: string }[] = [
  { value: "PUBLISHED", label: "Publish" },
  { value: "DRAFT", label: "Move to draft" },
  { value: "ARCHIVED", label: "Archive…" },
];

const menuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  width: "100%",
  padding: "0.625rem 1rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textAlign: "start",
  background: "none",
  border: "none",
  borderRadius: 0,
  cursor: "pointer",
};

export default function ProductStatusMenu({
  productId,
  name,
  status,
  dirty,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function blockedByDirty() {
    if (!dirty) return false;
    setOpen(false);
    toast.info("Save or discard your changes first.");
    return true;
  }

  async function changeStatus(next: PublishStatus, successMessage: string) {
    setPending(true);
    const result = await setProductStatusAction(productId, next);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(successMessage);
    router.refresh();
    return true;
  }

  function pickStatus(next: PublishStatus) {
    if (blockedByDirty()) return;
    setOpen(false);
    if (next === "ARCHIVED") {
      setArchiveOpen(true);
      return;
    }
    void changeStatus(
      next,
      next === "PUBLISHED" ? "Product published." : "Moved to draft.",
    );
  }

  function pickDelete() {
    if (blockedByDirty()) return;
    setOpen(false);
    setDeleteOpen(true);
  }

  async function confirmArchive() {
    const ok = await changeStatus("ARCHIVED", "Product archived.");
    if (ok) setArchiveOpen(false);
  }

  async function confirmDelete() {
    setPending(true);
    const result = await deleteProductAction(productId);
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDeleteOpen(false);
    toast.success("Product deleted.");
    startNavigationProgress("/admin/products");
    router.push("/admin/products");
  }

  const deleteDisabled = status === "PUBLISHED";

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          height: "2.25rem",
          paddingInline: "0.875rem",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--font-bold)",
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
          border: "none",
          borderRadius: "var(--radius-none)",
          cursor: "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "0.5rem",
            height: "0.5rem",
            borderRadius: "50%",
            backgroundColor: DOT_COLORS[status],
          }}
        />
        {PUBLISH_STATUS_LABELS[status]}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: "calc(100% + 4px)",
            minWidth: "15rem",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            boxShadow: "var(--shadow-modal)",
            paddingBlock: "0.25rem",
            zIndex: 50,
          }}
        >
          <p
            style={{
              margin: 0,
              padding: "0.5rem 1rem",
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            {STATUS_LINES[status]}
          </p>
          {STATUS_ITEMS.filter((item) => item.value !== status).map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              onClick={() => pickStatus(item.value)}
              style={menuItem}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            aria-disabled={deleteDisabled}
            disabled={deleteDisabled}
            onClick={pickDelete}
            style={{
              ...menuItem,
              color: "var(--color-error)",
              cursor: deleteDisabled ? "not-allowed" : "pointer",
              opacity: deleteDisabled ? 0.5 : 1,
            }}
          >
            Delete…
            {deleteDisabled && (
              <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                Archive first
              </span>
            )}
          </button>
        </div>
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
