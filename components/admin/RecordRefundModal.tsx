"use client";

import { isDemoMode } from "@/lib/config/demo";
import { useEffect, useState } from "react";
import { recordOrderRefundAction } from "@/lib/actions/order-returns";
import { formatAED, roundMoney } from "@/lib/utils/currency";
import { dubaiDay } from "@/lib/utils/date";
import { REFUND_METHOD_LABELS } from "@/lib/utils/refund";
import AdminFileField from "@/components/admin/AdminFileField";

interface Props {
  orderId: string;
  refundDueAed: number;
  refundedAed: number;
  owedAed: number;
  onClose: () => void;
  onSuccess: () => void;
}

const REFUND_METHODS = (
  Object.keys(REFUND_METHOD_LABELS) as (keyof typeof REFUND_METHOD_LABELS)[]
).map((value) => ({ value, label: REFUND_METHOD_LABELS[value] }));

function recordRefundErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "This order no longer exists.";
    case "MISSING_PROOF":
      return "Attach proof of the refund.";
    case "FILE_TOO_LARGE":
      return "Proof must be 5 MB or smaller.";
    case "INVALID_FILE_TYPE":
      return "Proof must be a JPEG, PNG or PDF.";
    case "UPLOAD_FAILED":
      return "The proof could not be uploaded. Try again.";
    case "BALANCE_CHANGED":
      return "The refund owed changed while this form was open. Reload the page.";
    case "OVER_REFUND":
      return "This amount is more than the refund still owed.";
    case "DUPLICATE_REFERENCE":
      return "That reference is already recorded against this order.";
    case "INVALID_DATE":
      return "The refund date cannot be in the future or before the order was placed.";
    case "RECORDING_IN_PROGRESS":
      return "Another refund is being recorded against this order. Reload and check the refund history before recording again.";
    case "INTERNAL_ERROR":
      return "Something went wrong. Nothing was recorded.";
    default:
      return fallback;
  }
}

export default function RecordRefundModal({
  orderId,
  refundDueAed,
  refundedAed,
  owedAed,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState("");
  const [methodOtherLabel, setMethodOtherLabel] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [amount, setAmount] = useState(String(owedAed));
  const [refundedAt, setRefundedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const todayDubai = dubaiDay(new Date());

  const amountNumber = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber <= owedAed;
  const owedAfter = amountValid ? roundMoney(owedAed - amountNumber) : null;

  function handleMethodChange(next: string) {
    setMethod(next);
    if (next !== "OTHER") setMethodOtherLabel("");
    setError(null);
  }

  function handleContinue() {
    if (!method) {
      setError("Select a refund method.");
      return;
    }
    if (method === "OTHER" && !methodOtherLabel.trim()) {
      setError("Describe the refund method when recording an Other refund.");
      return;
    }
    if (!externalReference.trim()) {
      setError("Enter a refund reference.");
      return;
    }
    if (
      amount.trim() === "" ||
      !Number.isFinite(amountNumber) ||
      amountNumber <= 0
    ) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amountNumber > owedAed) {
      setError("This amount is more than the refund still owed.");
      return;
    }
    if (!refundedAt) {
      setError("Enter the date the refund was sent.");
      return;
    }
    if (refundedAt > todayDubai) {
      setError("The refund date cannot be in the future.");
      return;
    }
    if (!isDemoMode()) {
      if (!proof) {
        setError("Attach proof of the refund.");
        return;
      }
      if (proof.size > 5 * 1024 * 1024) {
        setError("Proof must be 5 MB or smaller.");
        return;
      }
      if (!["image/jpeg", "image/png", "application/pdf"].includes(proof.type)) {
        setError("Proof must be a JPEG, PNG or PDF.");
        return;
      }
    }
    setError(null);
    setStep("confirm");
  }

  async function handleSubmit() {
    if ((!proof && !isDemoMode()) || !acknowledged) return;
    setIsPending(true);
    setError(null);

    const formData = new FormData();
    formData.append("orderId", orderId);
    formData.append("method", method);
    formData.append("externalReference", externalReference.trim());
    formData.append("amount", amount);
    formData.append("refundedAt", refundedAt);
    formData.append("expectedOwed", String(owedAed));
    formData.append("acknowledged", "true");
    if (proof) formData.append("proof", proof);
    if (notes.trim()) formData.append("notes", notes.trim());
    if (method === "OTHER") {
      formData.append("methodOtherLabel", methodOtherLabel.trim());
    }

    const result = await recordOrderRefundAction(formData);

    if (result.success) {
      onSuccess();
      return;
    }

    setIsPending(false);
    setStep("form");
    setError(recordRefundErrorMessage(result.errorCode, result.error));
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "2.5rem",
    paddingInline: "1.25rem",
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-bold)",
    letterSpacing: "var(--tracking-widest)",
    textTransform: "uppercase",
    border: "none",
    borderRadius: "0",
    cursor: isPending ? "not-allowed" : "pointer",
    opacity: isPending ? 0.6 : 1,
    transition: "opacity 150ms",
  };

  const textAction: React.CSSProperties = {
    backgroundColor: "transparent",
    color: "#0b0b0b",
    border: "none",
    paddingInline: 0,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.625rem",
    fontSize: "var(--text-body)",
    color: "#0b0b0b",
    backgroundColor: "#ffffff",
    border: "1px solid var(--color-shop-divider)",
    borderRadius: "0",
    outline: "none",
    boxSizing: "border-box",
  };

  const fieldLabelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--text-body-sm)",
    color: "#0b0b0b",
    marginBottom: "0.25rem",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "#6b6b6b",
    marginTop: "0.25rem",
    marginBottom: "0.875rem",
  };

  const summaryRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--color-shop-divider)",
  };

  const summaryLabel: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "#6b6b6b",
  };

  const summaryValue: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "#0b0b0b",
    fontVariantNumeric: "tabular-nums",
    textAlign: "end",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: "1rem",
      }}
      onClick={isPending ? undefined : onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "520px",
          position: "relative",
          maxHeight: "calc(100dvh - 2rem)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "2rem 2rem 1rem", flexShrink: 0 }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          {step === "form" ? "Record Refund" : "Confirm Refund"}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: 0,
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {step === "form"
            ? `Record a refund you have sent. Still owed is ${formatAED(owedAed)}.`
            : "Check these values against the bank or terminal record before recording."}
        </p>
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            padding: "0 2rem 1rem",
          }}
        >

        {step === "form" && (
          <>
            <label htmlFor="rr-method" style={fieldLabelStyle}>
              Method
            </label>
            <select
              id="rr-method"
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select a method…</option>
              {REFUND_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p style={hintStyle}>How the money actually went back.</p>

            {method === "OTHER" && (
              <div
                style={{
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                  marginBottom: "0.875rem",
                }}
              >
                <label htmlFor="rr-other-label" style={fieldLabelStyle}>
                  Method label
                </label>
                <input
                  id="rr-other-label"
                  type="text"
                  value={methodOtherLabel}
                  onChange={(e) => setMethodOtherLabel(e.target.value)}
                  maxLength={200}
                  style={fieldStyle}
                />
                <p style={{ ...hintStyle, marginBottom: 0 }}>
                  Required when the method is Other. The customer sees this on
                  their order.
                </p>
              </div>
            )}

            <label htmlFor="rr-reference" style={fieldLabelStyle}>
              Reference
            </label>
            <input
              id="rr-reference"
              type="text"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              maxLength={200}
              style={fieldStyle}
            />
            <p style={hintStyle}>
              Bank transaction ID or cheque number — must be unique for this
              order.
            </p>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="rr-amount" style={fieldLabelStyle}>
                  Amount (AED)
                </label>
                <input
                  id="rr-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={fieldStyle}
                />
                <p style={hintStyle}>Still owed is {formatAED(owedAed)}.</p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="rr-refunded-at" style={fieldLabelStyle}>
                  Refund date
                </label>
                <input
                  id="rr-refunded-at"
                  type="date"
                  value={refundedAt}
                  onChange={(e) => setRefundedAt(e.target.value)}
                  max={todayDubai}
                  style={fieldStyle}
                />
                <p style={hintStyle}>The date the money was sent.</p>
              </div>
            </div>

            {isDemoMode() ? (
              <p style={hintStyle}>
                File uploads are disabled in the demo. A sample document is attached automatically.
              </p>
            ) : (
              <AdminFileField
                name="Proof of refund"
                spec="JPEG, PNG or PDF, max 5 MB — required."
                file={proof}
                onSelect={(file) => setProof(file)}
              />
            )}
            <div style={{ height: "0.875rem" }} />

            <label htmlFor="rr-notes" style={fieldLabelStyle}>
              Internal note
            </label>
            <textarea
              id="rr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
            <p style={{ ...hintStyle, marginBottom: 0 }}>
              Staff only. Never shown to the customer.
            </p>
          </>
        )}

        {step === "confirm" && (
          <div style={{ borderTop: "1px solid var(--color-shop-divider)" }}>
            <div style={summaryRow}>
              <span style={summaryLabel}>Method</span>
              <span style={summaryValue}>
                {REFUND_METHODS.find((m) => m.value === method)?.label}
                {method === "OTHER" ? ` — ${methodOtherLabel.trim()}` : ""}
              </span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Reference</span>
              <span style={summaryValue}>{externalReference.trim()}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Refund date</span>
              <span style={summaryValue}>{refundedAt}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Proof</span>
              <span style={summaryValue}>{proof?.name ?? "Sample document"}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Refund owed</span>
              <span style={summaryValue}>{formatAED(refundDueAed)}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Refunded so far</span>
              <span style={summaryValue}>{formatAED(refundedAed)}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>This refund</span>
              <span style={summaryValue}>{formatAED(amountNumber)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
                padding: "0.75rem 0",
                borderTop: "1px solid #0b0b0b",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-bold)",
                  letterSpacing: "var(--tracking-widest)",
                  textTransform: "uppercase",
                  color: "#0b0b0b",
                }}
              >
                Owed after
              </span>
              <span
                style={{
                  fontSize: "var(--text-heading)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {owedAfter === null ? "—" : formatAED(owedAfter)}
              </span>
            </div>

            <label
              style={{
                display: "flex",
                gap: "0.625rem",
                alignItems: "flex-start",
                marginTop: "1.25rem",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={isPending}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ marginTop: "0.2rem", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                I have checked this refund against the payment record. I
                understand this entry is permanent, is recorded against my name,
                and forms part of the order&apos;s compliance record.
              </span>
            </label>
          </div>
        )}

        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "1rem 2rem 1.5rem",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
        {error && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: 0,
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: 0 }}>
          {step === "form" ? (
            <>
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  ...btnBase,
                  backgroundColor: "var(--color-action-primary)",
                  color: "#ffffff",
                }}
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ ...btnBase, ...textAction }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !acknowledged}
                style={{
                  ...btnBase,
                  backgroundColor: "var(--color-action-primary)",
                  color: "#ffffff",
                  cursor:
                    isPending || !acknowledged ? "not-allowed" : "pointer",
                  opacity: isPending || !acknowledged ? 0.4 : 1,
                }}
              >
                Record Refund
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={isPending}
                style={{ ...btnBase, ...textAction }}
              >
                Back
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
