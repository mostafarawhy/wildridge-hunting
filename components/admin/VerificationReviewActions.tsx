"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  approveVerificationAction,
  overrideApproveVerificationAction,
  rejectVerificationAction,
  expireVerificationAction,
} from "@/lib/actions/verification";

type VerificationStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

interface Props {
  eventId: string;
  eventStatus: VerificationStatus;
  accountStatus: VerificationStatus;
  canApprove: boolean;
  canOverride: boolean;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  customerName: string;
  hasOpenRequest: boolean;
}

interface ReasonModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmBg: string;
  reasonRequired?: boolean;
  isPending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function ReasonModal({
  title,
  description,
  confirmLabel,
  confirmBg,
  reasonRequired,
  isPending,
  onConfirm,
  onClose,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function handleConfirm() {
    if (reasonRequired !== false && !reason.trim()) {
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

interface ApproveAttestationModalProps {
  customerName: string;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ApproveAttestationModal({
  customerName,
  declaredIdNumber,
  declaredAddress,
  isPending,
  onConfirm,
  onClose,
}: ApproveAttestationModalProps) {
  const [idMatches, setIdMatches] = useState(false);
  const [addressMatches, setAddressMatches] = useState(false);
  const [nameMatches, setNameMatches] = useState(false);

  const allChecked = idMatches && addressMatches && nameMatches;

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
          maxWidth: "480px",
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
          Approve Verification
        </h2>

        <div
          style={{
            border: "1px solid var(--color-shop-divider)",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Customer", value: customerName, mono: false },
            {
              label: "Declared ID / Passport",
              value: declaredIdNumber ?? "—",
              mono: true,
            },
            {
              label: "Declared Address",
              value: declaredAddress ?? "—",
              mono: false,
            },
          ].map((row, idx, arr) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                padding: "0.625rem 0",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid var(--color-shop-divider)"
                    : "none",
              }}
            >
              <p style={labelStyle}>{row.label}</p>
              <p
                dir={row.mono ? "ltr" : undefined}
                style={{
                  ...valueStyle,
                  textAlign: "end",
                  ...(row.mono ? { fontFamily: "monospace" } : {}),
                }}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={idMatches}
              onChange={(e) => setIdMatches(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The ID document is clear and matches the declared number
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={addressMatches}
              onChange={(e) => setAddressMatches(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The proof-of-address matches the declared address
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={nameMatches}
              onChange={(e) => setNameMatches(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The name matches across all documents
          </label>
        </div>

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            lineHeight: "var(--leading-relaxed)",
            marginTop: "1rem",
          }}
        >
          I attest to the above. This approval is recorded against my name and
          the current time.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !allChecked}
            style={{
              ...btnBase,
              backgroundColor: "#166534",
              color: "#ffffff",
              cursor: isPending || !allChecked ? "not-allowed" : "pointer",
              opacity: isPending || !allChecked ? 0.5 : 1,
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
            Approve
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

interface OverrideApproveModalProps {
  customerName: string;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  isPending: boolean;
  onConfirm: (justification: string) => void;
  onClose: () => void;
}

function OverrideApproveModal({
  customerName,
  declaredIdNumber,
  declaredAddress,
  isPending,
  onConfirm,
  onClose,
}: OverrideApproveModalProps) {
  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState<
    string | null
  >(null);
  const [evidenceObtained, setEvidenceObtained] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);

  const allChecked =
    evidenceObtained && responsibilityAccepted && overrideAcknowledged;

  function handleConfirm() {
    const trimmed = justification.trim();
    if (trimmed.length < 20) {
      setJustificationError(
        "A justification of at least 20 characters is required.",
      );
      return;
    }
    setJustificationError(null);
    onConfirm(trimmed);
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
          maxWidth: "480px",
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
          Override Approve — Manual Compliance Decision
        </h2>

        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#92400e",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            This approves without a new customer submission. It is recorded
            as a manual override against your name, separately from
            document-backed approvals.
          </p>
        </div>

        <div
          style={{
            border: "1px solid var(--color-shop-divider)",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Customer", value: customerName, mono: false },
            {
              label: "Declared ID / Passport",
              value: declaredIdNumber ?? "—",
              mono: true,
            },
            {
              label: "Declared Address",
              value: declaredAddress ?? "—",
              mono: false,
            },
          ].map((row, idx, arr) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                padding: "0.625rem 0",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid var(--color-shop-divider)"
                    : "none",
              }}
            >
              <p style={labelStyle}>{row.label}</p>
              <p
                dir={row.mono ? "ltr" : undefined}
                style={{
                  ...valueStyle,
                  textAlign: "end",
                  ...(row.mono ? { fontFamily: "monospace" } : {}),
                }}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{ ...labelStyle, display: "block", marginBottom: "0.5rem" }}
          >
            Evidence obtained outside this system
          </label>
          <textarea
            value={justification}
            onChange={(e) => {
              setJustification(e.target.value);
              if (e.target.value.trim().length >= 20) {
                setJustificationError(null);
              }
            }}
            rows={4}
            placeholder="Describe what you verified, how, and when..."
            style={{
              width: "100%",
              padding: "0.625rem 0.75rem",
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              border: `1px solid ${justificationError ? "#991b1b" : "var(--color-shop-divider)"}`,
              borderRadius: "0",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {justificationError && (
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#991b1b",
                marginTop: "0.25rem",
              }}
            >
              {justificationError}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={evidenceObtained}
              onChange={(e) => setEvidenceObtained(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            I have obtained and reviewed current evidence outside this system
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={responsibilityAccepted}
              onChange={(e) => setResponsibilityAccepted(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            I take responsibility for approving without a new submission
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={overrideAcknowledged}
              onChange={(e) => setOverrideAcknowledged(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            I understand this is recorded as a manual override
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !allChecked}
            style={{
              ...btnBase,
              backgroundColor: "#7c2d12",
              color: "#ffffff",
              cursor: isPending || !allChecked ? "not-allowed" : "pointer",
              opacity: isPending || !allChecked ? 0.5 : 1,
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
            Override approve
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

export default function VerificationReviewActions({
  eventId,
  eventStatus,
  accountStatus,
  canApprove,
  canOverride,
  declaredIdNumber,
  declaredAddress,
  customerName,
  hasOpenRequest,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [expireOpen, setExpireOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  if (!canApprove) {
    return (
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Read-only — insufficient permissions to take action.
      </p>
    );
  }

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveVerificationAction({
        eventId,
        attestation: {
          idMatches: true,
          addressMatches: true,
          nameMatches: true,
        },
      });
      if (result.success) {
        toast.success("Verification approved.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleOverrideApprove(justification: string) {
    setError(null);
    startTransition(async () => {
      const result = await overrideApproveVerificationAction({
        eventId,
        justification,
        attestation: {
          evidenceObtained: true,
          responsibilityAccepted: true,
          overrideAcknowledged: true,
        },
      });
      if (result.success) {
        toast.success("Approved by override.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleReject(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await rejectVerificationAction({ eventId, reason });
      if (result.success) {
        toast.success("Verification rejected.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleExpire(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await expireVerificationAction({
        eventId,
        reason,
      });
      if (result.success) {
        toast.success("Verification expired.");
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
      {eventStatus === "PENDING" && hasOpenRequest && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            padding: "0.875rem 1rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#78350f",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            An open document request is pending with the customer. Approving
            or rejecting now will not cancel it, but the customer will stop
            seeing it once the review is decided.
          </p>
        </div>
      )}

      {eventStatus === "PENDING" ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setApproveOpen(true)}
            style={{ ...btnBase, backgroundColor: "#166534", color: "#ffffff" }}
          >
            Approve
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => setRejectOpen(true)}
            style={{ ...btnBase, backgroundColor: "#991b1b", color: "#ffffff" }}
          >
            Reject
          </button>
        </div>
      ) : accountStatus === "APPROVED" ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setExpireOpen(true)}
            style={{ ...btnBase, backgroundColor: "#b45309", color: "#ffffff" }}
          >
            Force-expire
          </button>
        </div>
      ) : accountStatus === "EXPIRED" ? (
        <>
          {canOverride && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setOverrideOpen(true)}
                style={{
                  ...btnBase,
                  backgroundColor: "#7c2d12",
                  color: "#ffffff",
                }}
              >
                Override approve
              </button>
            </div>
          )}
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            Expired. The customer must submit new documents to re-verify.
          </p>
        </>
      ) : (
        <>
          {canOverride && accountStatus === "REJECTED" && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setOverrideOpen(true)}
                style={{
                  ...btnBase,
                  backgroundColor: "#7c2d12",
                  color: "#ffffff",
                }}
              >
                Override approve
              </button>
            </div>
          )}
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            No lifecycle actions available while the account status is{" "}
            {accountStatus}.
          </p>
        </>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      {approveOpen && (
        <ApproveAttestationModal
          customerName={customerName}
          declaredIdNumber={declaredIdNumber}
          declaredAddress={declaredAddress}
          isPending={isPending}
          onConfirm={() => {
            setApproveOpen(false);
            handleApprove();
          }}
          onClose={() => setApproveOpen(false)}
        />
      )}

      {overrideOpen && (
        <OverrideApproveModal
          customerName={customerName}
          declaredIdNumber={declaredIdNumber}
          declaredAddress={declaredAddress}
          isPending={isPending}
          onConfirm={(justification) => {
            setOverrideOpen(false);
            handleOverrideApprove(justification);
          }}
          onClose={() => setOverrideOpen(false)}
        />
      )}

      {rejectOpen && (
        <ReasonModal
          title="Reject Verification"
          description="Provide a reason for rejection. It is recorded on the verification event AND shown to the customer on their account page and in the rejection email. Write it for them."
          confirmLabel="Confirm Rejection"
          confirmBg="#991b1b"
          isPending={isPending}
          onConfirm={(reason) => {
            setRejectOpen(false);
            handleReject(reason);
          }}
          onClose={() => setRejectOpen(false)}
        />
      )}

      {expireOpen && (
        <ReasonModal
          title="Force-expire Verification"
          description="This immediately expires the customer's verified status. They will need to re-verify before purchasing restricted items. Provide a reason — it is recorded on the audit log."
          confirmLabel="Force-expire"
          confirmBg="#b45309"
          isPending={isPending}
          onConfirm={(reason) => {
            setExpireOpen(false);
            handleExpire(reason);
          }}
          onClose={() => setExpireOpen(false)}
        />
      )}
    </div>
  );
}
