"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  createVerificationDocumentRequestAction,
  cancelVerificationDocumentRequestAction,
} from "@/lib/actions/verification";
import { formatDateTime } from "@/lib/utils/date";
import type { VerificationDocumentRole } from "@/app/generated/prisma/enums";

type VerificationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

interface OpenRequest {
  id: string;
  scope: "DOCUMENTS" | "DETAILS";
  roles: VerificationDocumentRole[];
  message: string;
  requestedByName: string;
  createdAt: string;
}

interface Props {
  eventId: string;
  eventStatus: VerificationStatus;
  canRequest: boolean;
  allowDetails: boolean;
  openRequest: OpenRequest | null;
}

const ROLE_OPTIONS: { value: VerificationDocumentRole; label: string }[] = [
  { value: "IDENTITY", label: "Identity document" },
  { value: "PROOF_OF_ADDRESS", label: "Proof of address" },
  { value: "PHOTO", label: "Photo" },
];

interface RequestDocumentsModalProps {
  isPending: boolean;
  allowDetails: boolean;
  onConfirm: (
    scope: "DOCUMENTS" | "DETAILS",
    roles: VerificationDocumentRole[],
    message: string,
  ) => void;
  onClose: () => void;
}

function RequestDocumentsModal({
  isPending,
  allowDetails,
  onConfirm,
  onClose,
}: RequestDocumentsModalProps) {
  const [scope, setScope] = useState<"DOCUMENTS" | "DETAILS">("DOCUMENTS");
  const [roles, setRoles] = useState<VerificationDocumentRole[]>([]);
  const [message, setMessage] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  function toggleRole(role: VerificationDocumentRole) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
    setRoleError(null);
  }

  function handleConfirm() {
    if (scope === "DOCUMENTS" && roles.length === 0) {
      setRoleError("Select at least one document to request.");
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setMessageError("Describe what you need in at least 10 characters.");
      return;
    }
    setRoleError(null);
    setMessageError(null);
    onConfirm(scope, scope === "DOCUMENTS" ? roles : [], trimmed);
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
          Request from customer
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          Select what the customer needs to provide, and describe why. This
          message is shown to them on their account page.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <label
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <input
              type="radio"
              name="scope"
              value="DOCUMENTS"
              checked={scope === "DOCUMENTS"}
              onChange={() => setScope("DOCUMENTS")}
            />
            Additional documents
          </label>
          {allowDetails && (
            <label
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <input
                type="radio"
                name="scope"
                value="DETAILS"
                checked={scope === "DETAILS"}
                onChange={() => setScope("DETAILS")}
              />
              Declared details
            </label>
          )}
          {allowDetails && scope === "DETAILS" && (
            <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
              Lets the customer correct their declared ID number and address.
              They re-accept the declaration when they submit.
            </p>
          )}
        </div>
        {scope === "DOCUMENTS" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(option.value)}
                  onChange={() => toggleRole(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        )}
        {roleError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {roleError}
          </p>
        )}
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (e.target.value.trim().length >= 10) setMessageError(null);
          }}
          rows={4}
          placeholder="Describe what you need..."
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            fontSize: "var(--text-body)",
            color: "#0b0b0b",
            border: `1px solid ${messageError ? "#991b1b" : "var(--color-shop-divider)"}`,
            borderRadius: "0",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {messageError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {messageError}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              ...btnBase,
              backgroundColor: "#1e40af",
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
            Send request
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

export default function VerificationRequestActions({
  eventId,
  eventStatus,
  canRequest,
  allowDetails,
  openRequest,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (!canRequest) {
    return null;
  }

  function handleCreate(
    scope: "DOCUMENTS" | "DETAILS",
    roles: VerificationDocumentRole[],
    message: string,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await createVerificationDocumentRequestAction({
        eventId,
        scope,
        roles,
        message,
      });
      if (result.success) {
        toast.success(
          scope === "DOCUMENTS" ? "Documents requested." : "Details requested.",
        );
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleCancel() {
    if (!openRequest) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelVerificationDocumentRequestAction({
        requestId: openRequest.id,
      });
      if (result.success) {
        toast.success("Request cancelled.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const inactive = openRequest !== null && eventStatus !== "PENDING";
  const tone = inactive
    ? { bg: "#ffffff", border: "var(--color-shop-divider)", text: "#6b6b6b" }
    : { bg: "#fffbeb", border: "#fde68a", text: "#92400e" };

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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {openRequest ? (
        <div
          style={{
            backgroundColor: tone.bg,
            border: `1px solid ${tone.border}`,
            padding: "0.875rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: tone.text,
            }}
          >
            {inactive ? "Open request · inactive" : "Open request · awaiting customer"}
          </span>
          {inactive && (
            <p style={{ fontSize: "var(--text-body-sm)", color: tone.text }}>
              This review has been decided, so the customer no longer sees
              this request.
            </p>
          )}
          <p style={{ fontSize: "var(--text-body-sm)", color: tone.text }}>
            Requested:{" "}
            {openRequest.scope === "DETAILS"
              ? "Declared details (ID number and address)"
              : openRequest.roles
                  .map(
                    (role) =>
                      ROLE_OPTIONS.find((option) => option.value === role)
                        ?.label ?? role,
                  )
                  .join(", ")}
          </p>
          <blockquote
            style={{
              margin: 0,
              borderInlineStart: `3px solid ${tone.border}`,
              paddingInlineStart: "0.75rem",
              fontStyle: "italic",
              color: tone.text,
              whiteSpace: "pre-line",
            }}
          >
            {openRequest.message}
          </blockquote>
          <p style={{ fontSize: "var(--text-body-sm)", color: tone.text }}>
            Requested by {openRequest.requestedByName} ·{" "}
            {formatDateTime(openRequest.createdAt, "en")}
          </p>
          <div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleCancel}
              style={{
                ...btnBase,
                backgroundColor: "#991b1b",
                color: "#ffffff",
              }}
            >
              Cancel request
            </button>
          </div>
        </div>
      ) : eventStatus === "PENDING" ? (
        <div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setModalOpen(true)}
            style={{ ...btnBase, backgroundColor: "#1e40af", color: "#ffffff" }}
          >
            Request documents
          </button>
        </div>
      ) : (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          Not available — requests can only be sent while a review is
          pending.
        </p>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      {modalOpen && (
        <RequestDocumentsModal
          isPending={isPending}
          allowDetails={allowDetails}
          onConfirm={(scope, roles, message) => {
            setModalOpen(false);
            handleCreate(scope, roles, message);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
