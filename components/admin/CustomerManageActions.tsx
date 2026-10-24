"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  updateCustomerNoteAction,
  setCustomerActiveAction,
} from "@/lib/actions/customer";

interface Props {
  customerId: string;
  currentNote: string | null;
  isActive: boolean;
  canManage: boolean;
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
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
  marginBottom: "0.75rem",
};

interface SuspendModalProps {
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function SuspendModal({ isPending, onConfirm, onClose }: SuspendModalProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function handleConfirm() {
    if (!reason.trim()) {
      setReasonError("A suspension reason is required.");
      return;
    }
    setReasonError(null);
    onConfirm(reason.trim());
  }

  const modalBtnBase: React.CSSProperties = {
    ...btnBase,
    cursor: isPending ? "not-allowed" : "pointer",
    opacity: isPending ? 0.6 : 1,
    transition: "opacity 150ms",
  };

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
          Suspend Account
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Provide a reason for suspension. The customer will be signed out of
          all active sessions immediately.
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
            style={{
              ...modalBtnBase,
              backgroundColor: "#991b1b",
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
            Suspend
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

export default function CustomerManageActions({
  customerId,
  currentNote,
  isActive,
  canManage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [note, setNote] = useState(currentNote ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  function handleSaveNote() {
    setNoteError(null);
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerNoteAction(customerId, note);
      if (result.success) {
        router.refresh();
      } else {
        setNoteError(result.error);
      }
    });
  }

  function handleSuspend(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await setCustomerActiveAction(customerId, false, reason);
      if (result.success) {
        setSuspendOpen(false);
        router.refresh();
      } else {
        setSuspendOpen(false);
        setError(result.error);
      }
    });
  }

  function handleReactivate() {
    setError(null);
    startTransition(async () => {
      const result = await setCustomerActiveAction(customerId, true);
      if (result.success) {
        setReactivateOpen(false);
        router.refresh();
      } else {
        setReactivateOpen(false);
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Internal Note */}
      <div>
        <p style={sectionLabelStyle}>Internal Note</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Private notes visible only to staff…"
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
        {noteError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {noteError}
          </p>
        )}
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              transition: "opacity 150ms",
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
            Save Note
          </button>
        </div>
      </div>

      {/* Account Status */}
      <div>
        <p style={sectionLabelStyle}>Account Status</p>
        {isActive ? (
          <button
            type="button"
            onClick={() => setSuspendOpen(true)}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "#991b1b",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            Suspend Account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReactivateOpen(true)}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "#166534",
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            Reactivate Account
          </button>
        )}
      </div>

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      {suspendOpen && (
        <SuspendModal
          isPending={isPending}
          onConfirm={handleSuspend}
          onClose={() => setSuspendOpen(false)}
        />
      )}

      <ConfirmDialog
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onConfirm={handleReactivate}
        title="Reactivate Account"
        message="This will allow the customer to sign in again. Are you sure?"
        confirmLabel="Reactivate"
        cancelLabel="Cancel"
        isPending={isPending}
        destructive={false}
      />
    </div>
  );
}
