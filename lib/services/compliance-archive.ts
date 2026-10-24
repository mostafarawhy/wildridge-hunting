import "server-only";

import { db } from "@/lib/db/client";
import { downloadFile, uploadFile } from "@/lib/services/storage";
import type { ComplianceSnapshot } from "@/types/order";

const VERIFICATION_BUCKET = "verification-docs";
const B2B_BUCKET = "b2b-documents";
const ARCHIVE_BUCKET = "payment-proofs";

export interface ComplianceDocumentRow {
  source: "VERIFICATION" | "B2B";
  documentKind: string;
  documentType: string | null;
  filename: string;
  mimeType: string | null;
  declaredNumber: string | null;
  sourceKey: string;
}

export function complianceDocumentRowsFromSnapshot(
  snapshot: ComplianceSnapshot,
): ComplianceDocumentRow[] {
  const rows: ComplianceDocumentRow[] = [];

  for (const d of snapshot.verification?.documents ?? []) {
    rows.push({
      source: "VERIFICATION",
      documentKind: d.role,
      documentType: d.type,
      filename: d.filename,
      mimeType: d.mimeType,
      declaredNumber: null,
      sourceKey: d.storageKey,
    });
  }

  for (const d of snapshot.b2b?.documents ?? []) {
    rows.push({
      source: "B2B",
      documentKind: d.type,
      documentType: null,
      filename: d.filename,
      mimeType: d.mimeType,
      declaredNumber: d.declaredNumber,
      sourceKey: d.storageKey,
    });
  }

  return rows;
}

function archiveExtension(mimeType: string | null, filename: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "application/pdf") return "pdf";
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "bin";
}

export interface ArchiveResult {
  archived: number;
  failed: number;
  pending: number;
}

export async function archiveOrderComplianceDocuments(
  orderId: string,
): Promise<ArchiveResult> {
  const result: ArchiveResult = { archived: 0, failed: 0, pending: 0 };

  try {
    const rows = await db.orderComplianceDocument.findMany({
      where: { orderId, archiveKey: null },
      select: {
        id: true,
        source: true,
        filename: true,
        mimeType: true,
        sourceKey: true,
      },
    });
    result.pending = rows.length;

    for (const row of rows) {
      try {
        const bucket =
          row.source === "VERIFICATION" ? VERIFICATION_BUCKET : B2B_BUCKET;
        const blob = await downloadFile(bucket, row.sourceKey);
        const ext = archiveExtension(row.mimeType, row.filename);
        const archiveKey = `compliance/${orderId}/${row.id}.${ext}`;
        const contentType =
          row.mimeType ?? blob.type ?? "application/octet-stream";

        await uploadFile({
          bucket: ARCHIVE_BUCKET,
          path: archiveKey,
          file: blob,
          contentType,
          trusted: true,
        });

        await db.orderComplianceDocument.updateMany({
          where: { id: row.id, archiveKey: null },
          data: { archiveKey, archivedAt: new Date() },
        });

        result.archived += 1;
      } catch (err) {
        result.failed += 1;
        console.error(
          "[archiveOrderComplianceDocuments]",
          orderId,
          row.id,
          err,
        );
      }
    }
  } catch (err) {
    console.error("[archiveOrderComplianceDocuments]", orderId, err);
  }

  return result;
}
