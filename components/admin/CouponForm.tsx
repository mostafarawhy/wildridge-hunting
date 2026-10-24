"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import CopyCodeButton from "@/components/admin/CopyCodeButton";
import CouponPageActions from "@/components/admin/CouponPageActions";
import { createCouponAction, updateCouponAction } from "@/lib/actions/coupon";
import { CouponType, CustomerRole } from "@/app/generated/prisma/enums";
import { formatAED } from "@/lib/utils/currency";
import {
  COUPON_TYPE_LABELS,
  describeCoupon,
  dubaiDayEndIso,
  dubaiDayFromIso,
  dubaiDayStartIso,
  formatCouponDate,
} from "@/lib/utils/coupon-display";
import type { AdminCouponDetail } from "@/lib/db/queries/coupon";

interface Props {
  mode: "create" | "edit";
  initial?: AdminCouponDetail;
  template?: AdminCouponDetail;
  slots?: {
    redemptions?: ReactNode;
    activity?: ReactNode;
  };
}

interface FormState {
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  startsDay: string;
  endsDay: string;
  allowedRole: "" | CustomerRole;
  isActive: boolean;
}

function buildState(
  initial?: AdminCouponDetail,
  template?: AdminCouponDetail,
): FormState {
  const src = initial ?? template;
  return {
    code: initial?.code ?? "",
    type: src?.type ?? CouponType.PERCENTAGE,
    value:
      src && src.type !== CouponType.FREE_SHIPPING ? String(src.value) : "",
    minOrderAmount:
      src?.minOrderAmount != null ? String(src.minOrderAmount) : "",
    maxDiscountAmount:
      src?.maxDiscountAmount != null ? String(src.maxDiscountAmount) : "",
    usageLimit: src?.usageLimit != null ? String(src.usageLimit) : "",
    startsDay: initial?.startsAt ? dubaiDayFromIso(initial.startsAt) : "",
    endsDay: initial?.endsAt ? dubaiDayFromIso(initial.endsAt) : "",
    allowedRole: src?.allowedRole ?? "",
    isActive: initial?.isActive ?? true,
  };
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function dayToIso(
  day: string,
  baseDay: string,
  baseIso: string | null,
  edge: "start" | "end",
): string {
  if (!day) return "";
  if (baseIso && day === baseDay) return baseIso;
  return edge === "start" ? dubaiDayStartIso(day) : dubaiDayEndIso(day);
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

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
  gap: "1rem",
};

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "var(--color-auth-label-text)",
  margin: 0,
};

const smallLabel: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
  margin: 0,
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

const textLink: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.5rem",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--radius-none)",
  cursor: "pointer",
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-heading)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  lineHeight: "var(--leading-tight)",
  letterSpacing: "var(--tracking-tight)",
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

function DateField({
  id,
  label,
  optional,
  hint,
  value,
  disabled,
  onChange,
  error,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: string;
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
        {optional && (
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-normal)",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            {optional}
          </span>
        )}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
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
      {error ? (
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
      ) : hint ? (
        <p
          id={`${id}-hint`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <p style={smallLabel}>{label}</p>
      <div style={{ fontSize: "var(--text-body)", color: "#0b0b0b" }}>
        {children}
      </div>
    </div>
  );
}

export default function CouponForm({ mode, initial, template, slots }: Props) {
  const router = useRouter();
  const toast = useToast();

  const baseState = buildState(initial, template);
  const syncKey = JSON.stringify(baseState);

  const [form, setForm] = useState<FormState>(baseState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const [synced, setSynced] = useState(() => ({
    key: syncKey,
    base: baseState,
  }));
  const [justSaved, setJustSaved] = useState(false);
  if (synced.key !== syncKey) {
    const keepEdits =
      !justSaved && JSON.stringify(form) !== JSON.stringify(synced.base);
    setSynced({ key: syncKey, base: baseState });
    setJustSaved(false);
    if (!keepEdits) {
      setForm(baseState);
      setFieldErrors({});
    }
  }

  const dirty =
    mode === "edit" && JSON.stringify(form) !== JSON.stringify(synced.base);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const baseStartsDay = initial?.startsAt
    ? dubaiDayFromIso(initial.startsAt)
    : "";
  const baseEndsDay = initial?.endsAt ? dubaiDayFromIso(initial.endsAt) : "";

  function startsIso() {
    return dayToIso(
      form.startsDay,
      baseStartsDay,
      initial?.startsAt ?? null,
      "start",
    );
  }

  function endsIso() {
    return dayToIso(form.endsDay, baseEndsDay, initial?.endsAt ?? null, "end");
  }

  function clearError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function discard() {
    setForm(synced.base);
    setFieldErrors({});
  }

  async function save() {
    if (pending) return;

    const errors: Record<string, string> = {};
    if (mode === "create" && !form.code.trim()) errors.code = "Code is required.";
    if (form.type === CouponType.PERCENTAGE) {
      const v = Number(form.value);
      if (!form.value || v < 1 || v > 100)
        errors.value = "Percentage must be between 1 and 100.";
    } else if (form.type === CouponType.FIXED) {
      const v = Number(form.value);
      if (!form.value || v <= 0)
        errors.value = "Fixed amount must be greater than 0.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPending(true);
    setFieldErrors({});
    const saved = form;

    const payload = {
      type: saved.type,
      value: saved.value,
      minOrderAmount: saved.minOrderAmount,
      maxDiscountAmount: saved.maxDiscountAmount,
      usageLimit: saved.usageLimit,
      startsAt: startsIso(),
      endsAt: endsIso(),
      allowedRole: saved.allowedRole,
      isActive: mode === "create" ? saved.isActive : initial!.isActive,
    };

    const result =
      mode === "create"
        ? await createCouponAction({ ...payload, code: saved.code.trim() })
        : await updateCouponAction(initial!.id, payload);

    setPending(false);

    if (!result.success) {
      if (result.errorCode === "CODE_TAKEN") {
        setFieldErrors({ code: result.error });
        return;
      }
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        if (Object.keys(errs).length > 0) {
          setFieldErrors(errs);
          return;
        }
      }
      toast.error(result.error);
      return;
    }

    if (mode === "create") {
      toast.success("Coupon created.");
      const href = `/admin/coupons/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      toast.success("Coupon saved.");
      setSynced((prev) => ({ ...prev, base: saved }));
      setJustSaved(true);
      router.refresh();
    }
  }

  const customer = initial?.customer ?? null;
  const previewStarts = startsIso();
  const previewEnds = endsIso();
  const plainWords = describeCoupon({
    type: form.type,
    value: toNumber(form.value),
    maxDiscountAmount: toNumber(form.maxDiscountAmount),
    minOrderAmount: toNumber(form.minOrderAmount),
    allowedRole: form.allowedRole === "" ? null : form.allowedRole,
    customerEmail: customer?.email ?? null,
    usageLimit: toNumber(form.usageLimit),
    startsAt: previewStarts || null,
    endsAt: previewEnds || null,
  });

  const usageLimit = initial?.usageLimit ?? null;
  const usagePercent =
    initial && usageLimit != null && usageLimit > 0
      ? Math.min(100, Math.round((initial.usedCount / usageLimit) * 100))
      : 0;

  return (
    <div>
      <style>{`
        .cf-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
        @media (max-width: 959px) {
          .cf-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      {dirty && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #0b0b0b",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
            }}
          >
            Unsaved changes
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button
              type="button"
              onClick={discard}
              disabled={pending}
              style={textButton}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending}
              style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            margin: 0,
            marginBottom: "1rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
          }}
        >
          <Link
            href="/admin/coupons"
            style={{ color: "#0b0b0b", textDecoration: "underline" }}
          >
            Coupons
          </Link>
        </p>
        {mode === "edit" && initial ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <h1
                dir="ltr"
                style={{
                  ...headingStyle,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {initial.code}
              </h1>
              <CopyCodeButton code={initial.code} label="Copy code" />
            </div>
            <CouponPageActions coupon={initial} />
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
          >
            <h1 style={headingStyle}>New coupon</h1>
            <p style={mutedText}>
              {template
                ? `Copied from ${template.code}. Pick a new code and dates.`
                : "Customers type the code at checkout."}
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-auth-form-border)",
          borderInlineStart: "3px solid #0b0b0b",
          borderRadius: 0,
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
        }}
      >
        <p style={smallLabel}>In plain words</p>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body)",
            color: "#0b0b0b",
          }}
        >
          {plainWords}
        </p>
      </div>

      <div className={mode === "edit" ? "cf-grid" : undefined}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            minWidth: 0,
          }}
        >
          <div style={card}>
            <p style={cardTitle}>Code and discount</p>
            <div style={stack}>
              {mode === "create" ? (
                <Input
                  id="cf-code"
                  label="Code"
                  hint="Letters, numbers and underscores."
                  value={form.code}
                  dir="ltr"
                  required
                  disabled={pending}
                  onChange={(e) => {
                    setField("code", e.target.value.toUpperCase());
                    clearError("code");
                  }}
                  error={fieldErrors.code}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                >
                  <p style={fieldLabel}>Code</p>
                  <p
                    dir="ltr"
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "var(--text-body)",
                      color: "#0b0b0b",
                    }}
                  >
                    {initial?.code}
                  </p>
                  <p style={mutedText}>
                    A code can&apos;t be renamed. Use Replace code to issue a new
                    one.
                  </p>
                </div>
              )}

              <Select
                id="cf-type"
                label="Type"
                required
                value={form.type}
                disabled={pending}
                onChange={(e) => {
                  const newType = e.target.value as CouponType;
                  setForm((f) => ({
                    ...f,
                    type: newType,
                    maxDiscountAmount:
                      newType === CouponType.PERCENTAGE
                        ? f.maxDiscountAmount
                        : "",
                  }));
                  clearError("type");
                  clearError("value");
                  clearError("maxDiscountAmount");
                }}
                error={fieldErrors.type}
              >
                {Object.values(CouponType).map((t) => (
                  <option key={t} value={t}>
                    {COUPON_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>

              {form.type === CouponType.FREE_SHIPPING ? (
                <p style={mutedText}>
                  Waives the shipping charge. Not offered on destinations that
                  need a shipping quote.
                </p>
              ) : (
                <div style={twoCol}>
                  <Input
                    id="cf-value"
                    label={
                      form.type === CouponType.PERCENTAGE
                        ? "Percentage (1–100)"
                        : "Amount (AED)"
                    }
                    value={form.value}
                    dir="ltr"
                    inputMode="decimal"
                    required
                    disabled={pending}
                    onChange={(e) => {
                      setField("value", e.target.value);
                      clearError("value");
                    }}
                    error={fieldErrors.value}
                  />
                  {form.type === CouponType.PERCENTAGE && (
                    <Input
                      id="cf-max-discount"
                      label="Max discount (AED)"
                      optional="optional"
                      value={form.maxDiscountAmount}
                      dir="ltr"
                      inputMode="decimal"
                      disabled={pending}
                      onChange={(e) => {
                        setField("maxDiscountAmount", e.target.value);
                        clearError("maxDiscountAmount");
                      }}
                      error={fieldErrors.maxDiscountAmount}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Conditions</p>
            <div style={stack}>
              <Input
                id="cf-min-order"
                label="Minimum goods total (AED)"
                optional="optional"
                hint="Checked against the goods total, before shipping."
                value={form.minOrderAmount}
                dir="ltr"
                inputMode="decimal"
                disabled={pending}
                onChange={(e) => {
                  setField("minOrderAmount", e.target.value);
                  clearError("minOrderAmount");
                }}
                error={fieldErrors.minOrderAmount}
              />
              {customer ? (
                <p style={mutedText}>
                  Only for{" "}
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    onClick={() =>
                      startNavigationProgress(`/admin/customers/${customer.id}`)
                    }
                    dir="ltr"
                    style={{ color: "#0b0b0b", textDecoration: "underline" }}
                  >
                    {customer.email}
                  </Link>
                </p>
              ) : (
                <Select
                  id="cf-allowed-role"
                  label="Who can use it"
                  value={form.allowedRole}
                  disabled={pending}
                  onChange={(e) => {
                    setField("allowedRole", e.target.value as "" | CustomerRole);
                    clearError("allowedRole");
                  }}
                  error={fieldErrors.allowedRole}
                >
                  <option value="">Any signed-in customer</option>
                  <option value={CustomerRole.B2C}>Retail customers</option>
                  <option value={CustomerRole.B2B}>Business customers</option>
                </Select>
              )}
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Limits</p>
            <Input
              id="cf-usage-limit"
              label="Total uses"
              optional="optional"
              hint="Leave blank for no limit. Every order placed with the code uses one, including orders later cancelled."
              value={form.usageLimit}
              dir="ltr"
              inputMode="numeric"
              disabled={pending}
              onChange={(e) => {
                setField("usageLimit", e.target.value);
                clearError("usageLimit");
              }}
              error={fieldErrors.usageLimit}
            />
          </div>

          <div style={card}>
            <p style={cardTitle}>Schedule</p>
            <div style={twoCol}>
              <DateField
                id="cf-starts-at"
                label="Starts"
                optional="optional"
                hint="From the start of this day, Dubai time."
                value={form.startsDay}
                disabled={pending}
                onChange={(v) => {
                  setField("startsDay", v);
                  clearError("startsAt");
                }}
                error={fieldErrors.startsAt}
              />
              <DateField
                id="cf-ends-at"
                label="Ends"
                optional="optional"
                hint="Until the end of this day, Dubai time."
                value={form.endsDay}
                disabled={pending}
                onChange={(v) => {
                  setField("endsDay", v);
                  clearError("endsAt");
                }}
                error={fieldErrors.endsAt}
              />
            </div>
            {mode === "create" && (
              <CheckboxField
                id="cf-is-active"
                label="Live as soon as it's saved"
                checked={form.isActive}
                onChange={(v) => setField("isActive", v)}
              />
            )}
          </div>
        </div>

        {mode === "edit" && initial && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              minWidth: 0,
            }}
          >
            <div style={card}>
              <p style={cardTitle}>Usage</p>
              <div style={stack}>
                <p
                  dir="ltr"
                  style={{
                    margin: 0,
                    fontSize: "var(--text-body)",
                    color: "#0b0b0b",
                  }}
                >
                  {usageLimit != null
                    ? `${initial.usedCount} of ${usageLimit} used`
                    : `${initial.usedCount} used · no limit`}
                </p>
                {usageLimit != null && (
                  <div
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      height: "4px",
                      backgroundColor: "#e8e8e8",
                    }}
                  >
                    <div
                      style={{
                        width: `${usagePercent}%`,
                        height: "100%",
                        backgroundColor: "#0b0b0b",
                      }}
                    />
                  </div>
                )}
                <InfoRow label="Redemptions">{initial.redemptionCount}</InfoRow>
                <InfoRow label="Discount given">
                  <span dir="ltr">{formatAED(initial.discountGiven)}</span>
                </InfoRow>
                <p style={mutedText}>
                  Paid orders only. Includes shipping waived by free-shipping
                  codes.
                </p>
              </div>
            </div>

            <div style={card}>
              <p style={cardTitle}>Source</p>
              {initial.source === "manual" ? (
                <p style={{ margin: 0, fontSize: "var(--text-body)", color: "#0b0b0b" }}>
                  {`Created by staff on ${formatCouponDate(initial.createdAt)}`}
                </p>
              ) : (
                <div style={stack}>
                  {initial.sourceRule && (
                    <InfoRow label="Reward rule">
                      <Link
                        href={`/admin/coupons/rewards/${initial.sourceRule.id}`}
                        onClick={() =>
                          startNavigationProgress(
                            `/admin/coupons/rewards/${initial.sourceRule!.id}`,
                          )
                        }
                        style={{ color: "#0b0b0b", textDecoration: "underline" }}
                      >
                        {initial.sourceRule.name}
                      </Link>
                    </InfoRow>
                  )}
                  {initial.sourceOrder && (
                    <InfoRow label="Earned by order">
                      <Link
                        href={`/admin/orders/${initial.sourceOrder.id}`}
                        onClick={() =>
                          startNavigationProgress(
                            `/admin/orders/${initial.sourceOrder!.id}`,
                          )
                        }
                        dir="ltr"
                        style={{
                          color: "#0b0b0b",
                          textDecoration: "underline",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {initial.sourceOrder.orderNumber}
                      </Link>
                    </InfoRow>
                  )}
                  {customer && (
                    <InfoRow label="For">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        onClick={() =>
                          startNavigationProgress(
                            `/admin/customers/${customer.id}`,
                          )
                        }
                        dir="ltr"
                        style={{ color: "#0b0b0b", textDecoration: "underline" }}
                      >
                        {customer.email}
                      </Link>
                    </InfoRow>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {mode === "edit" && (slots?.redemptions || slots?.activity) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            marginTop: "1.5rem",
          }}
        >
          {slots.redemptions}
          {slots.activity}
        </div>
      )}

      {mode === "create" && (
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Creating…" : "Create coupon"}
          </button>
          <Link href="/admin/coupons" style={textLink}>
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
