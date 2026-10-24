"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  approveB2BAccountAction,
  overrideApproveB2BAccountAction,
  rejectB2BAccountAction,
  suspendB2BAccountAction,
  expireB2BAccountAction,
} from "@/lib/actions/b2b";
import type { B2BDerivedStatus } from "@/lib/db/queries/b2b";

interface Props {
  accountId: string;
  derivedStatus: B2BDerivedStatus;
  canApprove: boolean;
  canOverride: boolean;
  companyNameEn: string;
  tradeLicenseNo: string;
  contactName: string | null;
  hasOpenRequest: boolean;
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

interface B2BApproveAttestationModalProps {
  companyNameEn: string;
  tradeLicenseNo: string;
  contactName: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function B2BApproveAttestationModal({
  companyNameEn,
  tradeLicenseNo,
  contactName,
  isPending,
  onConfirm,
  onClose,
}: B2BApproveAttestationModalProps) {
  const [licenseMatches, setLicenseMatches] = useState(false);
  const [companyMatches, setCompanyMatches] = useState(false);
  const [documentsAuthentic, setDocumentsAuthentic] = useState(false);

  const allChecked = licenseMatches && companyMatches && documentsAuthentic;

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
          Approve B2B Account
        </h2>

        <div
          style={{
            border: "1px solid var(--color-shop-divider)",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Company", value: companyNameEn, mono: false },
            {
              label: "Trade License No.",
              value: tradeLicenseNo,
              mono: true,
            },
            {
              label: "Contact",
              value: contactName ?? "—",
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
              checked={licenseMatches}
              onChange={(e) => setLicenseMatches(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The trade license is valid and matches the declared number
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
              checked={companyMatches}
              onChange={(e) => setCompanyMatches(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The company name matches across all documents
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
              checked={documentsAuthentic}
              onChange={(e) => setDocumentsAuthentic(e.target.checked)}
              style={{ marginTop: "0.1875rem" }}
            />
            The submitted documents are legible and authentic
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

interface B2BOverrideApproveModalProps {
  companyNameEn: string;
  tradeLicenseNo: string;
  contactName: string | null;
  isPending: boolean;
  onConfirm: (justification: string) => void;
  onClose: () => void;
}

function B2BOverrideApproveModal({
  companyNameEn,
  tradeLicenseNo,
  contactName,
  isPending,
  onConfirm,
  onClose,
}: B2BOverrideApproveModalProps) {
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
            { label: "Company", value: companyNameEn, mono: false },
            {
              label: "Trade License No.",
              value: tradeLicenseNo,
              mono: true,
            },
            {
              label: "Contact",
              value: contactName ?? "—",
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

export default function B2BReviewActions({
  accountId,
  derivedStatus,
  canApprove,
  canOverride,
  companyNameEn,
  tradeLicenseNo,
  contactName,
  hasOpenRequest,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reasonModal, setReasonModal] = useState<
    "REJECT" | "SUSPEND" | "EXPIRE" | null
  >(null);

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
      const result = await approveB2BAccountAction({
        accountId,
        attestation: {
          licenseMatches: true,
          companyMatches: true,
          documentsAuthentic: true,
        },
      });
      if (result.success) {
        toast.success("Account approved.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleOverrideApprove(justification: string) {
    setError(null);
    startTransition(async () => {
      const result = await overrideApproveB2BAccountAction({
        accountId,
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
      const result = await rejectB2BAccountAction({ accountId, reason });
      if (result.success) {
        toast.success("Account rejected.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleSuspend(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await suspendB2BAccountAction({ accountId, reason });
      if (result.success) {
        toast.success("Account suspended.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleExpire(reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await expireB2BAccountAction({ accountId, reason });
      if (result.success) {
        toast.success("Account expired.");
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
      {derivedStatus === "PENDING" && hasOpenRequest && (
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
            An open document request is pending on this account. Approving now will
            not close it, and the customer will still be asked to upload.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {(derivedStatus === "PENDING" || derivedStatus === "SUSPENDED") && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setApproveOpen(true)}
            style={{ ...btnBase, backgroundColor: "#166534", color: "#ffffff" }}
          >
            Approve
          </button>
        )}

        {derivedStatus === "PENDING" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setReasonModal("REJECT")}
            style={{ ...btnBase, backgroundColor: "#991b1b", color: "#ffffff" }}
          >
            Reject
          </button>
        )}

        {(derivedStatus === "APPROVED" || derivedStatus === "EXPIRED") && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setReasonModal("SUSPEND")}
            style={{ ...btnBase, backgroundColor: "#374151", color: "#ffffff" }}
          >
            Suspend
          </button>
        )}

        {derivedStatus === "APPROVED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setReasonModal("EXPIRE")}
            style={{ ...btnBase, backgroundColor: "#b45309", color: "#ffffff" }}
          >
            Force-expire
          </button>
        )}

        {canOverride &&
          (derivedStatus === "EXPIRED" || derivedStatus === "REJECTED") && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setOverrideOpen(true)}
              style={{ ...btnBase, backgroundColor: "#7c2d12", color: "#ffffff" }}
            >
              Override approve
            </button>
          )}
      </div>

      {derivedStatus === "EXPIRED" && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          Expired. The customer must submit a new application to regain trade
          access.
        </p>
      )}

      {derivedStatus === "REJECTED" && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          Rejected. The customer may submit a new application.
        </p>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
        </p>
      )}

      {approveOpen && (
        <B2BApproveAttestationModal
          companyNameEn={companyNameEn}
          tradeLicenseNo={tradeLicenseNo}
          contactName={contactName}
          isPending={isPending}
          onConfirm={() => {
            setApproveOpen(false);
            handleApprove();
          }}
          onClose={() => setApproveOpen(false)}
        />
      )}

      {overrideOpen && (
        <B2BOverrideApproveModal
          companyNameEn={companyNameEn}
          tradeLicenseNo={tradeLicenseNo}
          contactName={contactName}
          isPending={isPending}
          onConfirm={(justification) => {
            setOverrideOpen(false);
            handleOverrideApprove(justification);
          }}
          onClose={() => setOverrideOpen(false)}
        />
      )}

      {reasonModal === "REJECT" && (
        <ReasonModal
          title="Reject Application"
          description="Provide a reason for rejection. This will be included in the applicant notification email."
          confirmLabel="Confirm Rejection"
          confirmBg="#991b1b"
          isPending={isPending}
          onConfirm={(reason) => {
            setReasonModal(null);
            handleReject(reason);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}

      {reasonModal === "SUSPEND" && (
        <ReasonModal
          title="Suspend B2B Account"
          description="Provide a reason for suspension. This will revoke B2B access and downgrade the customer to B2C. Their active session will be invalidated."
          confirmLabel="Confirm Suspension"
          confirmBg="#374151"
          isPending={isPending}
          onConfirm={(reason) => {
            setReasonModal(null);
            handleSuspend(reason);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}

      {reasonModal === "EXPIRE" && (
        <ReasonModal
          title="Force-expire B2B Account"
          description="Provide a reason for expiry. The account status stays Approved but purchasing will be gated until the customer renews. A reason is required and recorded on the audit log."
          confirmLabel="Force-expire"
          confirmBg="#b45309"
          isPending={isPending}
          onConfirm={(reason) => {
            setReasonModal(null);
            handleExpire(reason);
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  );
}
