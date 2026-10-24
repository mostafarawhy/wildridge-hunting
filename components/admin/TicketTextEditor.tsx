"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { updateTicketTextAction } from "@/lib/actions/tickets";

interface Props {
  ticketId: string;
  subject: string;
  description: string;
  canEdit: boolean;
  showCustomerNote: boolean;
  fromCustomer: boolean;
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

const secondaryBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
};

export default function TicketTextEditor({
  ticketId,
  subject,
  description,
  canEdit,
  showCustomerNote,
  fromCustomer,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftDescription, setDraftDescription] = useState(description);

  function handleEdit() {
    setDraftSubject(subject);
    setDraftDescription(description);
    setError(null);
    setErrorCode(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setError(null);
    setErrorCode(null);
    setIsEditing(false);
  }

  function handleSave() {
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await updateTicketTextAction({
        ticketId,
        subject: draftSubject,
        description: draftDescription,
      });
      if (result.success) {
        setIsEditing(false);
        toast.success("Ticket text saved.");
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  const trimmedSubject = draftSubject.trim();
  const trimmedDescription = draftDescription.trim();
  const saveDisabled =
    isPending ||
    trimmedSubject === "" ||
    trimmedDescription === "" ||
    (trimmedSubject === subject && trimmedDescription === description);

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p style={labelStyle}>Description</p>
      </div>
      <div style={{ padding: "1.25rem" }}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label htmlFor="ticket-edit-subject" style={fieldLabelStyle}>
                Subject
              </label>
              <input
                id="ticket-edit-subject"
                type="text"
                maxLength={200}
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                disabled={isPending}
                style={textareaStyle}
              />
            </div>
            <div>
              <label htmlFor="ticket-edit-description" style={fieldLabelStyle}>
                Description
              </label>
              <textarea
                id="ticket-edit-description"
                rows={6}
                maxLength={5000}
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                disabled={isPending}
                style={textareaStyle}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                disabled={saveDisabled}
                onClick={handleSave}
                style={{
                  ...btnBase,
                  backgroundColor: "var(--color-action-primary)",
                  color: "#ffffff",
                  cursor: saveDisabled ? "not-allowed" : "pointer",
                  opacity: saveDisabled ? 0.6 : 1,
                  transition: "opacity 150ms",
                }}
              >
                Save
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCancel}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  textDecoration: "underline",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                  transition: "opacity 150ms",
                }}
              >
                Cancel
              </button>
            </div>
            {error && (
              <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
                {error}
                {errorCode && (
                  <span style={{ color: "#6b6b6b" }}> ({errorCode})</span>
                )}
              </p>
            )}
          </div>
        ) : (
          <>
            <p
              style={{
                ...valueStyle,
                whiteSpace: "pre-wrap",
                lineHeight: "var(--leading-relaxed)",
                ...(fromCustomer
                  ? {
                      borderInlineStart: "3px solid var(--color-status-warning)",
                      paddingInlineStart: "0.75rem",
                    }
                  : {}),
              }}
            >
              {description}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={handleEdit}
                style={{ ...secondaryBtn, marginTop: "1rem", cursor: "pointer" }}
              >
                Edit subject &amp; description
              </button>
            )}
            {showCustomerNote && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  marginTop: "1rem",
                }}
              >
                Submitted by the customer. Its text can&apos;t be edited — add a
                comment instead.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
