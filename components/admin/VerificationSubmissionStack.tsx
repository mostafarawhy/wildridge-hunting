"use client";

import { useState } from "react";
import Link from "next/link";
import VerificationDocumentViewer from "@/components/admin/VerificationDocumentViewer";
import { formatDisplayDate } from "@/lib/utils/date";

type SubmissionStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export interface StackSubmission {
  id: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: SubmissionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  documents: {
    id: string;
    role: string;
    type: string;
    filename: string;
    mimeType: string;
    declaredFields: { label: string; value: string }[];
    supersededAt: string | null;
    uploadedAt: string;
    requestId: string | null;
  }[];
  fulfilledRequests: { id: string; requestedByName: string; fulfilledAt: string }[];
}

interface Props {
  submissions: StackSubmission[];
  viewedEventId: string;
  subjectName: string;
}

const STATUS_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#166534" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
  NOT_REQUIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const PROVIDER_LABELS: Record<string, string> = {
  SUMSUB: "Automated check",
  UAE_PASS: "UAE PASS",
  MANUAL_REVIEW: "Manual Review",
};

const summaryStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  padding: "1rem 1.25rem",
  cursor: "pointer",
  listStyle: "none",
  WebkitAppearance: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const metaStyle: React.CSSProperties = {
  display: "block",
  marginTop: "0.25rem",
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  paddingInline: "0.625rem",
  paddingBlock: "0.25rem",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  borderRadius: "0",
};

function fileCountLabel(n: number): string {
  if (n === 0) return "No documents";
  return n === 1 ? "1 file" : `${n} files`;
}

function SubmissionGroup({
  submission,
  number,
  isViewed,
  isFirst,
  subjectName,
}: {
  submission: StackSubmission;
  number: number;
  isViewed: boolean;
  isFirst: boolean;
  subjectName: string;
}) {
  const [isOpen, setIsOpen] = useState(isViewed);
  const decided = submission.reviewedByName
    ? ` · Decided by ${submission.reviewedByName}${
        submission.reviewedAt
          ? `, ${formatDisplayDate(submission.reviewedAt, "en")}`
          : ""
      }`
    : "";

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
      style={{
        borderTop: isFirst ? "none" : "1px solid var(--color-shop-divider)",
      }}
    >
      <summary style={summaryStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          <svg
            className="disclosure-chevron"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
              <span style={labelStyle}>
                Submission {number}
                {isViewed ? " · This submission" : ""}
              </span>
              <span style={{ ...pillStyle, ...(STATUS_STYLES[submission.status] ?? {}) }}>
                {submission.status}
              </span>
            </span>
            <span style={metaStyle}>
              {formatDisplayDate(submission.createdAt, "en")} ·{" "}
              {PROVIDER_LABELS[submission.provider] ?? submission.provider}
              {decided} · {fileCountLabel(submission.documents.length)}
            </span>
          </span>
        </span>
        {!isViewed && (
          <Link
            href={`/admin/verification/${submission.id}`}
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-action-primary)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Open →
          </Link>
        )}
      </summary>
      {isOpen && (
        <div style={{ borderTop: "1px solid var(--color-shop-divider)" }}>
          <VerificationDocumentViewer
            documents={submission.documents}
            provider={submission.provider}
            reviewedAt={submission.reviewedAt}
            subjectName={subjectName}
            eventId={submission.id}
            fulfilledRequests={submission.fulfilledRequests}
          />
        </div>
      )}
    </details>
  );
}

export default function VerificationSubmissionStack({
  submissions,
  viewedEventId,
  subjectName,
}: Props) {
  return (
    <>
      {submissions.map((submission, index) => (
        <SubmissionGroup
          key={submission.id}
          submission={submission}
          number={submissions.length - index}
          isViewed={submission.id === viewedEventId}
          isFirst={index === 0}
          subjectName={subjectName}
        />
      ))}
    </>
  );
}
