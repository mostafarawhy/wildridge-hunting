"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { adjustLoyaltyPointsAction } from "@/lib/actions/loyalty-admin";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  LOYALTY_TYPE_LABELS,
  LOYALTY_TYPE_PILL,
} from "@/lib/utils/loyalty-labels";
import type { AdminCustomerLoyaltyRecentProjection } from "@/lib/db/queries/customer";

interface Props {
  customerId: string;
  email: string;
  balance: number;
  recent: AdminCustomerLoyaltyRecentProjection[];
  canAdjust: boolean;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

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
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

function signedPoints(delta: number): string {
  if (delta === 0) return "0";
  const abs = Math.abs(delta).toLocaleString("en-US");
  return delta > 0 ? `+${abs}` : `−${abs}`;
}

function parseWholePoints(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

interface AdjustModalProps {
  customerId: string;
  email: string;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
  onBalanceChanged: () => void;
}

function AdjustModal({
  customerId,
  email,
  balance,
  onClose,
  onSuccess,
  onBalanceChanged,
}: AdjustModalProps) {
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"ADD" | "REMOVE">("ADD");
  const [pointsInput, setPointsInput] = useState("");
  const [reason, setReason] = useState("");
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const parsedPoints = parseWholePoints(pointsInput);
  const previewValid = parsedPoints !== null && parsedPoints >= 1;
  const result = previewValid
    ? direction === "ADD"
      ? balance + parsedPoints
      : balance - parsedPoints
    : null;

  const modalBtnBase: React.CSSProperties = {
    ...btnBase,
    cursor: isPending ? "not-allowed" : "pointer",
    opacity: isPending ? 0.6 : 1,
    transition: "opacity 150ms",
  };

  function toggleStyle(selected: boolean): React.CSSProperties {
    return {
      ...modalBtnBase,
      backgroundColor: "#0b0b0b",
      color: "#ffffff",
      opacity: isPending ? 0.6 : selected ? 1 : 0.45,
    };
  }

  function handleConfirm() {
    setFormError(null);

    let pError: string | null = null;
    if (parsedPoints === null) pError = "Enter whole points.";
    else if (parsedPoints < 1) pError = "Enter at least 1 point.";
    else if (parsedPoints > 1000000) pError = "Enter at most 1,000,000 points.";
    else if (direction === "REMOVE" && parsedPoints > balance)
      pError = `This customer has ${balance.toLocaleString("en-US")} points.`;

    const trimmedReason = reason.trim();
    let rError: string | null = null;
    if (trimmedReason.length < 5)
      rError = "Give a reason of at least 5 characters.";
    else if (trimmedReason.length > 500)
      rError = "Keep the reason under 500 characters.";

    setPointsError(pError);
    setReasonError(rError);
    if (pError || rError || parsedPoints === null) return;

    startTransition(async () => {
      const outcome = await adjustLoyaltyPointsAction({
        customerId,
        direction,
        points: parsedPoints,
        reason: trimmedReason,
        expectedBalance: balance,
      });

      if (outcome.success) {
        onSuccess();
        return;
      }

      if (outcome.errorCode === "VALIDATION_ERROR" && outcome.fieldErrors) {
        if (outcome.fieldErrors.points)
          setPointsError(outcome.fieldErrors.points[0]);
        if (outcome.fieldErrors.reason)
          setReasonError(outcome.fieldErrors.reason[0]);
        return;
      }

      setFormError(outcome.error);
      if (outcome.errorCode === "BALANCE_CHANGED") onBalanceChanged();
    });
  }

  const countText =
    parsedPoints !== null && parsedPoints >= 1
      ? ` ${parsedPoints.toLocaleString("en-US")}`
      : "";
  const confirmLabel =
    direction === "ADD" ? `Add${countText} points` : `Remove${countText} points`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-overlay)",
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
          Adjust points
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          <span dir="ltr">{email}</span>
          {` · balance ${balance.toLocaleString("en-US")}`}
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            type="button"
            aria-pressed={direction === "ADD"}
            onClick={() => setDirection("ADD")}
            disabled={isPending}
            style={toggleStyle(direction === "ADD")}
          >
            Add
          </button>
          <button
            type="button"
            aria-pressed={direction === "REMOVE"}
            onClick={() => setDirection("REMOVE")}
            disabled={isPending}
            style={toggleStyle(direction === "REMOVE")}
          >
            Remove
          </button>
        </div>

        <label
          htmlFor="loyalty-adjust-points"
          style={{ ...labelStyle, display: "block", marginBottom: "0.375rem" }}
        >
          Points
        </label>
        <input
          id="loyalty-adjust-points"
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={pointsInput}
          onChange={(e) => {
            setPointsInput(e.target.value);
            setPointsError(null);
          }}
          style={{
            ...fieldStyle,
            borderColor: pointsError ? "#991b1b" : "var(--color-shop-divider)",
          }}
        />
        {pointsError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {pointsError}
          </p>
        )}

        <label
          htmlFor="loyalty-adjust-reason"
          style={{
            ...labelStyle,
            display: "block",
            marginTop: "1rem",
            marginBottom: "0.375rem",
          }}
        >
          Reason
        </label>
        <textarea
          id="loyalty-adjust-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(null);
          }}
          rows={4}
          style={{
            ...fieldStyle,
            resize: "vertical",
            borderColor: reasonError ? "#991b1b" : "var(--color-shop-divider)",
          }}
        />
        {reasonError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {reasonError}
          </p>
        )}
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginTop: "0.25rem",
          }}
        >
          Staff only. Kept in the points history and the audit log. The customer
          sees &quot;Adjusted by the store&quot;.
        </p>

        {result !== null && (
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              marginTop: "1rem",
            }}
          >
            {"New balance  "}
            <span dir="ltr">
              {`${balance.toLocaleString("en-US")} → ${result.toLocaleString("en-US")}`}
            </span>
          </p>
        )}

        {formError && (
          <p
            role="alert"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.75rem",
            }}
          >
            {formError}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              ...modalBtnBase,
              backgroundColor: direction === "ADD" ? "#0b0b0b" : "#991b1b",
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
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
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
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerLoyaltyCard({
  customerId,
  email,
  balance,
  recent,
  canAdjust,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const summaryRows = [
    {
      label: "Balance",
      value: `${balance.toLocaleString("en-US")} points`,
    },
    {
      label: "Last activity",
      value: recent[0] ? formatDisplayDate(recent[0].createdAt, "en") : "—",
    },
  ];

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <p style={labelStyle}>Loyalty</p>
        {canAdjust && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              ...btnBase,
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Adjust points
          </button>
        )}
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {summaryRows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "0.875rem 0",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
            <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
          </div>
        ))}

        {recent.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              padding: "0.875rem 0",
            }}
          >
            No loyalty activity yet.
          </p>
        ) : (
          recent.map((row, idx) => {
            const pill = LOYALTY_TYPE_PILL[row.type];
            return (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 0",
                  borderBottom:
                    idx < recent.length - 1
                      ? "1px solid var(--color-shop-divider)"
                      : "none",
                }}
              >
                <span
                  style={{
                    backgroundColor: pill.bg,
                    color: pill.text,
                    paddingInline: "0.5rem",
                    paddingBlock: "0.125rem",
                    fontSize: "var(--text-label)",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {LOYALTY_TYPE_LABELS[row.type]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {row.orderId && row.orderNumber ? (
                    <Link
                      href={`/admin/orders/${row.orderId}`}
                      dir="ltr"
                      style={{
                        fontFamily: "monospace",
                        color: "var(--color-action-primary)",
                        textDecoration: "none",
                      }}
                    >
                      {row.orderNumber}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                      }}
                    >
                      {row.reason ?? "—"}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    textAlign: "end",
                    flexShrink: 0,
                    display: "flex",
                    gap: "1rem",
                    alignItems: "center",
                  }}
                >
                  <span
                    dir="ltr"
                    style={{
                      color:
                        row.delta > 0
                          ? "#166534"
                          : row.delta < 0
                            ? "#991b1b"
                            : "#0b0b0b",
                    }}
                  >
                    {signedPoints(row.delta)}
                  </span>
                  <span style={{ ...valueStyle, color: "#6b6b6b" }}>
                    {row.balanceAfter.toLocaleString("en-US")}
                  </span>
                  <span
                    style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
                  >
                    {formatDisplayDate(row.createdAt, "en")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canAdjust && (
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          <Link
            href={`/admin/loyalty/activity?q=${encodeURIComponent(email)}`}
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            View all activity
          </Link>
        </div>
      )}

      {modalOpen && (
        <AdjustModal
          customerId={customerId}
          email={email}
          balance={balance}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            toast.success("Points adjusted.");
            router.refresh();
          }}
          onBalanceChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
