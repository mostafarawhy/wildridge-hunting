"use client";

import { useState } from "react";
import DocumentManifest, {
  type ManifestDoc,
  type MintDocumentUrl,
} from "@/components/admin/DocumentManifest";
import { formatDisplayDate } from "@/lib/utils/date";

export interface KindDoc {
  kind: string;
  supersededAt: string | null;
  uploadedAt: string;
  requestId: string | null;
  manifest: ManifestDoc;
}

interface Props {
  documents: KindDoc[];
  kindOrder: string[];
  fulfilledRequests: { id: string; fulfilledAt: string }[];
  reviewedAt: string | null;
  subjectName: string;
  mintUrl: MintDocumentUrl;
}

const earlierSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.75rem 1.25rem",
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  cursor: "pointer",
  listStyle: "none",
  WebkitAppearance: "none",
};

function Chevron() {
  return (
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
  );
}

function sourceBadge(
  doc: KindDoc,
  requestFulfilledAt: Map<string, string>,
  reviewedAt: string | null,
): NonNullable<ManifestDoc["badge"]> {
  if (doc.requestId !== null) {
    const providedAt = requestFulfilledAt.get(doc.requestId) ?? doc.uploadedAt;
    const isNew = reviewedAt === null || doc.uploadedAt > reviewedAt;
    return {
      text: `${isNew ? "New · " : ""}On request ${formatDisplayDate(providedAt, "en")}`,
      emphasis: isNew,
    };
  }
  return {
    text: `Original · ${formatDisplayDate(doc.uploadedAt, "en")}`,
    emphasis: false,
  };
}

function EarlierVersions({
  docs,
  subjectName,
  mintUrl,
}: {
  docs: KindDoc[];
  subjectName: string;
  mintUrl: MintDocumentUrl;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const count =
    docs.length === 1 ? "1 earlier version" : `${docs.length} earlier versions`;

  return (
    <details open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary style={earlierSummaryStyle}>
        <Chevron />
        {count} of {docs[0].manifest.label} · replaced{" "}
        {formatDisplayDate(docs[0].supersededAt ?? docs[0].uploadedAt, "en")}
      </summary>
      {isOpen && (
        <DocumentManifest
          subjectName={subjectName}
          documents={docs.map((doc) => ({
            ...doc.manifest,
            badge: {
              text: `Replaced ${formatDisplayDate(doc.supersededAt ?? doc.uploadedAt, "en")}`,
              emphasis: false,
            },
          }))}
          showHeader={false}
          mintUrl={mintUrl}
        />
      )}
    </details>
  );
}

export default function DocumentsByKind({
  documents,
  kindOrder,
  fulfilledRequests,
  reviewedAt,
  subjectName,
  mintUrl,
}: Props) {
  const requestFulfilledAt = new Map(
    fulfilledRequests.map((request) => [request.id, request.fulfilledAt]),
  );
  const present = new Set(documents.map((doc) => doc.kind));
  const kinds = [
    ...kindOrder.filter((kind) => present.has(kind)),
    ...Array.from(present).filter((kind) => !kindOrder.includes(kind)),
  ];

  return (
    <>
      {kinds.map((kind, index) => {
        const current = documents.filter(
          (doc) => doc.kind === kind && doc.supersededAt === null,
        );
        const earlier = documents
          .filter((doc) => doc.kind === kind && doc.supersededAt !== null)
          .sort((a, b) =>
            (a.supersededAt ?? "") < (b.supersededAt ?? "") ? 1 : -1,
          );
        return (
          <div
            key={kind}
            style={{
              borderTop:
                index === 0 ? "none" : "1px solid var(--color-shop-divider)",
            }}
          >
            {current.length > 0 && (
              <DocumentManifest
                subjectName={subjectName}
                documents={current.map((doc) => ({
                  ...doc.manifest,
                  badge: sourceBadge(doc, requestFulfilledAt, reviewedAt),
                }))}
                showHeader={false}
                mintUrl={mintUrl}
              />
            )}
            {earlier.length > 0 && (
              <EarlierVersions
                docs={earlier}
                subjectName={subjectName}
                mintUrl={mintUrl}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
