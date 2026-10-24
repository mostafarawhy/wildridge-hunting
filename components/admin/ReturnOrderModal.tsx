"use client";

import { useEffect, useState } from "react";
import { recordOrderReturnAction } from "@/lib/actions/order-returns";
import { formatAED, roundMoney } from "@/lib/utils/currency";
import type { OrderStatus, OrderUnwindPreview } from "@/lib/db/queries/order";

interface Props {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  receivedAed: number;
  refundedAed: number;
  preview: OrderUnwindPreview | null;
  onClose: () => void;
  onSuccess: () => void;
}

function returnErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "This order no longer exists.";
    case "STATUS_CHANGED":
      return "This order changed while the dialog was open. Reload the page.";
    case "INVALID_STATUS":
      return "A return can only be recorded on a shipped or delivered order.";
    case "PAYMENT_RECORD_MISSING":
      return "This order has no payment record. Nothing was changed.";
    case "CONFIRMATION_MISMATCH":
      return "The order number you typed does not match this order.";
    case "EXCEEDS_RECEIVED":
      return "The refund owed cannot be more than the amount received.";
    case "REASON_REQUIRED":
      return "Say why the refund owed is lower than the amount received.";
    case "BELOW_REFUNDED":
      return "The refund owed cannot be lower than what has already been refunded.";
    case "INTERNAL_ERROR":
      return "Something went wrong. Nothing was changed.";
    default:
      return fallback;
  }
}

export default function ReturnOrderModal({
  orderId,
  orderNumber,
  status,
  receivedAed,
  refundedAed,
  preview,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restock, setRestock] = useState<"IN" | "OUT">("IN");
  const [refund, setRefund] = useState(String(receivedAed));
  const [shortReason, setShortReason] = useState("");
  const [reason, setReason] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const refundNumber = Number(refund);
  const refundValid =
    refund.trim() !== "" &&
    Number.isFinite(refundNumber) &&
    refundNumber >= refundedAed &&
    refundNumber <= receivedAed;
  const lowered = refundValid && roundMoney(refundNumber) < receivedAed;
  const shortOk = !lowered || shortReason.trim().length >= 5;
  const typedOk = typed.trim().toLowerCase() === orderNumber.toLowerCase();
  const reasonOk = reason.trim().length >= 5;
  const canConfirm =
    refundValid && shortOk && typedOk && reasonOk && !isPending;

  async function handleConfirm() {
    if (!canConfirm) return;
    setIsPending(true);
    setError(null);
    const result = await recordOrderReturnAction({
      orderId,
      expectedStatus: status,
      restock: restock === "IN",
      refundDue: refundNumber,
      refundShortReason: lowered ? shortReason.trim() : undefined,
      reason: reason.trim(),
      customerMessage: customerMessage.trim() || undefined,
      confirmOrderNumber: typed.trim(),
    });
    if (result.success) {
      onSuccess();
      return;
    }
    setIsPending(false);
    setError(returnErrorMessage(result.errorCode, result.error));
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

  const lines: string[] = [];
  if (preview) {
    if (preview.pointsHeld > 0) {
      lines.push(
        `${preview.pointsHeld.toLocaleString("en-US")} points the customer spent are returned.`,
      );
    }
    if (preview.pointsEarnedNet > 0) {
      lines.push(
        `${preview.pointsEarnedNet.toLocaleString("en-US")} points earned on this order are taken back (customer balance ${preview.customerBalance.toLocaleString("en-US")}).`,
      );
    }
    if (preview.couponCode) {
      lines.push(`Coupon ${preview.couponCode} stays used.`);
    }
    if (preview.rewardCouponCodes.length > 0) {
      lines.push(
        `Reward ${preview.rewardCouponCodes.length === 1 ? "coupon" : "coupons"} ${preview.rewardCouponCodes.join(", ")} switched off.`,
      );
    }
  }
  lines.push(
    `Refund owed is recorded at ${refundValid ? formatAED(refundNumber) : "the amount you enter"}. Nothing is sent to the customer's bank until you record a refund.`,
  );

  const units = preview
    ? preview.stock.reduce((sum, s) => sum + s.units, 0)
    : 0;

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
          Record a Return for {orderNumber}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: 0,
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Use this when the goods have come back after shipping. Received so
          far: {formatAED(receivedAed)}.
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

        <fieldset
          style={{
            border: "none",
            padding: 0,
            margin: "0 0 0.875rem",
          }}
        >
          <legend style={fieldLabelStyle}>Stock</legend>
          <label
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-start",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              marginBottom: "0.375rem",
            }}
          >
            <input
              type="radio"
              name="rt-restock"
              checked={restock === "IN"}
              onChange={() => setRestock("IN")}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              Put the units back in stock
              {units > 0 ? ` (${units} ${units === 1 ? "unit" : "units"})` : ""}
            </span>
          </label>
          <label
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-start",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
            }}
          >
            <input
              type="radio"
              name="rt-restock"
              checked={restock === "OUT"}
              onChange={() => setRestock("OUT")}
              style={{ marginTop: "0.2rem" }}
            />
            <span>Keep them out of stock (damaged or not resellable)</span>
          </label>
        </fieldset>

        <label htmlFor="rt-refund" style={fieldLabelStyle}>
          Refund owed (AED)
        </label>
        <input
          id="rt-refund"
          type="number"
          step="0.01"
          min="0"
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          style={fieldStyle}
        />
        <p style={hintStyle}>
          Up to {formatAED(receivedAed)}
          {refundedAed > 0 ? `; ${formatAED(refundedAed)} is already refunded` : ""}
          .
        </p>

        {lowered && (
          <div
            style={{
              borderInlineStart: "3px solid var(--color-shop-divider)",
              paddingInlineStart: "0.75rem",
              marginBottom: "0.875rem",
            }}
          >
            <label htmlFor="rt-short" style={fieldLabelStyle}>
              Why is the refund lower than the amount received?
            </label>
            <input
              id="rt-short"
              type="text"
              value={shortReason}
              onChange={(e) => setShortReason(e.target.value)}
              maxLength={500}
              style={fieldStyle}
            />
          </div>
        )}

        <div
          style={{
            border: "1px solid var(--color-shop-divider)",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: "#6b6b6b",
              marginBottom: "0.5rem",
            }}
          >
            What happens
          </p>
          <ul
            style={{
              margin: 0,
              paddingInlineStart: "1.125rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <label htmlFor="rt-reason" style={fieldLabelStyle}>
          Reason
        </label>
        <textarea
          id="rt-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>Staff only. At least 5 characters.</p>

        <label htmlFor="rt-message" style={fieldLabelStyle}>
          Message to the customer (optional)
        </label>
        <textarea
          id="rt-message"
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>Goes in the email.</p>

        <label htmlFor="rt-typed" style={fieldLabelStyle}>
          Type {orderNumber} to confirm
        </label>
        <input
          id="rt-typed"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          style={fieldStyle}
        />

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
              backgroundColor: "#991b1b",
              color: "#ffffff",
              cursor: canConfirm ? "pointer" : "not-allowed",
              opacity: canConfirm ? 1 : 0.4,
            }}
          >
            Record Return
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
