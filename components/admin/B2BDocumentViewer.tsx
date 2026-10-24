"use client";

import { useCallback } from "react";
import { type MintDocumentUrl } from "@/components/admin/DocumentManifest";
import DocumentsByKind from "@/components/admin/DocumentsByKind";
import { mintB2BDocumentUrl } from "@/lib/actions/admin-documents";
import type { DocumentType } from "@/lib/db/queries/b2b";
import { B2B_DOCUMENT_TYPE_LABELS } from "@/lib/utils/document-labels";

interface DeclaredField {
  label: string;
  value: string;
}

interface DocumentRow {
  id: string;
  type: DocumentType;
  filename: string;
  mimeType: string | null;
  label: string | null;
  supersededAt: string | null;
  uploadedAt: string;
  requestId: string | null;
  declaredFields: DeclaredField[];
}

interface FulfilledRequest {
  id: string;
  requestedByName: string;
  fulfilledAt: string;
}

interface Props {
  documents: DocumentRow[];
  reviewedAt: string | null;
  subjectName: string;
  fulfilledRequests: FulfilledRequest[];
  accountId: string;
}

export default function B2BDocumentViewer({
  documents,
  reviewedAt,
  subjectName,
  fulfilledRequests,
  accountId,
}: Props) {
  const mintUrl = useCallback<MintDocumentUrl>(
    (documentId, variant) => mintB2BDocumentUrl(accountId, documentId, variant),
    [accountId],
  );

  return (
    <DocumentsByKind
      documents={documents.map((doc) => ({
        kind: doc.type,
        supersededAt: doc.supersededAt,
        uploadedAt: doc.uploadedAt,
        requestId: doc.requestId,
        manifest: {
          id: doc.id,
          label:
            doc.type === "OTHER"
              ? (doc.label ?? "Other")
              : (B2B_DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type),
          filename: doc.filename,
          mimeType: doc.mimeType,
          declaredFields: doc.declaredFields,
        },
      }))}
      kindOrder={Object.keys(B2B_DOCUMENT_TYPE_LABELS)}
      fulfilledRequests={fulfilledRequests}
      reviewedAt={reviewedAt}
      subjectName={subjectName}
      mintUrl={mintUrl}
    />
  );
}
