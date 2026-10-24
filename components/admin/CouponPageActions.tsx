"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import CouponStatusPill from "@/components/admin/CouponStatusPill";
import {
  deleteCouponAction,
  rotateCouponAction,
  toggleCouponAction,
} from "@/lib/actions/coupon";
import {
  describeConditions,
  describeDiscount,
  dubaiDayEndIso,
  dubaiDayStartIso,
} from "@/lib/utils/coupon-display";
import type { AdminCouponDetail } from "@/lib/db/queries/coupon";

interface Props {
  coupon: AdminCouponDetail;
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

const modalButton: React.CSSProperties = {
  padding: "0.5rem 1.125rem",
  fontSize: "var(--text-body)",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "1px solid #0b0b0b",
  borderRadius: "0",
};

const modalTextButton: React.CSSProperties = {
  padding: "0.5rem 1.125rem",
  fontSize: "var(--text-body)",
  background: "none",
  border: "none",
  borderRadius: "0",
  color: "#0b0b0b",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

const termLabel: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

const termValue: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  margin: 0,
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

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function DateField({
  id,
  label,
  value,
  disabled,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? "var(--color-auth-input-border-focus)"
    : focused
      ? "var(--color-auth-input-border-focus)"
      : "var(--color-auth-input-border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-auth-label-text)",
        }}
      >
        {label}
        <span
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-normal)",
            color: "var(--color-auth-input-placeholder)",
          }}
        >
          optional
        </span>
      </label>
      <input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.625rem 0.875rem",
          fontSize: "var(--text-body)",
          color: "var(--color-auth-input-text)",
          backgroundColor: "var(--color-auth-input-bg)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-none)",
          outline: "none",
          transition: "border-color 150ms",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
      {error && (
        <p
          role="alert"
          id={`${id}-error`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default function CouponPageActions({ coupon }: Props) {
  const router = useRouter();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceForm, setReplaceForm] = useState({
    code: "",
    startsDay: "",
    endsDay: "",
  });
  const [replaceErrors, setReplaceErrors] = useState<Record<string, string>>({});
  const [replacePending, setReplacePending] = useState(false);

  const menuOpen = menu !== null;
  const { id, code, status, usedCount, redemptionCount } = coupon;
  const hasCustomer = coupon.customerId != null;
  const canDelete = usedCount === 0 && redemptionCount === 0;
  const canToggle = status === "ACTIVE" || status === "SCHEDULED" || status === "PAUSED";

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

  async function toggle() {
    const pausing = status !== "PAUSED";
    setPending(true);
    const result = await toggleCouponAction(id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(pausing ? "Coupon paused." : "Coupon resumed.");
    router.refresh();
  }

  async function confirmDelete() {
    setPending(true);
    const result = await deleteCouponAction(id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Coupon deleted.");
    startNavigationProgress("/admin/coupons");
    router.push("/admin/coupons");
  }

  function openReplace() {
    setReplaceForm({ code: "", startsDay: "", endsDay: "" });
    setReplaceErrors({});
    setReplaceOpen(true);
  }

  function closeReplace() {
    if (replacePending) return;
    setReplaceOpen(false);
  }

  function clearReplaceError(field: string) {
    setReplaceErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function replace() {
    setReplacePending(true);
    setReplaceErrors({});

    const result = await rotateCouponAction(id, {
      code: replaceForm.code.trim(),
      startsAt: replaceForm.startsDay
        ? dubaiDayStartIso(replaceForm.startsDay)
        : "",
      endsAt: replaceForm.endsDay ? dubaiDayEndIso(replaceForm.endsDay) : "",
    });

    setReplacePending(false);

    if (result.success) {
      toast.success(`New code created. ${code} is paused.`);
      setReplaceOpen(false);
      const href = `/admin/coupons/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
      return;
    }

    if (result.errorCode === "CODE_TAKEN") {
      setReplaceErrors({ code: result.error });
    } else if (result.fieldErrors) {
      const errs: Record<string, string> = {};
      for (const [k, msgs] of Object.entries(result.fieldErrors)) {
        if (msgs && msgs.length > 0) errs[k] = msgs[0];
      }
      if (Object.keys(errs).length > 0) {
        setReplaceErrors(errs);
        return;
      }
      toast.error(result.error);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <CouponStatusPill status={status} />

      {canToggle && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void toggle()}
          style={{ ...primaryButton, opacity: pending ? 0.6 : 1 }}
        >
          {status === "PAUSED" ? "Resume" : "Pause"}
        </button>
      )}

      {!hasCustomer && (
        <button
          type="button"
          onClick={openReplace}
          style={primaryButton}
        >
          Replace code
        </button>
      )}

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
            {!hasCustomer && (
              <Link
                role="menuitem"
                href={`/admin/coupons/new?from=${id}`}
                onClick={() => navigate(`/admin/coupons/new?from=${id}`)}
                style={menuItem}
              >
                Duplicate
              </Link>
            )}
            {canDelete ? (
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
              <div role="menuitem" aria-disabled="true" style={menuItemMuted}>
                {`Can't delete: used ${plural(Math.max(usedCount, redemptionCount), "time", "times")}`}
              </div>
            )}
          </div>,
          document.body,
        )}

      <Modal
        open={replaceOpen}
        onClose={closeReplace}
        ariaLabel="Replace code"
        maxWidth={520}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100dvh - 3rem)",
          }}
        >
          <div style={{ padding: "1.75rem 1.5rem 1rem", flexShrink: 0 }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              Replace code
            </h3>
          </div>

          <div
            style={{ padding: "0 1.5rem 1.25rem", overflowY: "auto", flex: 1 }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem 1rem",
                  padding: "0.875rem 1rem",
                  border: "1px solid var(--color-shop-divider)",
                }}
              >
                <div>
                  <p style={termLabel}>Discount</p>
                  <p style={termValue}>{describeDiscount(coupon)}</p>
                </div>
                <div>
                  <p style={termLabel}>Conditions</p>
                  <p style={termValue}>{describeConditions(coupon)}</p>
                </div>
              </div>

              <p style={{ ...termLabel, color: "#0b0b0b" }}>
                {`Creates a new code with the same discount, conditions and limits, and pauses ${code}. Its use count starts at zero.`}
              </p>

              <Input
                id="rc-code"
                label="New code"
                hint="Letters, numbers and underscores."
                value={replaceForm.code}
                dir="ltr"
                required
                disabled={replacePending}
                onChange={(e) => {
                  setReplaceForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }));
                  clearReplaceError("code");
                }}
                error={replaceErrors.code}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <DateField
                  id="rc-starts-at"
                  label="Starts"
                  value={replaceForm.startsDay}
                  disabled={replacePending}
                  onChange={(v) => {
                    setReplaceForm((f) => ({ ...f, startsDay: v }));
                    clearReplaceError("startsAt");
                  }}
                  error={replaceErrors.startsAt}
                />
                <DateField
                  id="rc-ends-at"
                  label="Ends"
                  value={replaceForm.endsDay}
                  disabled={replacePending}
                  onChange={(v) => {
                    setReplaceForm((f) => ({ ...f, endsDay: v }));
                    clearReplaceError("endsAt");
                  }}
                  error={replaceErrors.endsAt}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--color-shop-divider)",
              padding: "1rem 1.5rem 1.25rem",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={closeReplace}
              disabled={replacePending}
              style={{
                ...modalTextButton,
                cursor: replacePending ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void replace();
              }}
              disabled={replacePending}
              style={{
                ...modalButton,
                cursor: replacePending ? "not-allowed" : "pointer",
                opacity: replacePending ? 0.6 : 1,
              }}
            >
              {replacePending ? "Replacing…" : "Replace code"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          if (!pending) setDeleteOpen(false);
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
        title="Delete coupon"
        message={`Delete ${code}? It can't be used again. The audit log keeps its history.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={pending}
        destructive
        requireTypedConfirm
      />
    </div>
  );
}
