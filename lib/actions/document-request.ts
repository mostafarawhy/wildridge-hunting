"use server";

import {
  DEMO_B2B_SAMPLES,
  DEMO_SAMPLES_FIELD,
  demoUploadRefusal,
  isDemoMode,
} from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { logAndSendEmail } from "@/lib/services/resend";
import { requireStaffAction } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import { deriveB2BStatus } from "@/lib/db/queries/b2b";
import {
  b2bDocumentRequestMessageSchema,
  cancelB2BDocumentRequestSchema,
  b2bProvideDocumentsSchema,
  b2bUpdateDetailsSchema,
  MAX_FILE_SIZE_BYTES,
  MAX_B2B_FILES,
  detectMimeType,
  REQUESTABLE_B2B_DOCUMENT_TYPES,
} from "@/lib/validations/b2b";
import type {
  B2BDocumentRequestMessageInput,
  CancelB2BDocumentRequestInput,
  B2BProvideDocumentsInput,
} from "@/lib/validations/b2b";
import {
  loadB2BEmailData,
  customerB2BChrome,
  staffB2BChrome,
} from "@/lib/email/b2b-email";
import { excerpt } from "@/lib/email/chrome";
import { B2B_DOCUMENT_TYPE_LABELS } from "@/lib/utils/document-labels";
import { formatDisplayDate } from "@/lib/utils/date";
import { accountUrl } from "@/lib/email/links";

const B2B_DOCS_BUCKET = "b2b-documents";

function sanitizeFilename(index: number, originalName: string): string {
  const cleaned = originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
  return `${index}_${cleaned}`;
}

function trimmedFieldOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// createB2BDocumentRequestAction (staff)
// ---------------------------------------------------------------------------

export type CreateB2BDocumentRequestErrorCode =
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "DUPLICATE_OPEN"
  | "VALIDATION_ERROR"
  | "INVALID_TYPES"
  | "INTERNAL_ERROR";

export type CreateB2BDocumentRequestResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: CreateB2BDocumentRequestErrorCode;
    };

function isRequestableStatus(
  status: ReturnType<typeof deriveB2BStatus>,
  scope: "DOCUMENTS" | "DETAILS",
): boolean {
  if (scope === "DETAILS") {
    return status === "PENDING" || status === "APPROVED";
  }
  return status === "PENDING" || status === "APPROVED" || status === "SUSPENDED";
}

export async function createB2BDocumentRequestAction(
  input: B2BDocumentRequestMessageInput,
): Promise<CreateB2BDocumentRequestResult<{ requestId: string }>> {
  const { id: staffId } = await requireStaffAction("b2b:read");

  const parsed = b2bDocumentRequestMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode:
        parsed.error.issues[0]?.path[0] === "types"
          ? "INVALID_TYPES"
          : "VALIDATION_ERROR",
    };
  }
  const { scope, accountId, message } = parsed.data;
  const types =
    scope === "DOCUMENTS"
      ? REQUESTABLE_B2B_DOCUMENT_TYPES.filter((t) =>
          parsed.data.types.includes(t),
        )
      : [];

  const account = await db.b2BAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      companyNameEn: true,
      customer: { select: { email: true } },
    },
  });

  if (!account) {
    return {
      success: false,
      error: "B2B application not found.",
      errorCode: "NOT_FOUND",
    };
  }

  const derivedStatus = deriveB2BStatus(account.status, account.expiresAt);
  if (!isRequestableStatus(derivedStatus, scope)) {
    return {
      success: false,
      error: `Cannot request documents for an account with status ${derivedStatus}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  let requestId: string;
  try {
    requestId = await db.$transaction(
      async (tx) => {
        const current = await tx.b2BAccount.findUnique({
          where: { id: accountId },
          select: { status: true, expiresAt: true },
        });
        if (!current) throw new Error("NOT_FOUND");

        const currentDerived = deriveB2BStatus(
          current.status,
          current.expiresAt,
        );
        if (!isRequestableStatus(currentDerived, scope)) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        const request = await tx.documentRequest.create({
          data: {
            b2bAccountId: accountId,
            scope,
            status: "OPEN",
            types,
            message,
            requestedById: staffId,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: scope === "DETAILS" ? "b2b.details_requested" : "b2b.documents_requested",
            entityType: "B2BAccount",
            entityId: accountId,
            after: { requestId: request.id, scope, types },
            metadata: { note: message, requestId: request.id },
          },
        });

        return request.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "B2B application not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot request documents for an account with status ${derivedStatus}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error: "This account already has an open document request.",
        errorCode: "DUPLICATE_OPEN",
      };
    }
    console.error("[createB2BDocumentRequestAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const data = await loadB2BEmailData(accountId, requestId);
    if (!data) return;
    await logAndSendEmail({
      templateKey:
        scope === "DETAILS" ? "b2b_details_requested" : "b2b_documents_requested",
      toEmail: account.customer.email,
      payload: { accountId, requestId, company: account.companyNameEn },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Action needed", tone: "info" },
        infoRows: [
          { label: "Company", value: data.company },
          ...(data.request
            ? [{ label: "Requested on", value: data.request.requestedDate }]
            : []),
          ...(data.request && data.request.types.length > 0
            ? [
                {
                  label: "Documents",
                  value: data.request.types
                    .map((type) => B2B_DOCUMENT_TYPE_LABELS[type])
                    .join(", "),
                },
              ]
            : []),
        ],
        ...(data.request
          ? {
              excerpt: {
                label: "What we need",
                text: excerpt(data.request.message),
              },
            }
          : {}),
        ctaUrl:
          scope === "DETAILS" ? data.accountDetailsUrl : data.accountDocumentsUrl,
      }),
    });
  });

  revalidatePath(`/admin/b2b/${accountId}`);
  revalidatePath("/", "layout");

  return { success: true, data: { requestId } };
}

// ---------------------------------------------------------------------------
// cancelB2BDocumentRequestAction (staff)
// ---------------------------------------------------------------------------

export type CancelB2BDocumentRequestErrorCode =
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type CancelB2BDocumentRequestResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: CancelB2BDocumentRequestErrorCode;
    };

export async function cancelB2BDocumentRequestAction(
  input: CancelB2BDocumentRequestInput,
): Promise<CancelB2BDocumentRequestResult<{ status: "CANCELLED" }>> {
  const { id: staffId } = await requireStaffAction("b2b:read");

  const parsed = cancelB2BDocumentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { requestId } = parsed.data;

  const existing = await db.documentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      b2bAccountId: true,
      status: true,
      b2bAccount: { select: { customer: { select: { email: true } } } },
    },
  });

  if (!existing) {
    return {
      success: false,
      error: "Document request not found.",
      errorCode: "NOT_FOUND",
    };
  }

  if (existing.status !== "OPEN") {
    return {
      success: false,
      error: `Cannot cancel a request with status ${existing.status}.`,
      errorCode: "INVALID_TRANSITION",
    };
  }

  const accountId = existing.b2bAccountId;
  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.documentRequest.findUnique({
          where: { id: requestId },
          select: { status: true },
        });
        if (!current || current.status !== "OPEN") {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.documentRequest.update({
          where: { id: requestId },
          data: { status: "CANCELLED", cancelledAt: now },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "b2b.request_cancelled",
            entityType: "B2BAccount",
            entityId: accountId,
            metadata: { requestId },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: `Cannot cancel a request with status ${existing.status}.`,
        errorCode: "INVALID_TRANSITION",
      };
    }
    console.error("[cancelB2BDocumentRequestAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/b2b/${accountId}`);
  revalidatePath("/", "layout");

  after(async () => {
    const data = await loadB2BEmailData(accountId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "b2b_request_cancelled",
      toEmail: existing.b2bAccount.customer.email,
      payload: { accountId, requestId, company: data.company },
      chromeOptions: customerB2BChrome(data, {
        badge: { text: "Request withdrawn", tone: "info" },
        infoRows: [
          { label: "Company", value: data.company },
          {
            label: "Withdrawn on",
            value: formatDisplayDate(new Date().toISOString(), "en"),
          },
        ],
        ctaUrl: accountUrl("/b2b"),
      }),
    });
  });

  return { success: true, data: { status: "CANCELLED" } };
}

// ---------------------------------------------------------------------------
// provideB2BDocumentsAction (customer)
// ---------------------------------------------------------------------------

export type ProvideB2BDocumentsErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "NO_ACCOUNT"
  | "NO_REQUEST"
  | "NO_FILES_PROVIDED"
  | "TOO_MANY_FILES"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "REQUEST_MISMATCH"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

export type ProvideB2BDocumentsResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: ProvideB2BDocumentsErrorCode };

export async function provideB2BDocumentsAction(
  formData: FormData,
): Promise<ProvideB2BDocumentsResult<{ accountId: string }>> {
  const useSamples = isDemoMode() && formData instanceof FormData && formData.get(DEMO_SAMPLES_FIELD) === "true";
  if (isDemoMode() && !useSamples) return demoUploadRefusal();

  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to upload documents.",
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
    const file = useSamples ? null : formData.get(`doc.${i}.file`);
    if (!useSamples && (!(file instanceof File) || file.size === 0)) {
      return {
        success: false,
        error: "Every document must include a file.",
        errorCode: "NO_FILES_PROVIDED",
      };
    }
    if (file instanceof File) files.push(file);
    documentsInput.push({
      type: formData.get(`doc.${i}.type`),
      declaredNumber: trimmedFieldOrNull(formData.get(`doc.${i}.number`)),
      label: trimmedFieldOrNull(formData.get(`doc.${i}.label`)),
    });
  }

  const parsed = b2bProvideDocumentsSchema.safeParse({
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
      tradeLicenseNo: true,
      vatNumber: true,
      companyNameEn: true,
    },
  });
  if (!account) {
    return {
      success: false,
      error: "No B2B account found.",
      errorCode: "NO_ACCOUNT",
    };
  }
  const accountId = account.id;

  const openRequest = await db.documentRequest.findFirst({
    where: { b2bAccountId: accountId, status: "OPEN", scope: "DOCUMENTS" },
    select: { id: true, types: true },
  });
  if (!openRequest) {
    return {
      success: false,
      error: "There is no open document request on your account.",
      errorCode: "NO_REQUEST",
    };
  }

  if (openRequest.types.length > 0) {
    const requestedTypes: string[] = openRequest.types;
    const parsedTypes: string[] = parsed.data.documents.map(
      (doc) => doc.type,
    );
    const hasUnrequestedType = parsedTypes.some(
      (type) => !requestedTypes.includes(type),
    );
    const hasMissingRequestedType = requestedTypes.some(
      (type) => !parsedTypes.includes(type),
    );
    if (hasUnrequestedType || hasMissingRequestedType) {
      return {
        success: false,
        error:
          "Your upload doesn't match the documents our team requested. Refresh the page and try again.",
        errorCode: "REQUEST_MISMATCH",
      };
    }
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

  const submittedAt = new Date();

  const uploadEntries: Array<{
    storageKey: string;
    type: B2BProvideDocumentsInput["documents"][number]["type"];
    filename: string;
    mimeType: string;
    declaredNumber: string | null;
    label: string | null;
  }> = [];

  try {
    for (let i = 0; i < parsed.data.documents.length; i++) {
      const doc = parsed.data.documents[i];
      const declaredNumber =
        doc.declaredNumber !== null
          ? doc.declaredNumber
          : doc.type === "TRADE_LICENSE"
            ? account.tradeLicenseNo
            : doc.type === "VAT_CERTIFICATE"
              ? (account.vatNumber ?? null)
              : null;
      if (useSamples) {
        const sample = DEMO_B2B_SAMPLES[doc.type];
        uploadEntries.push({
          storageKey: sample.storageKey,
          type: doc.type,
          filename: sample.filename,
          mimeType: sample.mimeType,
          declaredNumber,
          label: doc.label,
        });
        continue;
      }
      const file = files[i];
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
    console.error("[b2b-provide-documents] upload failed", err);
    for (const { storageKey } of uploadEntries) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-provide-documents] rollback cleanup failed", err);
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
        const current = await tx.documentRequest.findUnique({
          where: { id: openRequest.id },
          select: { status: true, scope: true },
        });
        if (!current || current.status !== "OPEN" || current.scope !== "DOCUMENTS") {
          throw new Error("NO_REQUEST");
        }

        await tx.b2BDocument.createMany({
          data: uploadEntries.map((entry) => ({
            b2bAccountId: accountId,
            type: entry.type,
            filename: entry.filename,
            storageKey: entry.storageKey,
            mimeType: entry.mimeType,
            declaredNumber: entry.declaredNumber,
            label: entry.label,
            requestId: openRequest.id,
          })),
        });

        await tx.documentRequest.update({
          where: { id: openRequest.id },
          data: { status: "FULFILLED", fulfilledAt: submittedAt },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "b2b.documents_provided",
            entityType: "B2BAccount",
            entityId: accountId,
            after: {
              requestId: openRequest.id,
              documents: uploadEntries.map((entry) => ({
                type: entry.type,
                declaredNumber: entry.declaredNumber,
              })),
            },
            metadata: {
              acknowledgmentText,
              acknowledgedAt: submittedAt.toISOString(),
              locale: parsed.data.locale,
              requestId: openRequest.id,
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
        console.error("[b2b-provide-documents] rollback cleanup failed", err);
      }
    }
    if (err instanceof Error && err.message === "NO_REQUEST") {
      return {
        success: false,
        error: "There is no open document request on your account.",
        errorCode: "NO_REQUEST",
      };
    }
    console.error("[b2b-provide-documents] transaction failed", err);
    return {
      success: false,
      error: "Failed to save documents. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  const documentCount = uploadEntries.length;
  after(async () => {
    const { sales: salesRecipients } = await getSetting("email_recipients");
    const data = await loadB2BEmailData(accountId, openRequest.id);
    if (!data) return;
    for (const salesEmail of salesRecipients) {
      await logAndSendEmail({
        templateKey: "b2b_documents_provided",
        toEmail: salesEmail,
        payload: {
          accountId,
          requestId: openRequest.id,
          company: account.companyNameEn,
          documentCount,
        },
        chromeOptions: staffB2BChrome(data, {
          badge: { text: "Documents received", tone: "info" },
          infoRows: [
            { label: "Company", value: data.company },
            { label: "Trade licence", value: data.tradeLicense },
            {
              label: "Applicant",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            { label: "Documents", value: String(documentCount) },
          ],
        }),
      });
    }
  });

  revalidatePath("/", "layout");
  return { success: true, data: { accountId } };
}

// ---------------------------------------------------------------------------
// updateB2BDetailsAction (customer)
// ---------------------------------------------------------------------------

export type UpdateB2BDetailsErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "NO_ACCOUNT"
  | "NO_REQUEST"
  | "NO_CHANGES"
  | "VALIDATION_ERROR"
  | "DUPLICATE_LICENSE"
  | "MISSING_LICENSE_DOCUMENT"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

export type UpdateB2BDetailsResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: UpdateB2BDetailsErrorCode };

export async function updateB2BDetailsAction(
  formData: unknown,
): Promise<UpdateB2BDetailsResult<{ accountId: string }>> {
  if (isDemoMode()) return demoUploadRefusal();

  if (!(formData instanceof FormData)) {
    return {
      success: false,
      error: "Invalid form submission.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to update your business details.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const parsed = b2bUpdateDetailsSchema.safeParse({
    locale: formData.get("locale"),
    acknowledged: formData.get("acknowledged") === "true",
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

  const account = await db.b2BAccount.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      tradeLicenseNo: true,
      vatNumber: true,
      companyNameEn: true,
      companyNameAr: true,
      contactName: true,
      contactPhone: true,
      expiresAt: true,
    },
  });
  if (!account) {
    return {
      success: false,
      error: "No B2B account found.",
      errorCode: "NO_ACCOUNT",
    };
  }
  const accountId = account.id;

  const openRequest = await db.documentRequest.findFirst({
    where: { b2bAccountId: accountId, status: "OPEN", scope: "DETAILS" },
    select: { id: true },
  });
  if (!openRequest) {
    return {
      success: false,
      error: "There is no open request to update your details.",
      errorCode: "NO_REQUEST",
    };
  }

  const unchanged =
    parsed.data.companyNameEn === account.companyNameEn &&
    (parsed.data.companyNameAr ?? "") === (account.companyNameAr ?? "") &&
    parsed.data.tradeLicenseNo === account.tradeLicenseNo &&
    (parsed.data.vatNumber ?? "") === (account.vatNumber ?? "") &&
    parsed.data.contactName === (account.contactName ?? "") &&
    parsed.data.contactPhone === (account.contactPhone ?? "");
  if (unchanged) {
    return {
      success: false,
      error: "Change at least one detail before submitting.",
      errorCode: "NO_CHANGES",
    };
  }

  const licenceChanged =
    parsed.data.tradeLicenseNo.toLowerCase() !==
    account.tradeLicenseNo.toLowerCase();

  const licenseFileRaw = formData.get("licenseFile");
  const licenseFile =
    licenceChanged && licenseFileRaw instanceof File && licenseFileRaw.size > 0
      ? licenseFileRaw
      : null;

  if (licenceChanged && !licenseFile) {
    return {
      success: false,
      error:
        "You changed the license number, so a matching license document is required.",
      errorCode: "MISSING_LICENSE_DOCUMENT",
    };
  }

  let detectedMime: string | null = null;
  if (licenseFile) {
    if (licenseFile.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${licenseFile.name}" exceeds the 5 MB size limit.`,
        errorCode: "FILE_TOO_LARGE",
      };
    }
    const detected = await detectMimeType(licenseFile);
    if (detected === null || detected !== licenseFile.type) {
      return {
        success: false,
        error: `File "${licenseFile.name}" has an unsupported type. Allowed: JPEG, PNG, PDF.`,
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    detectedMime = detected;
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

  if (licenceChanged) {
    const licenseTaken = await db.b2BAccount.findFirst({
      where: {
        id: { not: accountId },
        tradeLicenseNo: {
          equals: parsed.data.tradeLicenseNo,
          mode: "insensitive",
        },
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
  }

  const submittedAt = new Date();

  let storageKey: string | null = null;
  if (licenseFile) {
    const filename = sanitizeFilename(0, licenseFile.name);
    const path = `b2b-documents/${customerId}/${accountId}/${submittedAt.getTime()}/${filename}`;
    try {
      const result = await uploadFile({
        bucket: B2B_DOCS_BUCKET,
        path,
        file: licenseFile,
        contentType: detectedMime!,
      });
      storageKey = result.storageKey;
    } catch (err) {
      console.error("[b2b-update-details] upload failed", err);
      if (storageKey) {
        try {
          await deleteFile(B2B_DOCS_BUCKET, storageKey);
        } catch (err) {
          console.error("[b2b-update-details] rollback cleanup failed", err);
        }
      }
      return {
        success: false,
        error: "Failed to upload documents. Please try again.",
        errorCode: "STORAGE_ERROR",
      };
    }
  }

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.documentRequest.findUnique({
          where: { id: openRequest.id },
          select: { id: true, status: true, scope: true },
        });
        if (
          !current ||
          current.status !== "OPEN" ||
          current.scope !== "DETAILS"
        ) {
          throw new Error("NO_REQUEST");
        }

        if (storageKey) {
          await tx.b2BDocument.updateMany({
            where: {
              b2bAccountId: accountId,
              type: "TRADE_LICENSE",
              supersededAt: null,
            },
            data: { supersededAt: submittedAt },
          });

          await tx.b2BDocument.create({
            data: {
              b2bAccountId: accountId,
              type: "TRADE_LICENSE",
              filename: licenseFile!.name,
              storageKey,
              mimeType: detectedMime!,
              declaredNumber: parsed.data.tradeLicenseNo,
              label: null,
              requestId: openRequest.id,
            },
          });
        }

        await tx.b2BAccount.update({
          where: { id: accountId },
          data: {
            companyNameEn: parsed.data.companyNameEn,
            companyNameAr: parsed.data.companyNameAr,
            tradeLicenseNo: parsed.data.tradeLicenseNo,
            vatNumber: parsed.data.vatNumber,
            contactName: parsed.data.contactName,
            contactPhone: parsed.data.contactPhone,
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });

        await tx.documentRequest.update({
          where: { id: openRequest.id },
          data: { status: "FULFILLED", fulfilledAt: submittedAt },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "b2b.details_updated",
            entityType: "B2BAccount",
            entityId: accountId,
            before: {
              status: account.status,
              tradeLicenseNo: account.tradeLicenseNo,
              companyNameEn: account.companyNameEn,
              companyNameAr: account.companyNameAr,
              vatNumber: account.vatNumber,
              contactName: account.contactName,
              contactPhone: account.contactPhone,
            },
            after: {
              status: "PENDING",
              tradeLicenseNo: parsed.data.tradeLicenseNo,
              companyNameEn: parsed.data.companyNameEn,
              companyNameAr: parsed.data.companyNameAr,
              vatNumber: parsed.data.vatNumber,
              contactName: parsed.data.contactName,
              contactPhone: parsed.data.contactPhone,
              licenceDocumentReplaced: Boolean(storageKey),
            },
            metadata: {
              acknowledgmentText,
              acknowledgedAt: submittedAt.toISOString(),
              locale: parsed.data.locale,
              requestId: openRequest.id,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (storageKey) {
      try {
        await deleteFile(B2B_DOCS_BUCKET, storageKey);
      } catch (err) {
        console.error("[b2b-update-details] rollback cleanup failed", err);
      }
    }
    if (err instanceof Error && err.message === "NO_REQUEST") {
      return {
        success: false,
        error: "There is no open request to update your details.",
        errorCode: "NO_REQUEST",
      };
    }
    if (isP2002(err)) {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      const targets = meta?.target ?? [];
      if (
        targets.includes("tradeLicenseNo") ||
        targets.includes("unique_active_b2b_per_trade_license")
      ) {
        return {
          success: false,
          error:
            "A B2B account with this trade license number already exists.",
          errorCode: "DUPLICATE_LICENSE",
        };
      }
      return {
        success: false,
        error: "Something went wrong. Please try again.",
        errorCode: "INTERNAL_ERROR",
      };
    }
    console.error("[b2b-update-details] transaction failed", err);
    return {
      success: false,
      error: "Failed to save changes. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  after(async () => {
    const { sales: salesRecipients } = await getSetting("email_recipients");
    const data = await loadB2BEmailData(accountId, openRequest.id);
    if (!data) return;
    for (const salesEmail of salesRecipients) {
      await logAndSendEmail({
        templateKey: "b2b_details_updated",
        toEmail: salesEmail,
        payload: {
          accountId,
          requestId: openRequest.id,
          company: parsed.data.companyNameEn,
          licenceChanged,
        },
        chromeOptions: staffB2BChrome(data, {
          badge: { text: "Details updated", tone: "info" },
          infoRows: [
            { label: "Company", value: data.company },
            { label: "Trade licence", value: data.tradeLicense },
            {
              label: "Applicant",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            { label: "Licence changed", value: licenceChanged ? "Yes" : "No" },
          ],
        }),
      });
    }
  });

  revalidatePath("/", "layout");
  return { success: true, data: { accountId } };
}
