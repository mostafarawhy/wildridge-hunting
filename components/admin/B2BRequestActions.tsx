"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  createB2BDocumentRequestAction,
  cancelB2BDocumentRequestAction,
} from "@/lib/actions/document-request";
import { formatDateTime } from "@/lib/utils/date";
import type { B2BDerivedStatus } from "@/lib/db/queries/b2b";
import { REQUESTABLE_B2B_DOCUMENT_TYPES } from "@/lib/validations/b2b";
import { B2B_DOCUMENT_TYPE_LABELS } from "@/lib/utils/document-labels";
import type { DocumentType } from "@/app/generated/prisma/enums";

type RequestableB2BDocumentType =
  (typeof REQUESTABLE_B2B_DOCUMENT_TYPES)[number];

interface OpenRequest {
  id: string;
  scope: "DOCUMENTS" | "DETAILS";
  types: DocumentType[];
  message: string;
  requestedByName: string;
  createdAt: string;
}

interface Props {
  accountId: string;
  derivedStatus: B2BDerivedStatus;
  canRequest: boolean;
  openRequest: OpenRequest | null;
}

interface RequestDocumentsModalProps {
  isPending: boolean;
  allowDetails: boolean;
  onConfirm: (
    scope: "DOCUMENTS" | "DETAILS",
    message: string,
    types: RequestableB2BDocumentType[],
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
  const [types, setTypes] = useState<RequestableB2BDocumentType[]>([]);
  const [message, setMessage] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  function toggleType(type: RequestableB2BDocumentType) {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
    setTypeError(null);
  }

  function handleConfirm() {
    if (scope === "DOCUMENTS" && types.length === 0) {
      setTypeError("Select at least one document to request.");
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setMessageError("Describe what you need in at least 10 characters.");
      return;
    }
    setTypeError(null);
    setMessageError(null);
    onConfirm(scope, trimmed, scope === "DOCUMENTS" ? types : []);
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
          Describe what the customer needs to provide. This message is shown to
          them on their account page.
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
              Business details
            </label>
          )}
          {allowDetails && scope === "DETAILS" && (
            <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
              Lets the customer edit their company info and trade licence
              number. Returns the account to review when they submit.
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
            {REQUESTABLE_B2B_DOCUMENT_TYPES.map((type) => (
              <label
                key={type}
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
                  checked={types.includes(type)}
                  onChange={() => toggleType(type)}
                />
                {B2B_DOCUMENT_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        )}
        {typeError && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "0.25rem",
            }}
          >
            {typeError}
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
            style={{ ...btnBase, backgroundColor: "#1e40af", color: "#ffffff" }}
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

export default function B2BRequestActions({
  accountId,
  derivedStatus,
  canRequest,
  openRequest,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (!canRequest) {
    return (
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Read-only — insufficient permissions to take action.
      </p>
    );
  }

  function handleCreate(
    scope: "DOCUMENTS" | "DETAILS",
    message: string,
    types: RequestableB2BDocumentType[],
  ) {
    setError(null);
    startTransition(async () => {
      const result = await createB2BDocumentRequestAction({
        scope,
        accountId,
        message,
        types,
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
      const result = await cancelB2BDocumentRequestAction({
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
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
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
              color: "#92400e",
            }}
          >
            Open request · awaiting customer
          </span>
          <p style={{ fontSize: "var(--text-body-sm)", color: "#92400e" }}>
            Scope:{" "}
            {openRequest.scope === "DETAILS"
              ? "Business details"
              : "Additional documents"}
          </p>
          {openRequest.types.length > 0 && (
            <p style={{ fontSize: "var(--text-body-sm)", color: "#92400e" }}>
              Requested:{" "}
              {openRequest.types
                .map((type) => B2B_DOCUMENT_TYPE_LABELS[type])
                .join(", ")}
            </p>
          )}
          <blockquote
            style={{
              margin: 0,
              borderInlineStart: "3px solid #fde68a",
              paddingInlineStart: "0.75rem",
              fontStyle: "italic",
              color: "#92400e",
              whiteSpace: "pre-line",
            }}
          >
            {openRequest.message}
          </blockquote>
          <p style={{ fontSize: "var(--text-body-sm)", color: "#92400e" }}>
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
      ) : derivedStatus === "PENDING" ||
        derivedStatus === "APPROVED" ||
        derivedStatus === "SUSPENDED" ? (
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
          Not available — the customer already has a self-service path for this
          status.
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
          allowDetails={
            derivedStatus === "PENDING" || derivedStatus === "APPROVED"
          }
          onConfirm={(scope, message, types) => {
            setModalOpen(false);
            handleCreate(scope, message, types);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
