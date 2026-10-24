"use client";

import { isDemoMode } from "@/lib/config/demo";
import { BRAND } from "@/lib/config/brand";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import {
  transitionOrderAction,
  quoteOrderShippingAction,
  markOrderPaidAction,
  recordOrderContactAction,
} from "@/lib/actions/orders";
import { checkOrderPaymentAction } from "@/lib/actions/order-payment";
import {
  CANCELLABLE_STATUSES,
  RETURNABLE_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_FORWARD_CHAIN,
  getForwardJumpTargets,
  getForwardPath,
} from "@/lib/utils/order-status";
import { sumMoney, roundMoney, formatAED } from "@/lib/utils/currency";
import { dubaiDay, formatDisplayDate } from "@/lib/utils/date";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Select from "@/components/ui/Select";
import AdminFileField from "@/components/admin/AdminFileField";
import MoveOrderModal from "@/components/admin/MoveOrderModal";
import DeliverOrderModal from "@/components/admin/DeliverOrderModal";
import SerialCaptureModal from "@/components/admin/SerialCaptureModal";
import CancelOrderModal from "@/components/admin/CancelOrderModal";
import ReturnOrderModal from "@/components/admin/ReturnOrderModal";
import AddRefundModal from "@/components/admin/AddRefundModal";
import { serialProgress } from "@/lib/utils/order-serials";
import type { SerialLineInput } from "@/lib/utils/order-serials";
import type { OrderStatus, OrderUnwindPreview } from "@/lib/db/queries/order";

interface Props {
  orderId: string;
  status: OrderStatus;
  deliveredAt: string | null;
  deliveryReceivedBy: string | null;
  regulated: boolean;
  loyaltyPoints: number;
  canManage: boolean;
  canOverrideSerials: boolean;
  serialItems: SerialLineInput[];
  subtotalAed: number;
  addonTotalAed: number;
  discountAmountAed: number;
  shippingCostAed: number;
  shippingQuotedAt: string | null;
  vatRate: number;
  canMarkPaid: boolean;
  outstandingAed: number;
  orderTotalAed: number;
  canRecordContact: boolean;
  canCreateTicket: boolean;
  customerEmail: string;
  orderNumber: string;
  receivedAed: number;
  refundDueAed: number;
  refundedAed: number;
  owedAed: number;
  preview: OrderUnwindPreview | null;
  hasGatewayReference: boolean;
  initialAction: "pay" | "deliver" | "refund" | "cancel" | "return" | null;
}

const textAction: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#0b0b0b",
  border: "none",
  paddingInline: 0,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};

const destructiveFilled: React.CSSProperties = {
  backgroundColor: "#991b1b",
  color: "#ffffff",
  border: "1px solid #991b1b",
};

interface QuoteShippingModalProps {
  isPending: boolean;
  goodsAed: number;
  discountAed: number;
  previousQuoteAed: number;
  isRequote: boolean;
  vatRate: number;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

function QuoteShippingModal({
  isPending,
  goodsAed,
  discountAed,
  previousQuoteAed,
  isRequote,
  vatRate,
  onConfirm,
  onClose,
}: QuoteShippingModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function validationError(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return "A shipping quote is required.";
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return "Enter a valid amount.";
    if (n < 0) return "The quote cannot be negative.";
    if (n > 100000) return "The quote cannot exceed AED 100,000.";
    return null;
  }

  function handleConfirm() {
    const err = validationError(value);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onConfirm(roundMoney(Number(value.trim())));
  }

  const trimmedValue = value.trim();
  const parsedValue = Number(trimmedValue);
  const showPreview =
    trimmedValue !== "" && Number.isFinite(parsedValue) && parsedValue >= 0;

  let previewTotal = 0;
  let previewVat = 0;
  if (showPreview) {
    const quote = roundMoney(parsedValue);
    previewTotal = Math.max(0, sumMoney([goodsAed, quote, -discountAed]));
    const previewGoodsBase = Math.max(0, sumMoney([goodsAed, -discountAed]));
    previewVat = roundMoney(
      previewGoodsBase - previewGoodsBase / (1 + vatRate),
    );
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "var(--text-body)",
    color: "#0b0b0b",
    border: "1px solid var(--color-shop-divider)",
    borderRadius: "0",
    outline: "none",
    boxSizing: "border-box",
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
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "440px",
          padding: "2rem",
          margin: "1rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          {isRequote ? "Re-quote Shipping" : "Enter Shipping Quote"}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Enter the shipping charge in AED, VAT inclusive. The customer will be
          asked to approve this total before paying.
        </p>

        <div
          style={{
            backgroundColor: "#f5f5f5",
            border: "1px solid #e3e3e3",
            borderRadius: "0",
            padding: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
              Goods
            </p>
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatAED(goodsAed, "en")}
            </p>
          </div>
          {discountAed > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.375rem",
              }}
            >
              <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                Discount
              </p>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                −{formatAED(discountAed, "en")}
              </p>
            </div>
          )}
          {isRequote && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.375rem",
              }}
            >
              <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                Previous quote
              </p>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(previousQuoteAed, "en")}
              </p>
            </div>
          )}
        </div>

        <label
          style={{
            display: "block",
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-semibold)",
            color: "#6b6b6b",
            marginBottom: "0.375rem",
          }}
        >
          Shipping Quote (AED)
        </label>
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (!validationError(e.target.value)) setError(null);
          }}
          placeholder="e.g. 400.00"
          style={{
            ...inputStyle,
            border: `1px solid ${error ? "#991b1b" : "var(--color-shop-divider)"}`,
          }}
        />
        {error && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {error}
          </p>
        )}

        {showPreview && (
          <div
            style={{
              marginTop: "1rem",
              borderTop: "1px solid #e3e3e3",
              paddingTop: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-semibold)",
                  color: "#0b0b0b",
                }}
              >
                Customer pays
              </p>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-semibold)",
                  color: "#0b0b0b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(previewTotal, "en")}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.25rem",
              }}
            >
              <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                VAT included
              </p>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(previewVat, "en")}
              </p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
            }}
          >
            {isPending && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "0.875em",
                  height: "0.875em",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  marginInlineEnd: "0.5rem",
                  flexShrink: 0,
                }}
              />
            )}
            Confirm Quote
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{ ...btnBase, ...textAction }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContactModalProps {
  isPending: boolean;
  customerEmail: string;
  orderNumber: string;
  onConfirm: (note: string) => void;
  onClose: () => void;
}

function ContactModal({
  isPending,
  customerEmail,
  orderNumber,
  onConfirm,
  onClose,
}: ContactModalProps) {
  const [note, setNote] = useState("");

  function handleConfirm() {
    onConfirm(note.trim());
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
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "440px",
          padding: "2rem",
          margin: "1rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          Record Contact Attempt
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Log an attempt to contact the customer about this order. Staff only —
          the customer never sees this note.
        </p>
        <a
          href={`mailto:${customerEmail}?subject=${encodeURIComponent(`${BRAND.name} — Order ${orderNumber}`)}`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-action-primary)",
            textDecoration: "underline",
            display: "inline-block",
            marginBottom: "1rem",
          }}
        >
          Compose email to {customerEmail} →
        </a>

        <label
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            display: "block",
            marginBottom: "0.375rem",
          }}
        >
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="What was discussed, or how you tried to reach them..."
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            fontSize: "var(--text-body)",
            color: "#0b0b0b",
            border: "1px solid var(--color-shop-divider)",
            borderRadius: "0",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
            }}
          >
            {isPending && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "0.875em",
                  height: "0.875em",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  marginInlineEnd: "0.5rem",
                  flexShrink: 0,
                }}
              />
            )}
            Record Contact
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{ ...btnBase, ...textAction }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface MarkPaidModalProps {
  orderId: string;
  orderTotalAed: number;
  outstandingAed: number;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD_TERMINAL", label: "Card terminal" },
  { value: "OTHER", label: "Other" },
] as const;

function MarkPaidModal({
  orderId,
  orderTotalAed,
  outstandingAed,
  onClose,
  onSuccess,
}: MarkPaidModalProps) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState("");
  const [methodOtherLabel, setMethodOtherLabel] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
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
    amountNumber <= outstandingAed;
  const balanceAfter = amountValid
    ? roundMoney(outstandingAed - amountNumber)
    : null;

  function handleMethodChange(next: string) {
    setMethod(next);
    if (next !== "OTHER") setMethodOtherLabel("");
    setError(null);
  }

  function handleContinue() {
    if (!method) {
      setError("Select a payment method.");
      return;
    }
    if (method === "OTHER" && !methodOtherLabel.trim()) {
      setError("Describe the payment method when recording an Other payment.");
      return;
    }
    if (!externalReference.trim()) {
      setError("Enter a payment reference.");
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
    if (amountNumber > outstandingAed) {
      setError("This amount is more than the outstanding balance.");
      return;
    }
    if (!paidAt) {
      setError("Enter the date the payment was received.");
      return;
    }
    if (paidAt > todayDubai) {
      setError("The paid date cannot be in the future.");
      return;
    }
    if (!isDemoMode()) {
      if (!proof) {
        setError("Attach proof of payment.");
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
    formData.append("paidAt", paidAt);
    formData.append("expectedOutstanding", String(outstandingAed));
    formData.append("acknowledged", "true");
    if (proof) formData.append("proof", proof);
    if (notes.trim()) formData.append("notes", notes.trim());
    if (method === "OTHER") {
      formData.append("methodOtherLabel", methodOtherLabel.trim());
    }

    const result = await markOrderPaidAction(formData);

    if (result.success) {
      onSuccess();
      return;
    }

    setIsPending(false);
    setStep("form");
    setError(markPaidErrorMessage(result.errorCode, result.error));
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
          {step === "form" ? "Record Payment" : "Confirm Settlement"}
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
            ? `Record a settlement against this order. Outstanding is ${formatAED(outstandingAed)}.`
            : "Check these values against the bank record before recording."}
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
            <label htmlFor="mp-method" style={fieldLabelStyle}>
              Method
            </label>
            <select
              id="mp-method"
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Select a method…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p style={hintStyle}>How the customer actually paid.</p>

            {method === "OTHER" && (
              <div
                style={{
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                  marginBottom: "0.875rem",
                }}
              >
                <label htmlFor="mp-other-label" style={fieldLabelStyle}>
                  Method label
                </label>
                <input
                  id="mp-other-label"
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

            <label htmlFor="mp-reference" style={fieldLabelStyle}>
              Reference
            </label>
            <input
              id="mp-reference"
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
                <label htmlFor="mp-amount" style={fieldLabelStyle}>
                  Amount (AED)
                </label>
                <input
                  id="mp-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={fieldStyle}
                />
                <p style={hintStyle}>
                  Outstanding is {formatAED(outstandingAed)}.
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="mp-paid-at" style={fieldLabelStyle}>
                  Paid date
                </label>
                <input
                  id="mp-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  max={todayDubai}
                  style={fieldStyle}
                />
                <p style={hintStyle}>The date the money arrived, not today.</p>
              </div>
            </div>

            {isDemoMode() ? (
              <p style={hintStyle}>
                File uploads are disabled in the demo. A sample document is attached automatically.
              </p>
            ) : (
              <AdminFileField
                name="Proof of payment"
                spec="JPEG, PNG or PDF, max 5 MB — required."
                file={proof}
                onSelect={(file) => setProof(file)}
              />
            )}
            <div style={{ height: "0.875rem" }} />

            <label htmlFor="mp-notes" style={fieldLabelStyle}>
              Internal note
            </label>
            <textarea
              id="mp-notes"
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
                {PAYMENT_METHODS.find((m) => m.value === method)?.label}
                {method === "OTHER" ? ` — ${methodOtherLabel.trim()}` : ""}
              </span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Reference</span>
              <span style={summaryValue}>{externalReference.trim()}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Paid date</span>
              <span style={summaryValue}>{paidAt}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Proof</span>
              <span style={summaryValue}>{proof?.name ?? "Sample document"}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>Order total</span>
              <span style={summaryValue}>{formatAED(orderTotalAed)}</span>
            </div>
            <div style={summaryRow}>
              <span style={summaryLabel}>This payment</span>
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
                Balance after
              </span>
              <span
                style={{
                  fontSize: "var(--text-heading)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {balanceAfter === null ? "—" : formatAED(balanceAfter)}
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
                I have verified this payment against the bank record. I
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
                {isPending && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: "0.875em",
                      height: "0.875em",
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      marginInlineEnd: "0.5rem",
                      flexShrink: 0,
                    }}
                  />
                )}
                Record Payment
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

function markPaidErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "FORBIDDEN":
      return "You do not have permission to record payments.";
    case "NOT_FOUND":
      return "This order no longer exists.";
    case "MISSING_PROOF":
      return "Attach proof of payment.";
    case "FILE_TOO_LARGE":
      return "Proof must be 5 MB or smaller.";
    case "INVALID_FILE_TYPE":
      return "Proof must be a JPEG, PNG or PDF.";
    case "UPLOAD_FAILED":
      return "The proof could not be uploaded. Try again.";
    case "INVALID_STATUS":
      return "This order is no longer awaiting offline payment. Reload the page.";
    case "BALANCE_CHANGED":
      return "The outstanding balance changed while this form was open. Reload the page.";
    case "OVERPAYMENT":
      return "This amount is more than the outstanding balance.";
    case "DUPLICATE_REFERENCE":
      return "That reference is already recorded against this order.";
    case "RECORDING_IN_PROGRESS":
      return "Another payment is being recorded against this order. Reload and check the settlement history before recording again.";
    case "INTERNAL_ERROR":
      return "Something went wrong. Nothing was recorded.";
    default:
      return fallback;
  }
}

const NEXT_STEP: Partial<
  Record<
    OrderStatus,
    { to: OrderStatus; label: string; title: string; message: string }
  >
> = {
  PAID: {
    to: "CONFIRMED",
    label: "Confirm order",
    title: "Confirm Order",
    message: "This will mark the order as confirmed.",
  },
  CONFIRMED: {
    to: "PROCESSING",
    label: "Start processing",
    title: "Start Processing",
    message: "This will mark the order as being processed.",
  },
  PROCESSING: {
    to: "READY_TO_SHIP",
    label: "Mark ready to ship",
    title: "Mark Ready to Ship",
    message: "This will mark the order as packed and ready to ship.",
  },
  READY_TO_SHIP: {
    to: "SHIPPED",
    label: "Mark shipped",
    title: "Mark as Shipped",
    message: "",
  },
  SHIPPED: {
    to: "DELIVERED",
    label: "Mark delivered",
    title: "Confirm Delivery",
    message:
      "This will mark the order as delivered and award loyalty points to the customer.",
  },
};

const PROGRESS_STEPS: OrderStatus[] = ORDER_FORWARD_CHAIN;

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
  transition: "opacity 150ms",
};

const complaintBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  ...textAction,
  borderRadius: "0",
};

function ComplaintButton({
  orderId,
  canCreateTicket,
}: {
  orderId: string;
  canCreateTicket: boolean;
}) {
  if (!canCreateTicket) return null;
  return (
    <Link href={`/admin/tickets?orderId=${orderId}`} style={complaintBtnStyle}>
      Report a Problem
    </Link>
  );
}

export default function OrderManageActions({
  orderId,
  status,
  deliveredAt,
  deliveryReceivedBy,
  regulated,
  loyaltyPoints,
  canManage,
  canOverrideSerials,
  serialItems,
  subtotalAed,
  addonTotalAed,
  discountAmountAed,
  shippingCostAed,
  shippingQuotedAt,
  vatRate,
  canMarkPaid,
  outstandingAed,
  orderTotalAed,
  canRecordContact,
  canCreateTicket,
  customerEmail,
  orderNumber,
  receivedAed,
  refundDueAed,
  refundedAed,
  owedAed,
  preview,
  hasGatewayReference,
  initialAction,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderStatus | "">("");
  const [confirmNext, setConfirmNext] = useState(false);
  const [moveTarget, setMoveTarget] = useState<OrderStatus | null>(null);
  const [serialsOpen, setSerialsOpen] = useState(false);
  const [deliverMode, setDeliverMode] = useState<"deliver" | "details" | null>(
    initialAction === "deliver" && canManage && status === "SHIPPED"
      ? "deliver"
      : null,
  );
  const [cancelOpen, setCancelOpen] = useState(
    initialAction === "cancel" &&
      canManage &&
      CANCELLABLE_STATUSES.includes(status),
  );
  const [returnOpen, setReturnOpen] = useState(
    initialAction === "return" &&
      canManage &&
      RETURNABLE_STATUSES.includes(status),
  );
  const [addRefundOpen, setAddRefundOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(
    initialAction === "pay" &&
      canMarkPaid &&
      status === "AWAITING_MANUAL_PAYMENT",
  );
  const [contactOpen, setContactOpen] = useState(false);

  const canCancel = CANCELLABLE_STATUSES.includes(status);
  const canReturn = RETURNABLE_STATUSES.includes(status);
  const canAddRefund = receivedAed > refundDueAed && status !== "PAYMENT_PENDING";

  const linkRow = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      {canManage && canCancel && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setCancelOpen(true)}
          style={{
            ...btnBase,
            ...textAction,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Cancel order…
        </button>
      )}
      {canManage && canReturn && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setReturnOpen(true)}
          style={{
            ...btnBase,
            ...textAction,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Record a return…
        </button>
      )}
      {canManage && canAddRefund && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setAddRefundOpen(true)}
          style={{
            ...btnBase,
            ...textAction,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          Add a refund…
        </button>
      )}
      <ComplaintButton orderId={orderId} canCreateTicket={canCreateTicket} />
    </div>
  );

  const unwindModals = (
    <>
      {cancelOpen && (
        <CancelOrderModal
          orderId={orderId}
          orderNumber={orderNumber}
          status={status}
          receivedAed={receivedAed}
          preview={preview}
          onClose={() => setCancelOpen(false)}
          onSuccess={() => {
            setCancelOpen(false);
            toast.success("Order cancelled.");
            router.refresh();
          }}
        />
      )}
      {returnOpen && (
        <ReturnOrderModal
          orderId={orderId}
          orderNumber={orderNumber}
          status={status}
          receivedAed={receivedAed}
          refundedAed={refundedAed}
          preview={preview}
          onClose={() => setReturnOpen(false)}
          onSuccess={() => {
            setReturnOpen(false);
            toast.success("Return recorded.");
            router.refresh();
          }}
        />
      )}
      {addRefundOpen && (
        <AddRefundModal
          orderId={orderId}
          receivedAed={receivedAed}
          refundDueAed={refundDueAed}
          onClose={() => setAddRefundOpen(false)}
          onSuccess={() => {
            setAddRefundOpen(false);
            toast.success("Refund owed added.");
            router.refresh();
          }}
        />
      )}
    </>
  );

  if (
    !canManage &&
    !(status === "AWAITING_MANUAL_PAYMENT" && (canMarkPaid || canRecordContact))
  ) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          Read-only — insufficient permissions to take action.
        </p>
        <ComplaintButton orderId={orderId} canCreateTicket={canCreateTicket} />
      </div>
    );
  }

  if (status === "DELIVERED") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          {deliveredAt
            ? `Delivered on ${formatDisplayDate(deliveredAt, "en")}.`
            : "Delivered."}{" "}
          {deliveryReceivedBy === null
            ? "Handover details are not recorded yet."
            : "Nothing left to do on this order."}
        </p>
        {deliveryReceivedBy === null && (
          <button
            type="button"
            onClick={() => setDeliverMode("details")}
            style={{
              ...btnBase,
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Add handover details
          </button>
        )}
        {linkRow}
        {unwindModals}
        {deliverMode === "details" && (
          <DeliverOrderModal
            orderId={orderId}
            mode="details"
            regulated={regulated}
            loyaltyPoints={loyaltyPoints}
            onClose={() => setDeliverMode(null)}
            onSuccess={() => {
              setDeliverMode(null);
              toast.success("Handover details recorded.");
              router.refresh();
            }}
          />
        )}
      </div>
    );
  }

  if (
    status === "CANCELLED" ||
    status === "RETURNED" ||
    status === "REFUNDED" ||
    status === "PARTIALLY_REFUNDED"
  ) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          This order is {ORDER_STATUS_LABELS[status]}.
          {owedAed > 0 ? ` Refund owed ${formatAED(owedAed, "en")}.` : ""}
        </p>
        {linkRow}
        {unwindModals}
      </div>
    );
  }

  if (
    status === "AWAITING_SHIPPING_QUOTE" ||
    status === "AWAITING_QUOTE_APPROVAL"
  ) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={isPending}
            onClick={() => setQuoteOpen(true)}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {shippingQuotedAt !== null
              ? "Re-quote Shipping"
              : "Enter Shipping Quote"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setCancelOpen(true)}
            style={{
              ...btnBase,
              ...destructiveFilled,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Cancel Order
          </button>
          <ComplaintButton orderId={orderId} canCreateTicket={canCreateTicket} />
        </div>

        {error && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
              {error}
            </p>
          </div>
        )}

        {quoteOpen && (
          <QuoteShippingModal
            isPending={isPending}
            goodsAed={sumMoney([subtotalAed, addonTotalAed])}
            discountAed={discountAmountAed}
            previousQuoteAed={shippingCostAed}
            isRequote={shippingQuotedAt !== null}
            vatRate={vatRate}
            onConfirm={(amount) => {
              setQuoteOpen(false);
              handleQuote(amount);
            }}
            onClose={() => setQuoteOpen(false)}
          />
        )}

        {unwindModals}
      </div>
    );
  }

  if (status === "AWAITING_MANUAL_PAYMENT") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {canMarkPaid && (
            <button
              type="button"
              onClick={() => setMarkPaidOpen(true)}
              disabled={isPending}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Record Payment
            </button>
          )}
          {canManage && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
              style={{
                ...btnBase,
                ...destructiveFilled,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Cancel Order
            </button>
          )}
          {canRecordContact && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setContactOpen(true)}
              style={{
                ...btnBase,
                ...textAction,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Record Contact
            </button>
          )}
          <ComplaintButton orderId={orderId} canCreateTicket={canCreateTicket} />
        </div>

        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          Outstanding balance {formatAED(outstandingAed, "en")}.
        </p>

        {error && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
              {error}
            </p>
          </div>
        )}

        {unwindModals}

        {markPaidOpen && (
          <MarkPaidModal
            orderId={orderId}
            orderTotalAed={orderTotalAed}
            outstandingAed={outstandingAed}
            onClose={() => setMarkPaidOpen(false)}
            onSuccess={() => {
              setMarkPaidOpen(false);
              toast.success("Payment recorded.");
              router.refresh();
            }}
          />
        )}

        {contactOpen && (
          <ContactModal
            isPending={isPending}
            customerEmail={customerEmail}
            orderNumber={orderNumber}
            onConfirm={(note) => {
              setContactOpen(false);
              handleRecordContact(note);
            }}
            onClose={() => setContactOpen(false)}
          />
        )}
      </div>
    );
  }

  const forwardTargets = getForwardJumpTargets(status);

  if (forwardTargets.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          {status === "PAYMENT_PENDING"
            ? "Awaiting the customer's card payment. Check it with the gateway, or cancel it if it was abandoned."
            : status === "PAYMENT_FAILED"
              ? "The online payment failed."
              : "This order is awaiting payment — no staff actions available yet."}
        </p>
        {status === "PAYMENT_PENDING" && canManage && hasGatewayReference && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleCheckPayment}
            style={{
              ...btnBase,
              ...textAction,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Checking…" : "Check payment"}
          </button>
        )}
        {linkRow}
        {error && (
          <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
            {error}
          </p>
        )}
        {unwindModals}
      </div>
    );
  }

  function handleTransition(
    toStatus: "CONFIRMED" | "PROCESSING" | "READY_TO_SHIP",
  ) {
    setError(null);
    startTransition(async () => {
      const result = await transitionOrderAction({
        orderId,
        expectedStatus: status,
        toStatus,
      });
      if (result.success) {
        toast.success(`Order moved to ${ORDER_STATUS_LABELS[toStatus]}.`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRecordContact(note: string) {
    setError(null);
    startTransition(async () => {
      const result = await recordOrderContactAction({
        orderId,
        note: note || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Contact recorded.");
      router.refresh();
    });
  }

  function handleCheckPayment() {
    setError(null);
    startTransition(async () => {
      const result = await checkOrderPaymentAction({ orderId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data.status === "PAID") {
        toast.success("Payment captured. The order is now Paid.");
      } else if (result.data.status === "PAYMENT_FAILED") {
        toast.info(
          "The gateway reports the payment failed. The customer can pay again from their account.",
        );
      } else {
        toast.info("No payment has been completed yet.");
      }
      router.refresh();
    });
  }

  function handleQuote(shippingQuoteAed: number) {
    setError(null);
    startTransition(async () => {
      const result = await quoteOrderShippingAction({
        orderId,
        shippingQuoteAed,
      });
      if (result.success) {
        toast.success("Shipping quote sent.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const nextStep = NEXT_STEP[status] ?? null;
  const moveOptions = status === "SHIPPED" ? [] : forwardTargets.slice(1);
  const currentIdx = PROGRESS_STEPS.indexOf(status);

  const progress = serialProgress(serialItems);
  const serialsIncomplete =
    progress.required > 0 && progress.recorded < progress.required;
  const showSerialsBox =
    progress.required > 0 &&
    (status === "PAID" ||
      status === "CONFIRMED" ||
      status === "PROCESSING" ||
      status === "READY_TO_SHIP");
  const recordSerialsFirst =
    serialsIncomplete &&
    (status === "PROCESSING" || status === "READY_TO_SHIP");

  function handleNext() {
    if (!nextStep) return;
    if (recordSerialsFirst) {
      setSerialsOpen(true);
      return;
    }
    if (nextStep.to === "SHIPPED") {
      setMoveTarget("SHIPPED");
    } else if (nextStep.to === "DELIVERED") {
      setDeliverMode("deliver");
    } else {
      setConfirmNext(true);
    }
  }

  function handleMoveContinue() {
    if (selected === "") return;
    setMoveTarget(selected);
    setSelected("");
  }

  const movePath = moveTarget ? getForwardPath(status, moveTarget) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <ol
        aria-label="Order progress"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${PROGRESS_STEPS.length}, 1fr)`,
          gap: "0.375rem",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {PROGRESS_STEPS.map((step, idx) => {
          const done = currentIdx !== -1 && idx < currentIdx;
          const current = idx === currentIdx;
          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
            >
              <span
                style={{
                  display: "block",
                  height: "0.25rem",
                  backgroundColor: current
                    ? "var(--color-action-primary)"
                    : done
                      ? "#0b0b0b"
                      : "#e3e3e3",
                }}
              />
              <span
                style={{
                  fontSize: "var(--text-label)",
                  fontWeight: current
                    ? "var(--font-bold)"
                    : "var(--font-semibold)",
                  color: current || done ? "#0b0b0b" : "#6b6b6b",
                }}
              >
                {step === "READY_TO_SHIP" ? "Ready" : ORDER_STATUS_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>

      {showSerialsBox && (
        <div
          style={{
            backgroundColor: serialsIncomplete ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${serialsIncomplete ? "#fde68a" : "#bbf7d0"}`,
            padding: "0.75rem 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: serialsIncomplete ? "#92400e" : "#166534",
              margin: 0,
            }}
          >
            Serials — {progress.recorded} of {progress.required} units recorded
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setSerialsOpen(true)}
            style={{
              ...textAction,
              fontSize: "var(--text-body-sm)",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {serialsIncomplete ? "Record serials" : "Edit serials"}
          </button>
        </div>
      )}

      {nextStep && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleNext}
          style={{
            ...btnBase,
            width: "100%",
            backgroundColor: "var(--color-action-primary)",
            color: "#ffffff",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {recordSerialsFirst ? "Record serials" : nextStep.label}
        </button>
      )}

      {moveOptions.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "220px", flex: 1 }}>
            <Select
              label="Move to"
              id="order-move-select"
              value={selected}
              disabled={isPending}
              onChange={(e) => setSelected(e.target.value as OrderStatus | "")}
            >
              <option value="" disabled>
                Select a status…
              </option>
              {moveOptions.map((t) => (
                <option key={t} value={t}>
                  {ORDER_STATUS_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            disabled={isPending || selected === ""}
            onClick={handleMoveContinue}
            style={{
              ...btnBase,
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
              cursor: isPending || selected === "" ? "not-allowed" : "pointer",
              opacity: isPending || selected === "" ? 0.6 : 1,
            }}
          >
            Continue
          </button>
        </div>
      )}

      {linkRow}

      {error && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
            {error}
          </p>
        </div>
      )}

      {confirmNext && nextStep && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmNext(false)}
          onConfirm={() => {
            setConfirmNext(false);
            handleTransition(
              nextStep.to as "CONFIRMED" | "PROCESSING" | "READY_TO_SHIP",
            );
          }}
          title={nextStep.title}
          message={nextStep.message}
          confirmLabel={nextStep.label}
          cancelLabel="Cancel"
          isPending={isPending}
          destructive={false}
        />
      )}

      {deliverMode === "deliver" && (
        <DeliverOrderModal
          orderId={orderId}
          mode="deliver"
          regulated={regulated}
          loyaltyPoints={loyaltyPoints}
          onClose={() => setDeliverMode(null)}
          onSuccess={() => {
            setDeliverMode(null);
            toast.success("Order marked delivered.");
            router.refresh();
          }}
        />
      )}

      {serialsOpen && (
        <SerialCaptureModal
          orderId={orderId}
          expectedStatus={status}
          items={serialItems}
          canOverride={canOverrideSerials}
          onClose={() => setSerialsOpen(false)}
        />
      )}

      {moveTarget && movePath.length > 0 && (
        <MoveOrderModal
          orderId={orderId}
          fromStatus={status}
          target={moveTarget}
          path={movePath}
          serialItems={serialItems}
          canOverrideSerials={canOverrideSerials}
          onClose={() => setMoveTarget(null)}
          onSuccess={(to) => {
            setMoveTarget(null);
            toast.success(`Order moved to ${ORDER_STATUS_LABELS[to]}.`);
            router.refresh();
          }}
        />
      )}

      {unwindModals}
    </div>
  );
}
