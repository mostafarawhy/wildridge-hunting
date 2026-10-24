"use server";

import { demoUploadRefusal, isDemoMode } from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { logAndSendEmail } from "@/lib/services/resend";
import { requireStaffAction } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import {
  b2bRegistrationSchema,
  approveB2BSchema,
  overrideApproveB2BSchema,
  rejectB2BSchema,
  suspendB2BSchema,
  expireB2BSchema,
  b2bRenewalSchema,
  b2bRegistrationDocumentsSchema,
  MAX_FILE_SIZE_BYTES,
  MAX_B2B_FILES,
  detectMimeType,
} from "@/lib/validations/b2b";
import type {
  ApproveB2BInput,
  OverrideApproveB2BInput,
  RejectB2BInput,
  SuspendB2BInput,
  ExpireB2BInput,
  B2BRenewalInput,
  B2BRegistrationDocumentsInput,
} from "@/lib/validations/b2b";
import type { B2BStatus } from "@/app/generated/prisma/client";
import { deriveB2BStatus } from "@/lib/db/queries/b2b";
import {
  loadB2BEmailData,
  customerB2BChrome,
  staffB2BChrome,
} from "@/lib/email/b2b-email";
import { emailDate } from "@/lib/email/order-email";

export type B2BActionErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "ALREADY_APPLIED"
  | "NO_FILES_PROVIDED"
  | "TOO_MANY_FILES"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "DUPLICATE_LICENSE"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR"
  | "MISSING_REQUIRED_DOCUMENT";

export type B2BActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: B2BActionErrorCode };

const B2B_DOCS_BUCKET = "b2b-documents";

function sanitizeFilename(index: number, originalName: string): string {
  const cleaned = originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
  return `${index}_${cleaned}`;
}

export async function submitB2BRegistrationAction(
  formData: FormData,
): Promise<B2BActionResult<{ accountId: string }>> {
  if (isDemoMode()) return demoUploadRefusal();

  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to apply for a B2B account.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const existing = await db.b2BAccount.findFirst({
    where: { customerId, status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
    select: { id: true },
  });
  if (existing) {
    return {
      success: false,
      error: "You have already submitted a B2B application.",
      errorCode: "ALREADY_APPLIED",
    };
  }

  const docCountRaw = formData.get("docCount");
  const docCount =
    typeof docCountRaw === "string" ? Number.parseInt(docCountRaw, 10) : NaN;
  if (!Number.isInteger(docCount) || docCount <= 0) {
    return {
      success: false,
      error: "Invalid document count.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  if (docCount > MAX_B2B_FILES) {
    return {
      success: false,
      error: `You can upload up to ${MAX_B2B_FILES} documents.`,
      errorCode: "TOO_MANY_FILES",
    };
  }

  const files: File[] = [];
  const documentsInput: Array<{
    type: FormDataEntryValue | null;
    declaredNumber: string | null;
    label: string | null;
  }> = [];

  for (let i = 0; i < docCount; i++) {
    const file = formData.get(`doc.${i}.file`);
    if (!(file instanceof File) || file.size === 0) {
      return {
        success: false,
        error: "Every document must include a file.",
        errorCode: "NO_FILES_PROVIDED",
      };
    }
    files.push(file);
    documentsInput.push({
      type: formData.get(`doc.${i}.type`),
      declaredNumber: trimmedFieldOrNull(formData.get(`doc.${i}.number`)),
      label: trimmedFieldOrNull(formData.get(`doc.${i}.label`)),
    });
  }

  const parsedDocuments = b2bRegistrationDocumentsSchema.safeParse({
    documents: documentsInput,
  });
  if (!parsedDocuments.success) {
    return {
      success: false,
      error: parsedDocuments.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const detectedMimeByFile = new Map<File, string>();
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${file.name}" exceeds the 5 MB size limit.`,
        errorCode: "FILE_TOO_LARGE",
      };
    }
    const detected = await detectMimeType(file);
    if (detected === null || detected !== file.type) {
      return {
        success: false,
        error: `File "${file.name}" has an unsupported type. Allowed: JPEG, PNG, PDF.`,
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    detectedMimeByFile.set(file, detected);
  }

  const parsed = b2bRegistrationSchema.safeParse({
    companyNameEn: formData.get("companyNameEn"),
    companyNameAr: trimmedFieldOrNull(formData.get("companyNameAr")),
    tradeLicenseNo: formData.get("tradeLicenseNo"),
    vatNumber: trimmedFieldOrNull(formData.get("vatNumber")),
    contactName: formData.get("contactName"),
    contactPhone: formData.get("contactPhone"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const {
    companyNameEn,
    companyNameAr,
    tradeLicenseNo,
    vatNumber,
    contactName,
    contactPhone,
  } = parsed.data;

  const localeRaw = formData.get("locale");
  const locale: "en" | "ar" | "ru" =
    typeof localeRaw === "string" && ["en", "ar", "ru"].includes(localeRaw)
      ? (localeRaw as "en" | "ar" | "ru")
      : "en";

  const b2bContent = await getSetting("b2b_content");
  const acknowledgmentText = b2bContent[locale].acknowledgment.trim();
  const acknowledged = formData.get("acknowledged") === "true";
  if (acknowledgmentText.length > 0 && !acknowledged) {
    return {
      success: false,
      error: "You must accept the acknowledgment to continue.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const submittedAt = new Date();

  const requiredTypes = b2bContent.requiredTypes;
  for (const type of requiredTypes) {
    const hasType = parsedDocuments.data.documents.some(
      (doc) => doc.type === type,
    );
    if (!hasType) {
      return {
        success: false,
        error: "A required document is missing. Please upload every document listed as required.",
        errorCode: "MISSING_REQUIRED_DOCUMENT",
      };
    }
  }
  if (requiredTypes.includes("VAT_CERTIFICATE") && !vatNumber) {
    return {
      success: false,
      error: "VAT registration number is required.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const licenseTaken = await db.b2BAccount.findFirst({
    where: {
      tradeLicenseNo: { equals: tradeLicenseNo, mode: "insensitive" },
      status: { in: ["PENDING", "APPROVED", "SUSPENDED"] },
    },
    select: { id: true },
  });
  if (licenseTaken) {
    return {
      success: false,
      error: "A B2B account with this trade license number already exists.",
      errorCode: "DUPLICATE_LICENSE",
    };
  }

  let account: { id: string };
  try {
    account = await db.b2BAccount.create({
      data: {
        customerId,
        companyNameEn,
        companyNameAr: companyNameAr ?? null,
        tradeLicenseNo,
        vatNumber: vatNumber ?? null,
        contactName,
        contactPhone,
        status: "PENDING",
      },
      select: { id: true },
    });
  } catch (err: unknown) {
    const code =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code;

    if (code === "P2002") {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      const targets = meta?.target ?? [];
      if (
        targets.includes("tradeLicenseNo") ||
        targets.includes("unique_active_b2b_per_trade_license")
      ) {
        return {
          success: false,
          error: "A B2B account with this trade license number already exists.",
          errorCode: "DUPLICATE_LICENSE",
        };
      }
      return {
        success: false,
        error: "You have already submitted a B2B application.",
        errorCode: "ALREADY_APPLIED",
      };
    }
    return {
      success: false,
      error: "Failed to create B2B account. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  const accountId = account.id;

  const uploadEntries: Array<{
    file: File;
    storageKey: string;
    type: B2BRegistrationDocumentsInput["documents"][number]["type"];
    detectedMime: string;
    declaredNumber: string | null;
    label: string | null;
  }> = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const doc = parsedDocuments.data.documents[i];
      const declaredNumber =
        doc.declaredNumber !== null
          ? doc.declaredNumber
          : doc.type === "TRADE_LICENSE"
            ? tradeLicenseNo
            : doc.type === "VAT_CERTIFICATE"
              ? (vatNumber ?? null)
              : null;
      const filename = sanitizeFilename(i, file.name);
      const path = `b2b-documents/${customerId}/${accountId}/${submittedAt.getTime()}/${filename}`;
      const detectedMime = detectedMimeByFile.get(file)!;
      const result = await uploadFile({
        bucket: B2B_DOCS_BUCKET,
        path,
        file,
        contentType: detectedMime,
      });
      uploadEntries.push({
        file,
        storageKey: result.storageKey,
        type: doc.type,
        detectedMime,
        declaredNumber,
        label: doc.label,
      });
    }
  } catch (err) {
    console.error("[b2b-register] upload failed", err);
    for (const { storageKey } of uploadEntries) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-register] rollback cleanup failed", err);
      }
    }
    try {
      await db.b2BAccount.delete({ where: { id: accountId } });
    } catch (err) {
      console.error("[b2b-register] rollback cleanup failed", err);
    }
    return {
      success: false,
      error: "Failed to upload documents. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      for (const {
        file,
        storageKey,
        type,
        detectedMime,
        declaredNumber,
        label,
      } of uploadEntries) {
        await tx.b2BDocument.create({
          data: {
            b2bAccountId: accountId,
            type,
            filename: file.name,
            storageKey,
            mimeType: detectedMime,
            declaredNumber,
            label,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorType: "CUSTOMER",
          actorId: customerId,
          action: "b2b.registration_submitted",
          entityType: "B2BAccount",
          entityId: accountId,
          after: {
            status: "PENDING",
            documents: uploadEntries.map((e) => ({
              type: e.type,
              declaredNumber: e.declaredNumber,
            })),
          },
          metadata: {
            acknowledgmentText,
            acknowledgedAt: submittedAt.toISOString(),
            locale,
          },
        },
      });
    });
  } catch (err) {
    console.error("[b2b-register] document record write failed", err);
    for (const { storageKey } of uploadEntries) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-register] rollback cleanup failed", err);
      }
    }
    try {
      await db.b2BAccount.delete({ where: { id: accountId } });
    } catch (err) {
      console.error("[b2b-register] rollback cleanup failed", err);
    }
    return {
      success: false,
      error: "Failed to save document records. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const { sales: salesRecipients } = await getSetting("email_recipients");
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_registration_received_customer",
      toEmail: data.customerEmail,
      payload: { companyNameEn },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Pending review", tone: "warning" },
        infoRows: [
          { label: "Company", value: data.company },
          { label: "Trade licence", value: data.tradeLicense },
        ],
        ctaUrl: data.accountUrl,
      }),
    });
    for (const salesEmail of salesRecipients) {
      await logAndSendEmail({
        templateKey: "b2b_registration_received",
        toEmail: salesEmail,
        payload: { accountId, customerId, companyNameEn, tradeLicenseNo },
        chromeOptions: staffB2BChrome(data, {
          badge: { text: "Pending review", tone: "warning" },
          infoRows: [
            { label: "Company", value: data.company },
            { label: "Trade licence", value: data.tradeLicense },
            {
              label: "Applicant",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
          ],
        }),
      });
    }
  });

  revalidatePath("/", "layout");
  return { success: true, data: { accountId } };
}

// ---------------------------------------------------------------------------
// B2B Review
// ---------------------------------------------------------------------------

export type B2BReviewErrorCode =
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "VALIDATION_ERROR"
  | "DUPLICATE_ACTIVE"
  | "ALREADY_EXPIRED"
  | "INTERNAL_ERROR";

export type B2BReviewResult =
  | { success: true; data: { status: B2BStatus } }
  | { success: false; error: string; errorCode: B2BReviewErrorCode };

const allowedFrom: Record<
  "APPROVE" | "REJECT" | "SUSPEND" | "EXPIRE",
  B2BStatus[]
> = {
  APPROVE: ["PENDING", "SUSPENDED"],
  REJECT: ["PENDING"],
  SUSPEND: ["APPROVED"],
  EXPIRE: ["APPROVED"],
};

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

function revalidateB2B(accountId: string): void {
  revalidatePath(`/admin/b2b/${accountId}`);
  revalidatePath("/admin/b2b");
  revalidatePath("/", "layout");
}

export async function approveB2BAccountAction(
  input: ApproveB2BInput,
): Promise<B2BReviewResult> {
  const { id: staffId } = await requireStaffAction("b2b:approve");

  const parsed = approveB2BSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { accountId, attestation } = parsed.data;

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      customer: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const oldStatus = account.status;
  const oldRole = account.customer.role;

  if (!allowedFrom.APPROVE.includes(oldStatus)) {
    return {
      success: false,
      error: `Cannot approve an application with status ${oldStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  const now = new Date();
  const verifiedAt = now;
  const expiresAt = new Date(now.getTime());
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true },
        });

        if (!current || !allowedFrom.APPROVE.includes(current.status)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            status: "APPROVED",
            reviewedById: staffId,
            reviewedAt: now,
            verifiedAt,
            expiresAt,
            rejectionReason: null,
          },
        });
        await tx.customer.update({
          where: { id: account.customer.id },
          data: { role: "B2B", tokenVersion: { increment: 1 } },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.approve",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { status: oldStatus, role: oldRole },
            after: { status: "APPROVED", role: "B2B", attestation },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot approve an application with status ${oldStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error:
          "This customer already has an active application; review that one instead.",
        errorCode: "DUPLICATE_ACTIVE",
      };
    }
    console.error("[approveB2BAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_approved",
      toEmail: account.customer.email,
      payload: { accountId, company: data.company },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Approved", tone: "success" },
        infoRows: [
          { label: "Company", value: data.company },
          { label: "Trade licence", value: data.tradeLicense },
          ...(data.expiresAtLabel
            ? [{ label: "Valid until", value: data.expiresAtLabel }]
            : []),
        ],
        ctaUrl: data.accountUrl,
      }),
    });
  });

  revalidateB2B(accountId);
  return { success: true, data: { status: "APPROVED" } };
}

export async function overrideApproveB2BAccountAction(
  input: OverrideApproveB2BInput,
): Promise<B2BReviewResult> {
  const { id: staffId } = await requireStaffAction("compliance:override");

  const parsed = overrideApproveB2BSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { accountId, justification, attestation } = parsed.data;

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      customer: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const oldStatus = account.status;
  const oldRole = account.customer.role;

  const isOverrideEligible = (status: B2BStatus, expiresAt: Date | null) =>
    deriveB2BStatus(status, expiresAt) === "EXPIRED" || status === "REJECTED";

  if (!isOverrideEligible(account.status, account.expiresAt)) {
    return {
      success: false,
      error: `Cannot override an application with status ${oldStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  const now = new Date();
  const verifiedAt = now;
  const expiresAt = new Date(now.getTime());
  expiresAt.setFullYear(expiresAt.getFullYear() + 2);

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true, expiresAt: true },
        });

        if (!current || !isOverrideEligible(current.status, current.expiresAt)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            status: "APPROVED",
            reviewedById: staffId,
            reviewedAt: now,
            verifiedAt,
            expiresAt,
            rejectionReason: null,
          },
        });
        await tx.customer.update({
          where: { id: account.customer.id },
          data: { role: "B2B", tokenVersion: { increment: 1 } },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.override_approve",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { status: oldStatus, role: oldRole },
            after: {
              status: "APPROVED",
              role: "B2B",
              attestation,
              override: true,
            },
            metadata: { justification },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot override an application with status ${oldStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error:
          "This customer already has an active application; review that one instead.",
        errorCode: "DUPLICATE_ACTIVE",
      };
    }
    console.error("[overrideApproveB2BAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_approved",
      toEmail: account.customer.email,
      payload: { accountId, company: data.company },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Approved", tone: "success" },
        infoRows: [
          { label: "Company", value: data.company },
          { label: "Trade licence", value: data.tradeLicense },
          ...(data.expiresAtLabel
            ? [{ label: "Valid until", value: data.expiresAtLabel }]
            : []),
        ],
        ctaUrl: data.accountUrl,
      }),
    });
  });

  revalidateB2B(accountId);
  return { success: true, data: { status: "APPROVED" } };
}

export async function rejectB2BAccountAction(
  input: RejectB2BInput,
): Promise<B2BReviewResult> {
  const { id: staffId } = await requireStaffAction("b2b:approve");

  const parsed = rejectB2BSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { accountId, reason } = parsed.data;

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      customer: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const oldStatus = account.status;
  const oldRole = account.customer.role;

  if (!allowedFrom.REJECT.includes(oldStatus)) {
    return {
      success: false,
      error: `Cannot reject an application with status ${oldStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true },
        });

        if (!current || !allowedFrom.REJECT.includes(current.status)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            status: "REJECTED",
            reviewedById: staffId,
            reviewedAt: now,
            rejectionReason: reason,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.reject",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { status: oldStatus, role: oldRole },
            after: { status: "REJECTED", role: oldRole },
            metadata: { reason },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot reject an application with status ${oldStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error:
          "This customer already has an active application; review that one instead.",
        errorCode: "DUPLICATE_ACTIVE",
      };
    }
    console.error("[rejectB2BAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_rejected",
      toEmail: account.customer.email,
      payload: { accountId, company: data.company, reason },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Not approved", tone: "danger" },
        infoRows: [
          { label: "Company", value: data.company },
          ...(data.reason ? [{ label: "Reason", value: data.reason }] : []),
        ],
        ctaUrl: data.accountUrl,
      }),
    });
  });

  revalidateB2B(accountId);
  return { success: true, data: { status: "REJECTED" } };
}

export async function suspendB2BAccountAction(
  input: SuspendB2BInput,
): Promise<B2BReviewResult> {
  const { id: staffId } = await requireStaffAction("b2b:approve");

  const parsed = suspendB2BSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { accountId, reason } = parsed.data;

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      customer: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const oldStatus = account.status;
  const oldRole = account.customer.role;

  if (!allowedFrom.SUSPEND.includes(oldStatus)) {
    return {
      success: false,
      error: `Cannot suspend an application with status ${oldStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true },
        });

        if (!current || !allowedFrom.SUSPEND.includes(current.status)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            status: "SUSPENDED",
            reviewedById: staffId,
            reviewedAt: now,
            rejectionReason: reason,
          },
        });
        await tx.customer.update({
          where: { id: account.customer.id },
          data: { role: "B2C", tokenVersion: { increment: 1 } },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.suspend",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { status: oldStatus, role: oldRole },
            after: { status: "SUSPENDED", role: "B2C" },
            metadata: { reason },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot suspend an application with status ${oldStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error:
          "This customer already has an active application; review that one instead.",
        errorCode: "DUPLICATE_ACTIVE",
      };
    }
    console.error("[suspendB2BAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_suspended",
      toEmail: account.customer.email,
      payload: { accountId, company: data.company, reason },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Suspended", tone: "warning" },
        infoRows: [
          { label: "Company", value: data.company },
          ...(data.reason ? [{ label: "Reason", value: data.reason }] : []),
        ],
        ctaUrl: data.accountUrl,
      }),
    });
  });

  revalidateB2B(accountId);
  return { success: true, data: { status: "SUSPENDED" } };
}

export async function expireB2BAccountAction(
  input: ExpireB2BInput,
): Promise<B2BReviewResult> {
  const { id: staffId } = await requireStaffAction("b2b:approve");

  const parsed = expireB2BSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { accountId, reason } = parsed.data;

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      customer: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const oldStatus = account.status;

  if (!allowedFrom.EXPIRE.includes(oldStatus)) {
    return {
      success: false,
      error: `Cannot expire an application with status ${oldStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  if (deriveB2BStatus(account.status, account.expiresAt) === "EXPIRED") {
    return {
      success: false,
      error: "This trade account has already expired.",
      errorCode: "ALREADY_EXPIRED",
    };
  }

  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true, expiresAt: true },
        });

        if (!current || !allowedFrom.EXPIRE.includes(current.status)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        if (deriveB2BStatus(current.status, current.expiresAt) === "EXPIRED") {
          throw new Error("ALREADY_EXPIRED");
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: { expiresAt: now },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.expire",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { expiresAt: account.expiresAt },
            after: { expiresAt: now, reason },
            metadata: { reason },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot expire an application with status ${oldStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (err instanceof Error && err.message === "ALREADY_EXPIRED") {
      return {
        success: false,
        error: "This trade account has already expired.",
        errorCode: "ALREADY_EXPIRED",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error:
          "This customer already has an active application; review that one instead.",
        errorCode: "DUPLICATE_ACTIVE",
      };
    }
    console.error("[expireB2BAccountAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_expired",
      toEmail: account.customer.email,
      payload: { accountId, company: data.company, reason },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Expired", tone: "warning" },
        infoRows: [
          { label: "Company", value: data.company },
          ...(data.expiresAtLabel
            ? [{ label: "Expired on", value: data.expiresAtLabel }]
            : []),
        ],
        ctaUrl: data.accountRenewUrl,
      }),
    });
  });

  revalidateB2B(accountId);
  return { success: true, data: { status: oldStatus } };
}

// ---------------------------------------------------------------------------
// B2B Renewal (customer-facing)
// ---------------------------------------------------------------------------

export type B2BRenewalErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "NO_ACCOUNT"
  | "NOT_ELIGIBLE"
  | "NO_FILES_PROVIDED"
  | "TOO_MANY_FILES"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR"
  | "MISSING_REQUIRED_DOCUMENT";

export type B2BRenewalResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: B2BRenewalErrorCode };

function trimmedFieldOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function requestB2BRenewalAction(
  formData: FormData,
): Promise<B2BRenewalResult<{ accountId: string }>> {
  if (isDemoMode()) return demoUploadRefusal();

  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to request a B2B renewal.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const docCountRaw = formData.get("docCount");
  const docCount =
    typeof docCountRaw === "string" ? Number.parseInt(docCountRaw, 10) : NaN;
  if (!Number.isInteger(docCount) || docCount <= 0) {
    return {
      success: false,
      error: "Invalid document count.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  if (docCount > MAX_B2B_FILES) {
    return {
      success: false,
      error: `You can upload up to ${MAX_B2B_FILES} documents.`,
      errorCode: "TOO_MANY_FILES",
    };
  }

  const files: File[] = [];
  const documentsInput: Array<{
    type: FormDataEntryValue | null;
    declaredNumber: string | null;
    label: string | null;
  }> = [];

  for (let i = 0; i < docCount; i++) {
    const file = formData.get(`doc.${i}.file`);
    if (!(file instanceof File) || file.size === 0) {
      return {
        success: false,
        error: "Every document must include a file.",
        errorCode: "NO_FILES_PROVIDED",
      };
    }
    files.push(file);
    documentsInput.push({
      type: formData.get(`doc.${i}.type`),
      declaredNumber: trimmedFieldOrNull(formData.get(`doc.${i}.number`)),
      label: trimmedFieldOrNull(formData.get(`doc.${i}.label`)),
    });
  }

  const parsed = b2bRenewalSchema.safeParse({
    locale: formData.get("locale"),
    acknowledged: formData.get("acknowledged") === "true",
    documents: documentsInput,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const account = await db.b2BAccount.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      companyNameEn: true,
      tradeLicenseNo: true,
      vatNumber: true,
    },
  });
  if (!account) {
    return {
      success: false,
      error: "No B2B account found.",
      errorCode: "NO_ACCOUNT",
    };
  }
  if (deriveB2BStatus(account.status, account.expiresAt) !== "EXPIRED") {
    return {
      success: false,
      error: "Your B2B account is not eligible for renewal.",
      errorCode: "NOT_ELIGIBLE",
    };
  }
  const accountId = account.id;

  const detectedMimeByFile = new Map<File, string>();
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${file.name}" exceeds the 5 MB size limit.`,
        errorCode: "FILE_TOO_LARGE",
      };
    }
    const detected = await detectMimeType(file);
    if (detected === null || detected !== file.type) {
      return {
        success: false,
        error: `File "${file.name}" has an unsupported type. Allowed: JPEG, PNG, PDF.`,
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    detectedMimeByFile.set(file, detected);
  }

  const b2bContent = await getSetting("b2b_content");
  const acknowledgmentText =
    b2bContent[parsed.data.locale].acknowledgment.trim();
  if (acknowledgmentText.length > 0 && parsed.data.acknowledged !== true) {
    return {
      success: false,
      error: "You must accept the acknowledgment to continue.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const requiredTypes = b2bContent.requiredTypes;
  for (const type of requiredTypes) {
    const hasType = parsed.data.documents.some((doc) => doc.type === type);
    if (!hasType) {
      return {
        success: false,
        error: "A required document is missing. Please upload every document listed as required.",
        errorCode: "MISSING_REQUIRED_DOCUMENT",
      };
    }
  }
  if (requiredTypes.includes("VAT_CERTIFICATE") && account.vatNumber === null) {
    return {
      success: false,
      error: "Your VAT registration number is not on file. Please contact support to update it before renewing.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const submittedAt = new Date();

  const uploadEntries: Array<{
    storageKey: string;
    type: B2BRenewalInput["documents"][number]["type"];
    filename: string;
    mimeType: string;
    declaredNumber: string | null;
    label: string | null;
  }> = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const doc = parsed.data.documents[i];
      const declaredNumber =
        doc.declaredNumber !== null
          ? doc.declaredNumber
          : doc.type === "TRADE_LICENSE"
            ? account.tradeLicenseNo
            : doc.type === "VAT_CERTIFICATE"
              ? (account.vatNumber ?? null)
              : null;
      const filename = sanitizeFilename(i, file.name);
      const path = `b2b-documents/${customerId}/${accountId}/${submittedAt.getTime()}/${filename}`;
      const detectedMime = detectedMimeByFile.get(file)!;
      const result = await uploadFile({
        bucket: B2B_DOCS_BUCKET,
        path,
        file,
        contentType: detectedMime,
      });
      uploadEntries.push({
        storageKey: result.storageKey,
        type: doc.type,
        filename: file.name,
        mimeType: detectedMime,
        declaredNumber,
        label: doc.label,
      });
    }
  } catch (err) {
    console.error("[b2b-renewal] upload failed", err);
    for (const { storageKey } of uploadEntries) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-renewal] rollback cleanup failed", err);
      }
    }
    return {
      success: false,
      error: "Failed to upload documents. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true, expiresAt: true },
        });

        if (
          !current ||
          deriveB2BStatus(current.status, current.expiresAt) !== "EXPIRED"
        ) {
          throw new Error("NOT_ELIGIBLE");
        }

        await tx.b2BDocument.updateMany({
          where: { b2bAccountId: accountId, supersededAt: null },
          data: { supersededAt: submittedAt },
        });

        await tx.b2BDocument.createMany({
          data: uploadEntries.map((entry) => ({
            b2bAccountId: accountId,
            type: entry.type,
            filename: entry.filename,
            storageKey: entry.storageKey,
            mimeType: entry.mimeType,
            declaredNumber: entry.declaredNumber,
            label: entry.label,
          })),
        });

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            status: "PENDING",
            expiresAt: null,
            reviewedById: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "b2b.renewal_requested",
            entityType: "B2BAccount",
            entityId: accountId,
            before: { status: account.status, expiresAt: account.expiresAt },
            after: {
              status: "PENDING",
              documents: uploadEntries.map((entry) => ({
                type: entry.type,
                declaredNumber: entry.declaredNumber,
              })),
            },
            metadata: {
              acknowledgmentText,
              acknowledgedAt: submittedAt.toISOString(),
              locale: parsed.data.locale,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    for (const { storageKey } of uploadEntries) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-renewal] rollback cleanup failed", err);
      }
    }
    if (err instanceof Error && err.message === "NOT_ELIGIBLE") {
      return {
        success: false,
        error: "Your B2B account is not eligible for renewal.",
        errorCode: "NOT_ELIGIBLE",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error: "Failed to save renewal. Please try again.",
        errorCode: "INTERNAL_ERROR",
      };
    }
    console.error("[b2b-renewal] transaction failed", err);
    return {
      success: false,
      error: "Failed to save renewal. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  const currentExpiryLabel = account.expiresAt
    ? emailDate(account.expiresAt)
    : null;
  after(async () => {
    const { sales: salesRecipients } = await getSetting("email_recipients");
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_renewal_received_customer",
      toEmail: data.customerEmail,
      payload: { companyNameEn: account.companyNameEn },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Pending review", tone: "warning" },
        infoRows: [
          { label: "Company", value: data.company },
          { label: "Trade licence", value: data.tradeLicense },
        ],
        ctaUrl: data.accountUrl,
      }),
    });
    for (const salesEmail of salesRecipients) {
      await logAndSendEmail({
        templateKey: "b2b_renewal_received",
        toEmail: salesEmail,
        payload: {
          accountId,
          customerId,
          companyNameEn: account.companyNameEn,
        },
        chromeOptions: staffB2BChrome(data, {
          badge: { text: "Renewal requested", tone: "info" },
          infoRows: [
            { label: "Company", value: data.company },
            { label: "Trade licence", value: data.tradeLicense },
            {
              label: "Applicant",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            ...(currentExpiryLabel
              ? [{ label: "Current expiry", value: currentExpiryLabel }]
              : []),
          ],
        }),
      });
    }
  });

  revalidatePath("/", "layout");
  return { success: true, data: { accountId } };
}
