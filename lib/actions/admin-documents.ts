"use server";

import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { getB2BDocumentForMint } from "@/lib/db/queries/b2b";
import { getOrderPaymentForMint } from "@/lib/db/queries/order";
import { getVerificationDocumentForMint } from "@/lib/db/queries/verification";
import { createSignedUrl } from "@/lib/services/storage";
import { can } from "@/lib/utils/staff-permissions";

const B2B_BUCKET = "b2b-documents";
const VERIFICATION_BUCKET = "verification-docs";
const PAYMENT_PROOFS_BUCKET = "payment-proofs";
const TTL_SECONDS = 300;

export type MintDocumentUrlErrorCode = "DOCUMENT_NOT_FOUND" | "URL_MINT_FAILED";

export type MintDocumentUrlResult =
  | { success: true; data: { url: string } }
  | { success: false; error: string; errorCode: MintDocumentUrlErrorCode };

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "document";
}

function extFromFilename(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "bin";
}

function extFromMime(m: string): string {
  return m === "image/png"
    ? "png"
    : m === "image/jpeg"
      ? "jpg"
      : m === "application/pdf"
        ? "pdf"
        : "bin";
}

export async function mintB2BDocumentUrl(
  accountId: string,
  documentId: string,
  variant: "preview" | "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId } = await requireStaffAction("b2b:read");

  if (variant !== "preview" && variant !== "view" && variant !== "download") {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  const doc = await getB2BDocumentForMint(accountId, documentId);
  if (!doc) {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(B2B_BUCKET, doc.storageKey, TTL_SECONDS, {
            download: `${sanitize(doc.companyNameEn)}_${doc.type}_${accountId}.${extFromFilename(doc.filename)}`,
          })
        : await createSignedUrl(B2B_BUCKET, doc.storageKey, TTL_SECONDS);

    if (variant !== "preview") {
      await db.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staffId,
          action: "b2b.document_accessed",
          entityType: "B2BAccount",
          entityId: accountId,
          metadata: {
            documentId,
            type: doc.type,
            filename: doc.filename,
            variant,
          },
        },
      });
    }

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

export async function mintPaymentProofUrl(
  orderId: string,
  paymentId: string,
  variant: "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId } = await requireStaffAction("order:mark_paid");

  if (variant !== "view" && variant !== "download") {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  const doc = await getOrderPaymentForMint(orderId, paymentId);
  if (!doc) {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(PAYMENT_PROOFS_BUCKET, doc.storageKey, TTL_SECONDS, {
            download: `${sanitize(doc.orderNumber)}_payment_proof_${paymentId}.${extFromFilename(doc.filename)}`,
          })
        : await createSignedUrl(PAYMENT_PROOFS_BUCKET, doc.storageKey, TTL_SECONDS);

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "order.payment_proof_accessed",
        entityType: "Order",
        entityId: orderId,
        metadata: { paymentId, filename: doc.filename, variant },
      },
    });

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

export async function mintRefundProofUrl(
  orderId: string,
  refundId: string,
  variant: "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId } = await requireStaffAction("order:mark_paid");

  if (variant !== "view" && variant !== "download") {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  const doc = await db.orderRefund.findFirst({
    where: { id: refundId, orderId },
    select: {
      storageKey: true,
      filename: true,
      order: { select: { orderNumber: true } },
    },
  });
  if (!doc) {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(PAYMENT_PROOFS_BUCKET, doc.storageKey, TTL_SECONDS, {
            download: `${sanitize(doc.order.orderNumber)}_refund_proof_${refundId}.${extFromFilename(doc.filename)}`,
          })
        : await createSignedUrl(PAYMENT_PROOFS_BUCKET, doc.storageKey, TTL_SECONDS);

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "order.refund_proof_accessed",
        entityType: "Order",
        entityId: orderId,
        metadata: { refundId, filename: doc.filename, variant },
      },
    });

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

export async function mintOrderComplianceDocumentUrl(
  orderId: string,
  documentId: string,
  variant: "preview" | "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId, staffRole } = await requireStaffAction("order:read");

  const notFound: MintDocumentUrlResult = {
    success: false,
    error: "Document not found.",
    errorCode: "DOCUMENT_NOT_FOUND",
  };

  if (variant !== "preview" && variant !== "view" && variant !== "download") {
    return notFound;
  }

  const doc = await db.orderComplianceDocument.findFirst({
    where: { id: documentId, orderId },
    select: {
      id: true,
      source: true,
      documentKind: true,
      filename: true,
      mimeType: true,
      sourceKey: true,
      archiveKey: true,
      order: { select: { orderNumber: true } },
    },
  });
  if (!doc) return notFound;

  if (doc.source === "VERIFICATION" && !can(staffRole, "verification:review")) {
    return notFound;
  }
  if (doc.source === "B2B" && !can(staffRole, "b2b:read")) {
    return notFound;
  }

  const archived = doc.archiveKey !== null;
  const bucket = archived
    ? PAYMENT_PROOFS_BUCKET
    : doc.source === "VERIFICATION"
      ? VERIFICATION_BUCKET
      : B2B_BUCKET;
  const key = archived ? doc.archiveKey! : doc.sourceKey;

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(bucket, key, TTL_SECONDS, {
            download: `${sanitize(doc.order.orderNumber)}_${sanitize(doc.documentKind)}_${doc.id}.${doc.mimeType ? extFromMime(doc.mimeType) : extFromFilename(doc.filename)}`,
          })
        : await createSignedUrl(bucket, key, TTL_SECONDS);

    if (variant !== "preview") {
      await db.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staffId,
          action: "order.compliance_document_accessed",
          entityType: "Order",
          entityId: orderId,
          metadata: {
            documentId: doc.id,
            source: doc.source,
            kind: doc.documentKind,
            filename: doc.filename,
            variant,
            archived,
          },
        },
      });
    }

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

export async function mintDeliveryProofUrl(
  orderId: string,
  variant: "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId } = await requireStaffAction("order:read");

  if (variant !== "view" && variant !== "download") {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      deliveryProofKey: true,
      deliveryProofFilename: true,
    },
  });
  if (!order || !order.deliveryProofKey || !order.deliveryProofFilename) {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(
            PAYMENT_PROOFS_BUCKET,
            order.deliveryProofKey,
            TTL_SECONDS,
            {
              download: `${sanitize(order.orderNumber)}_delivery_proof.${extFromFilename(order.deliveryProofFilename)}`,
            },
          )
        : await createSignedUrl(
            PAYMENT_PROOFS_BUCKET,
            order.deliveryProofKey,
            TTL_SECONDS,
          );

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "order.delivery_proof_accessed",
        entityType: "Order",
        entityId: orderId,
        metadata: { filename: order.deliveryProofFilename, variant },
      },
    });

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}

export async function mintVerificationDocumentUrl(
  eventId: string,
  documentId: string,
  variant: "preview" | "view" | "download",
): Promise<MintDocumentUrlResult> {
  const { id: staffId } = await requireStaffAction("verification:review");

  if (variant !== "preview" && variant !== "view" && variant !== "download") {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  const doc = await getVerificationDocumentForMint(eventId, documentId);
  if (!doc) {
    return {
      success: false,
      error: "Document not found.",
      errorCode: "DOCUMENT_NOT_FOUND",
    };
  }

  try {
    const url =
      variant === "download"
        ? await createSignedUrl(VERIFICATION_BUCKET, doc.storageKey, TTL_SECONDS, {
            download: `${sanitize(doc.customerName)}_${doc.role}_${eventId}.${extFromMime(doc.mimeType)}`,
          })
        : await createSignedUrl(VERIFICATION_BUCKET, doc.storageKey, TTL_SECONDS);

    if (variant !== "preview") {
      await db.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staffId,
          action: "verification.document_accessed",
          entityType: "VerificationEvent",
          entityId: eventId,
          metadata: {
            documentId,
            role: doc.role,
            filename: doc.filename,
            variant,
          },
        },
      });
    }

    return { success: true, data: { url } };
  } catch {
    return {
      success: false,
      error: "Could not generate a link.",
      errorCode: "URL_MINT_FAILED",
    };
  }
}
