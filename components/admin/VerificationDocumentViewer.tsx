"use client";

import { useCallback } from "react";
import DocumentManifest, { type MintDocumentUrl } from "@/components/admin/DocumentManifest";
import DocumentsByKind from "@/components/admin/DocumentsByKind";
import { mintVerificationDocumentUrl } from "@/lib/actions/admin-documents";
import { VERIFICATION_ROLE_LABELS } from "@/lib/utils/document-labels";

interface DeclaredField {
  label: string;
  value: string;
}

interface DocRow {
  id: string;
  role: string;
  type: string;
  filename: string;
  mimeType: string;
  declaredFields: DeclaredField[];
  supersededAt: string | null;
  uploadedAt: string;
  requestId: string | null;
}

interface FulfilledRequest {
  id: string;
  requestedByName: string;
  fulfilledAt: string;
}

interface Props {
  documents: DocRow[];
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  reviewedAt: string | null;
  subjectName: string;
  eventId: string;
  fulfilledRequests: FulfilledRequest[];
}

export default function VerificationDocumentViewer({
  documents,
  provider,
  reviewedAt,
  subjectName,
  eventId,
  fulfilledRequests,
}: Props) {
  const mintUrl = useCallback<MintDocumentUrl>(
    (documentId, variant) => mintVerificationDocumentUrl(eventId, documentId, variant),
    [eventId],
  );

  if (documents.length === 0) {
    return (
      <DocumentManifest
        subjectName={subjectName}
        emptyMessage={
          provider === "UAE_PASS"
            ? "Identity verified via UAE PASS. No documents were uploaded — UAE PASS asserts the customer's identity directly."
            : "No documents on file."
        }
        documents={[]}
        mintUrl={mintUrl}
      />
    );
  }

  return (
    <DocumentsByKind
      documents={documents.map((doc) => ({
        kind: doc.role,
        supersededAt: doc.supersededAt,
        uploadedAt: doc.uploadedAt,
        requestId: doc.requestId,
        manifest: {
          id: doc.id,
          label: VERIFICATION_ROLE_LABELS[doc.role] ?? doc.role,
          filename: doc.filename,
          mimeType: doc.mimeType,
          declaredFields: doc.declaredFields,
        },
      }))}
      kindOrder={Object.keys(VERIFICATION_ROLE_LABELS)}
      fulfilledRequests={fulfilledRequests}
      reviewedAt={reviewedAt}
      subjectName={subjectName}
      mintUrl={mintUrl}
    />
  );
}
