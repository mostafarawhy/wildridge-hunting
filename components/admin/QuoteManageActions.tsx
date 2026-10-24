"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { transitionQuoteAction } from "@/lib/actions/quote";
import {
  QUOTE_TRANSITIONS,
  QUOTE_STATUS_LABELS,
  isTerminalQuoteStatus,
} from "@/lib/utils/quote-status";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { QuoteStatus } from "@/lib/db/queries/quote";

interface Props {
  quoteId: string;
  status: QuoteStatus;
  canManage: boolean;
  convertedOrderNumber: string | null;
}

interface ReasonModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmBg: string;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function ReasonModal({
  title,
  description,
  confirmLabel,
  confirmBg,
  isPending,
  onConfirm,
  onClose,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function handleConfirm() {
    if (!reason.trim()) {
      setReasonError("A reason is required.");
      return;
    }
    setReasonError(null);
    onConfirm(reason.trim());
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
          {title}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {description}
        </p>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (e.target.value.trim()) setReasonError(null);
          }}
          rows={4}
          placeholder="Provide a reason..."
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            fontSize: "var(--text-body)",
            color: "#0b0b0b",
            border: `1px solid ${reasonError ? "#991b1b" : "var(--color-shop-divider)"}`,
            borderRadius: "0",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
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
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{ ...btnBase, backgroundColor: confirmBg, color: "#ffffff" }}
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

export default function QuoteManageActions({
  quoteId,
  status,
  canManage,
  convertedOrderNumber,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contactedOpen, setContactedOpen] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<"CANCELLED" | null>(null);

  if (!canManage) {
    return (
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Read-only — insufficient permissions to take action.
      </p>
    );
  }

  if (isTerminalQuoteStatus(status)) {
    return (
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        {convertedOrderNumber != null
          ? `This quote was converted to order ${convertedOrderNumber} — no further actions.`
          : status === "ACCEPTED"
            ? "Accepted. Waiting for the customer to confirm and place the order."
            : `This quote is ${QUOTE_STATUS_LABELS[status]} — no further actions.`}
      </p>
    );
  }

  function handleTransition(
    toStatus: "CONTACTED" | "CLOSED" | "CANCELLED",
    note?: string,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await transitionQuoteAction({ quoteId, toStatus, note });
      if (result.success) {
        toast.success(
          {
            CONTACTED: "Quote marked contacted.",
            CLOSED: "Quote closed.",
            CANCELLED: "Quote cancelled.",
          }[toStatus],
        );
        router.refresh();
      } else {
        setError(result.error);
      }
    });
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

  const allowedTransitions = QUOTE_TRANSITIONS[status].filter(
    (s) => s !== "QUOTED",
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {allowedTransitions.length > 0 && (
        <div>
          <p
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: "#6b6b6b",
              marginBottom: "1rem",
            }}
          >
            Status
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {allowedTransitions.includes("CONTACTED") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setContactedOpen(true)}
                style={{
                  ...btnBase,
                  backgroundColor: "#1e40af",
                  color: "#ffffff",
                }}
              >
                Mark Contacted
              </button>
            )}
            {allowedTransitions.includes("CLOSED") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setClosedOpen(true)}
                style={{
                  ...btnBase,
                  backgroundColor: "#374151",
                  color: "#ffffff",
                }}
              >
                Close Quote
              </button>
            )}
            {allowedTransitions.includes("CANCELLED") && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setReasonModal("CANCELLED")}
                style={{
                  ...btnBase,
                  backgroundColor: "#991b1b",
                  color: "#ffffff",
                }}
              >
                Cancel Quote
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      <ConfirmDialog
        open={contactedOpen}
        onClose={() => setContactedOpen(false)}
        onConfirm={() => {
          setContactedOpen(false);
          handleTransition("CONTACTED");
        }}
        title="Mark as Contacted"
        message="This will move the quote to Contacted status, indicating you've reached out to the customer."
        confirmLabel="Mark Contacted"
        cancelLabel="Cancel"
        isPending={isPending}
        destructive={false}
      />

      <ConfirmDialog
        open={closedOpen}
        onClose={() => setClosedOpen(false)}
        onConfirm={() => {
          setClosedOpen(false);
          handleTransition("CLOSED");
        }}
        title="Close Quote"
        message="This will close the quote. This action cannot be undone."
        confirmLabel="Close Quote"
        cancelLabel="Cancel"
        isPending={isPending}
        destructive={false}
      />

      {reasonModal === "CANCELLED" && (
        <ReasonModal
          title="Cancel Quote"
          description="Provide a reason for cancellation. This will be sent to the customer."
          confirmLabel="Confirm Cancellation"
          confirmBg="#991b1b"
          isPending={isPending}
          onConfirm={(reason) => {
            setReasonModal(null);
            handleTransition("CANCELLED", reason);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  );
}
