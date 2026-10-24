"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import RewardRulePageActions from "@/components/admin/RewardRulePageActions";
import StatsCard from "@/components/admin/StatsCard";
import {
  createRewardRuleAction,
  updateRewardRuleAction,
} from "@/lib/actions/reward-rule";
import { CouponType } from "@/app/generated/prisma/enums";
import { formatAED } from "@/lib/utils/currency";
import {
  COUPON_TYPE_LABELS,
  describeRewardRule,
} from "@/lib/utils/coupon-display";
import type { AdminRewardRuleDetail } from "@/lib/db/queries/coupon";

interface Props {
  mode: "create" | "edit";
  initial?: AdminRewardRuleDetail;
  slots?: {
    codes?: ReactNode;
  };
}

interface FormState {
  name: string;
  minOrderTotal: string;
  rewardType: CouponType;
  rewardValue: string;
  rewardMaxDiscountAmount: string;
  rewardMinOrderAmount: string;
  validityDays: string;
  codePrefix: string;
  isActive: boolean;
}

function buildState(initial?: AdminRewardRuleDetail): FormState {
  return {
    name: initial?.name ?? "",
    minOrderTotal: initial ? String(initial.minOrderTotal) : "",
    rewardType: initial?.rewardType ?? CouponType.PERCENTAGE,
    rewardValue:
      initial && initial.rewardType !== CouponType.FREE_SHIPPING
        ? String(initial.rewardValue)
        : "",
    rewardMaxDiscountAmount:
      initial?.rewardMaxDiscountAmount != null
        ? String(initial.rewardMaxDiscountAmount)
        : "",
    rewardMinOrderAmount:
      initial?.rewardMinOrderAmount != null
        ? String(initial.rewardMinOrderAmount)
        : "",
    validityDays: initial ? String(initial.validityDays) : "",
    codePrefix: initial?.codePrefix ?? "",
    isActive: initial?.isActive ?? true,
  };
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
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

export default function RewardRuleForm({ mode, initial, slots }: Props) {
  const router = useRouter();
  const toast = useToast();

  const baseState = buildState(initial);
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
    if (!form.name.trim()) errors.name = "Name is required.";
    const total = Number(form.minOrderTotal);
    if (!form.minOrderTotal || total <= 0)
      errors.minOrderTotal = "Order total must be greater than 0.";
    if (form.rewardType === CouponType.PERCENTAGE) {
      const v = Number(form.rewardValue);
      if (!form.rewardValue || v < 1 || v > 100)
        errors.rewardValue = "Percentage must be between 1 and 100.";
    } else if (form.rewardType === CouponType.FIXED) {
      const v = Number(form.rewardValue);
      if (!form.rewardValue || v <= 0)
        errors.rewardValue = "Amount must be greater than 0.";
    }
    if (!form.validityDays || Number(form.validityDays) < 1)
      errors.validityDays = "Validity days must be at least 1.";
    if (!form.codePrefix.trim()) errors.codePrefix = "Code prefix is required.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPending(true);
    setFieldErrors({});
    const saved = form;

    const payload = {
      name: saved.name.trim(),
      minOrderTotal: saved.minOrderTotal,
      rewardType: saved.rewardType,
      rewardValue: saved.rewardValue,
      rewardMaxDiscountAmount: saved.rewardMaxDiscountAmount,
      rewardMinOrderAmount: saved.rewardMinOrderAmount,
      validityDays: saved.validityDays,
      codePrefix: saved.codePrefix.trim(),
      isActive: mode === "create" ? saved.isActive : initial!.isActive,
    };

    const result =
      mode === "create"
        ? await createRewardRuleAction(payload)
        : await updateRewardRuleAction(initial!.id, payload);

    setPending(false);

    if (!result.success) {
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
      toast.success("Reward rule created.");
      const href = `/admin/coupons/rewards/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      toast.success("Reward rule saved.");
      setSynced((prev) => ({ ...prev, base: saved }));
      setJustSaved(true);
      router.refresh();
    }
  }

  const plainWords = describeRewardRule({
    minOrderTotal: toNumber(form.minOrderTotal),
    rewardType: form.rewardType,
    rewardValue: toNumber(form.rewardValue),
    rewardMaxDiscountAmount: toNumber(form.rewardMaxDiscountAmount),
    rewardMinOrderAmount: toNumber(form.rewardMinOrderAmount),
    validityDays: toNumber(form.validityDays),
  });

  return (
    <div>
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
            href="/admin/coupons/rewards"
            style={{ color: "#0b0b0b", textDecoration: "underline" }}
          >
            Reward rules
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
            <h1 style={headingStyle}>{initial.name}</h1>
            <RewardRulePageActions
              rule={{ id: initial.id, isActive: initial.isActive }}
            />
          </div>
        ) : (
          <h1 style={headingStyle}>New reward rule</h1>
        )}
      </div>

      {mode === "edit" && initial && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatsCard label="Issued" value={initial.stats.issued} />
          <StatsCard label="Redeemed" value={initial.stats.redeemed} />
          <StatsCard
            label="Discount given"
            value={formatAED(initial.stats.discountGiven)}
          />
        </div>
      )}

      {mode === "edit" && (
        <p style={{ ...mutedText, marginBottom: "1.5rem" }}>
          Changes apply to codes issued from now on. Codes already issued keep
          their terms.
        </p>
      )}

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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          minWidth: 0,
        }}
      >
        <div style={card}>
          <p style={cardTitle}>When</p>
          <div style={stack}>
            <Input
              id="rrf-name"
              label="Name"
              value={form.name}
              required
              disabled={pending}
              onChange={(e) => {
                setField("name", e.target.value);
                clearError("name");
              }}
              error={fieldErrors.name}
            />
            <Input
              id="rrf-min-order-total"
              label="Delivered order total (AED)"
              hint="Includes shipping. When an order reaches several rules, only the highest one issues a code."
              value={form.minOrderTotal}
              dir="ltr"
              inputMode="decimal"
              required
              disabled={pending}
              onChange={(e) => {
                setField("minOrderTotal", e.target.value);
                clearError("minOrderTotal");
              }}
              error={fieldErrors.minOrderTotal}
            />
          </div>
        </div>

        <div style={card}>
          <p style={cardTitle}>Reward</p>
          <div style={stack}>
            <Select
              id="rrf-reward-type"
              label="Reward type"
              required
              value={form.rewardType}
              disabled={pending}
              onChange={(e) => {
                const newType = e.target.value as CouponType;
                setForm((f) => ({
                  ...f,
                  rewardType: newType,
                  rewardMaxDiscountAmount:
                    newType === CouponType.PERCENTAGE
                      ? f.rewardMaxDiscountAmount
                      : "",
                }));
                clearError("rewardType");
                clearError("rewardValue");
                clearError("rewardMaxDiscountAmount");
              }}
              error={fieldErrors.rewardType}
            >
              {Object.values(CouponType).map((t) => (
                <option key={t} value={t}>
                  {COUPON_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>

            {form.rewardType === CouponType.FREE_SHIPPING ? (
              <p style={mutedText}>Waives the shipping charge.</p>
            ) : (
              <div style={twoCol}>
                <Input
                  id="rrf-reward-value"
                  label={
                    form.rewardType === CouponType.PERCENTAGE
                      ? "Percentage (1–100)"
                      : "Amount (AED)"
                  }
                  value={form.rewardValue}
                  dir="ltr"
                  inputMode="decimal"
                  required
                  disabled={pending}
                  onChange={(e) => {
                    setField("rewardValue", e.target.value);
                    clearError("rewardValue");
                  }}
                  error={fieldErrors.rewardValue}
                />
                {form.rewardType === CouponType.PERCENTAGE && (
                  <Input
                    id="rrf-max-discount"
                    label="Max discount (AED)"
                    optional="optional"
                    value={form.rewardMaxDiscountAmount}
                    dir="ltr"
                    inputMode="decimal"
                    disabled={pending}
                    onChange={(e) => {
                      setField("rewardMaxDiscountAmount", e.target.value);
                      clearError("rewardMaxDiscountAmount");
                    }}
                    error={fieldErrors.rewardMaxDiscountAmount}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div style={card}>
          <p style={cardTitle}>The code</p>
          <div style={stack}>
            <Input
              id="rrf-code-prefix"
              label="Code prefix"
              hint={`Codes look like ${form.codePrefix.trim() || "PREFIX"}-7KX2Q.`}
              value={form.codePrefix}
              dir="ltr"
              required
              disabled={pending}
              onChange={(e) => {
                setField("codePrefix", e.target.value.toUpperCase());
                clearError("codePrefix");
              }}
              error={fieldErrors.codePrefix}
            />
            <div style={twoCol}>
              <Input
                id="rrf-validity-days"
                label="Valid for (days)"
                value={form.validityDays}
                dir="ltr"
                inputMode="numeric"
                required
                disabled={pending}
                onChange={(e) => {
                  setField("validityDays", e.target.value);
                  clearError("validityDays");
                }}
                error={fieldErrors.validityDays}
              />
              <Input
                id="rrf-reward-min-order"
                label="Next order goods total (AED)"
                optional="optional"
                hint="Goods total the customer's next order must reach."
                value={form.rewardMinOrderAmount}
                dir="ltr"
                inputMode="decimal"
                disabled={pending}
                onChange={(e) => {
                  setField("rewardMinOrderAmount", e.target.value);
                  clearError("rewardMinOrderAmount");
                }}
                error={fieldErrors.rewardMinOrderAmount}
              />
            </div>
          </div>
        </div>

        {mode === "create" && (
          <CheckboxField
            id="rrf-is-active"
            label="Live as soon as it's saved"
            checked={form.isActive}
            onChange={(v) => setField("isActive", v)}
          />
        )}
      </div>

      {mode === "edit" && slots?.codes}

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
            {pending ? "Creating…" : "Create rule"}
          </button>
          <Link href="/admin/coupons/rewards" style={textLink}>
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
