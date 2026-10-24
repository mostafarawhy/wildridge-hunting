"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  createShippingZoneAction,
  updateShippingZoneAction,
  deleteShippingZoneAction,
} from "@/lib/actions/shipping-zone";
import type { AdminShippingZoneDetail } from "@/lib/db/queries/shipping";

interface Props {
  mode: "create" | "edit";
  initial?: AdminShippingZoneDetail;
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
};

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

function CheckmarkIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: "1rem",
          height: "1rem",
          border: "1.5px solid var(--color-auth-input-border)",
          backgroundColor: checked
            ? "var(--color-action-primary)"
            : "var(--color-auth-input-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 150ms, border-color 150ms",
        }}
      >
        {checked && <CheckmarkIcon />}
      </span>
      <span style={{ fontSize: "var(--text-body)", color: "#0b0b0b" }}>
        {label}
      </span>
    </label>
  );
}

export default function ShippingZoneForm({ mode, initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [code, setCode] = useState(initial?.code ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [nameRu, setNameRu] = useState(initial?.nameRu ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    initial?.displayOrder != null ? String(initial.displayOrder) : "0",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(
    initial?.freeShippingEnabled ?? false,
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    initial?.freeShippingThreshold != null
      ? String(initial.freeShippingThreshold)
      : "",
  );
  const [quoteRequired, setQuoteRequired] = useState(
    initial?.quoteRequired ?? false,
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  function clearError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);

    const payload = {
      code,
      nameEn,
      nameAr,
      nameRu,
      displayOrder,
      isActive,
      freeShippingEnabled,
      freeShippingThreshold: freeShippingEnabled ? freeShippingThreshold : "",
      quoteRequired,
    };

    const result =
      mode === "create"
        ? await createShippingZoneAction(payload)
        : await updateShippingZoneAction(initial!.id, payload);

    setPending(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        setFieldErrors(errs);
      }
      toast.error(result.error);
      return;
    }

    toast.success(
      mode === "create" ? "Shipping zone created." : "Shipping zone updated.",
    );

    if (mode === "create") {
      const href = `/admin/shipping/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      startNavigationProgress("/admin/shipping");
      router.push("/admin/shipping");
    }
  }

  async function handleDelete() {
    setDeletePending(true);
    const result = await deleteShippingZoneAction(initial!.id);
    setDeletePending(false);

    if (!result.success) {
      toast.error(result.error);
      setConfirmOpen(false);
      return;
    }

    toast.success("Shipping zone deleted.");
    startNavigationProgress("/admin/shipping");
    router.push("/admin/shipping");
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div style={card}>
            <p style={cardTitle}>Zone</p>
            <div style={stack}>
              <div style={grid2}>
                <Input
                  id="szf-code"
                  label="Code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    clearError("code");
                  }}
                  required
                  dir="ltr"
                  error={fieldErrors.code}
                />
                <Input
                  id="szf-display-order"
                  label="Display Order"
                  value={displayOrder}
                  onChange={(e) => {
                    setDisplayOrder(e.target.value);
                    clearError("displayOrder");
                  }}
                  inputMode="numeric"
                  dir="ltr"
                  error={fieldErrors.displayOrder}
                />
              </div>
              <div style={grid2}>
                <Input
                  id="szf-name-en"
                  label="Name (English)"
                  value={nameEn}
                  onChange={(e) => {
                    setNameEn(e.target.value);
                    clearError("nameEn");
                  }}
                  required
                  error={fieldErrors.nameEn}
                />
                <Input
                  id="szf-name-ar"
                  label="Name (Arabic)"
                  value={nameAr}
                  onChange={(e) => {
                    setNameAr(e.target.value);
                    clearError("nameAr");
                  }}
                  required
                  error={fieldErrors.nameAr}
                />
              </div>
              <Input
                id="szf-name-ru"
                label="Name (Russian)"
                value={nameRu}
                onChange={(e) => {
                  setNameRu(e.target.value);
                  clearError("nameRu");
                }}
                optional="optional"
                error={fieldErrors.nameRu}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <CheckboxField
                  id="szf-is-active"
                  label="Active"
                  checked={isActive}
                  onChange={setIsActive}
                />
                {!quoteRequired && (
                  <CheckboxField
                    id="szf-free-shipping"
                    label="Free Shipping Enabled"
                    checked={freeShippingEnabled}
                    onChange={setFreeShippingEnabled}
                  />
                )}
              </div>
              {!quoteRequired && freeShippingEnabled && (
                <Input
                  id="szf-free-threshold"
                  label="Free Shipping Threshold"
                  value={freeShippingThreshold}
                  onChange={(e) => {
                    setFreeShippingThreshold(e.target.value);
                    clearError("freeShippingThreshold");
                  }}
                  inputMode="decimal"
                  dir="ltr"
                  error={fieldErrors.freeShippingThreshold}
                />
              )}
              <CheckboxField
                id="szf-quote-required"
                label="Requires manual shipping quote"
                checked={quoteRequired}
                onChange={(v) => {
                  if (v) setFreeShippingEnabled(false);
                  setQuoteRequired(v);
                }}
              />
              {quoteRequired && (
                <p
                  style={{
                    backgroundColor: "#f5f5f5",
                    border: "1px solid #e3e3e3",
                    borderRadius: "var(--radius-none)",
                    padding: "0.75rem 0.875rem",
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  Rates on this zone are ignored while this is on. Customers
                  checking out to these countries place a held order with no
                  payment, and staff quote shipping manually. Free shipping
                  does not apply.
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={pending}
              disabled={pending}
            >
              {mode === "create" ? "Create Zone" : "Save Changes"}
            </Button>
            <Link
              href="/admin/shipping"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Cancel
            </Link>
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "2.5rem",
                  paddingInline: "1rem",
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-medium)",
                  color: "#991b1b",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginInlineStart: "auto",
                }}
              >
                Delete zone
              </button>
            )}
          </div>
        </div>
      </form>

      {mode === "edit" && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Delete shipping zone"
          message="This zone will be permanently deleted. Zones with countries or rates cannot be deleted."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isPending={deletePending}
          destructive={true}
        />
      )}
    </>
  );
}
