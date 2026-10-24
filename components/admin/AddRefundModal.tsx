"use client";

import { useEffect, useState } from "react";
import { addOrderRefundDueAction } from "@/lib/actions/order-returns";
import { formatAED, roundMoney } from "@/lib/utils/currency";

interface Props {
  orderId: string;
  receivedAed: number;
  refundDueAed: number;
  onClose: () => void;
  onSuccess: () => void;
}

function addRefundErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "This order no longer exists.";
    case "NOTHING_RECEIVED":
      return "No payment has been received on this order.";
    case "INVALID_STATUS":
      return "This order is still waiting on an online payment.";
    case "BALANCE_CHANGED":
      return "The refund owed changed while this form was open. Reload the page.";
    case "EXCEEDS_RECEIVED":
      return "The refund owed cannot be more than the amount received.";
    case "INTERNAL_ERROR":
      return "Something went wrong. Nothing was changed.";
    default:
      return fallback;
  }
}

export default function AddRefundModal({
  orderId,
  receivedAed,
  refundDueAed,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const room = roundMoney(receivedAed - refundDueAed);
  const amountNumber = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber <= room;
  const canConfirm = amountValid && reason.trim().length >= 5 && !isPending;

  async function handleConfirm() {
    if (!canConfirm) return;
    setIsPending(true);
    setError(null);
    const result = await addOrderRefundDueAction({
      orderId,
      expectedRefundDue: refundDueAed,
      amount: amountNumber,
      reason: reason.trim(),
    });
    if (result.success) {
      onSuccess();
      return;
    }
    setIsPending(false);
    setError(addRefundErrorMessage(result.errorCode, result.error));
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
          maxWidth: "440px",
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
          Add a Refund
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: 0,
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Record that more money is owed back to the customer. Received{" "}
          {formatAED(receivedAed)}; refund owed so far {formatAED(refundDueAed)}.
          Nothing is sent until you record the refund itself.
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

        <label htmlFor="ar-amount" style={fieldLabelStyle}>
          Amount (AED)
        </label>
        <input
          id="ar-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={fieldStyle}
        />
        <p style={hintStyle}>Up to {formatAED(room)} more can be owed.</p>

        <label htmlFor="ar-reason" style={fieldLabelStyle}>
          Reason
        </label>
        <textarea
          id="ar-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
        <p style={{ ...hintStyle, marginBottom: 0 }}>
          Staff only. At least 5 characters.
        </p>

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
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              ...btnBase,
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
              cursor: canConfirm ? "pointer" : "not-allowed",
              opacity: canConfirm ? 1 : 0.4,
            }}
          >
            Add Refund Owed
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
    </div>
  );
}
