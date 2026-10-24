"use server";

import { demoUploadRefusal, isDemoMode } from "@/lib/config/demo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { auth } from "@/auth";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { isUaePassEnabled } from "@/lib/env.client";
import { requireStaffAction } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import { getIdentityProvider } from "@/lib/services/identity";
import { logAndSendEmail } from "@/lib/services/resend";
import { STAFF_SUPPORT_NOTE, excerpt } from "@/lib/email/chrome";
import { accountUrl, adminUrl } from "@/lib/email/links";
import { emailDate } from "@/lib/email/order-email";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  loadCustomerEmailData,
  customerAccountChrome,
} from "@/lib/email/account-email";
import { UaePassProvider } from "@/lib/services/identity/uae-pass-provider";
import { setUaePassState } from "@/lib/services/identity/uae-pass-state";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { safeRelativePath } from "@/lib/utils/safe-redirect";
import {
  manualUploadSubmissionSchema,
  approveVerificationSchema,
  overrideApproveVerificationSchema,
  rejectVerificationSchema,
  expireVerificationSchema,
  createVerificationDocumentRequestSchema,
  cancelVerificationDocumentRequestSchema,
  provideVerificationDocumentsSchema,
  updateVerificationDetailsSchema,
  detectMimeType,
  MAX_FILE_SIZE_BYTES,
  ROLE_ALLOWED_TYPES,
} from "@/lib/validations/verification";
import type {
  ApproveVerificationInput,
  OverrideApproveVerificationInput,
  RejectVerificationInput,
  ExpireVerificationInput,
  CreateVerificationDocumentRequestInput,
  CancelVerificationDocumentRequestInput,
} from "@/lib/validations/verification";
import { Prisma } from "@/app/generated/prisma/client";
import { VerificationDocumentRole } from "@/app/generated/prisma/enums";
import type { VerificationDocumentType } from "@/app/generated/prisma/enums";
import { deriveVerificationStatus } from "@/lib/db/queries/verification";
import type { VerificationStatusProjection } from "@/lib/db/queries/verification";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type VerificationActionErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "MISSING_DOCUMENT"
  | "DUPLICATE_PENDING"
  | "STORAGE_ERROR"
  | "EVENT_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "ALREADY_EXPIRED"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED";

export type VerificationActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: VerificationActionErrorCode };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VERIFICATION_DOCS_BUCKET = "verification-docs";
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Replace spaces and special characters with underscores, prefix with index. */
function sanitizeFilename(index: number, originalName: string): string {
  const cleaned = originalName.replace(/[^a-zA-Z0-9.\-]/g, "_");
  return `${index}_${cleaned}`;
}

// ---------------------------------------------------------------------------
// Action 1: submitManualVerificationAction (customer-facing)
// ---------------------------------------------------------------------------

export async function submitManualVerificationAction(
  formData: FormData,
): Promise<VerificationActionResult<{ eventId: string }>> {
  if (isDemoMode()) return demoUploadRefusal();

  // 1. Auth
  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to submit verification documents.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  // 2. Extract the three required document slots
  const slots = [
    {
      role: VerificationDocumentRole.IDENTITY,
      formKey: "identity",
      label: "identity document",
    },
    {
      role: VerificationDocumentRole.PROOF_OF_ADDRESS,
      formKey: "proofOfAddress",
      label: "proof of address document",
    },
    {
      role: VerificationDocumentRole.PHOTO,
      formKey: "photo",
      label: "photo",
    },
  ] as const;

  const files: File[] = [];
  for (const slot of slots) {
    const file = formData.get(slot.formKey);
    if (!(file instanceof File) || file.size === 0) {
      return {
        success: false,
        error: `Please upload a ${slot.label}.`,
        errorCode: "MISSING_DOCUMENT",
      };
    }
    files.push(file);
  }

  // 3. Validate files
  const detectedTypes: NonNullable<
    Awaited<ReturnType<typeof detectMimeType>>
  >[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const file = files[i];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${file.name}" exceeds the 5 MB size limit.`,
        errorCode: "FILE_TOO_LARGE",
      };
    }
    const detectedType = await detectMimeType(file);
    if (detectedType === null || detectedType !== file.type) {
      return {
        success: false,
        error: `File "${file.name}" has an unsupported type. Allowed: JPEG, PNG, PDF.`,
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    if (
      slot.role === VerificationDocumentRole.PHOTO &&
      !detectedType.startsWith("image/")
    ) {
      return {
        success: false,
        error: "Your photo must be a JPEG or PNG image, not a PDF.",
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    detectedTypes.push(detectedType);
  }

  // 4. Validate non-file fields
  const parsed = manualUploadSubmissionSchema.safeParse({
    identityType: formData.get("identityType"),
    proofOfAddressType: formData.get("proofOfAddressType"),
    notes: formData.get("notes") ?? undefined,
    declaredIdNumber: formData.get("declaredIdNumber"),
    declaredAddress: formData.get("declaredAddress"),
    locale: formData.get("locale"),
    acknowledged: formData.get("acknowledged") === "true",
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const verificationContent = await getSetting("verification_content");
  const acknowledgmentText =
    verificationContent[parsed.data.locale].acknowledgment.trim();
  const now = new Date();

  if (acknowledgmentText.length > 0 && parsed.data.acknowledged !== true) {
    return {
      success: false,
      error: "You must accept the acknowledgment to continue.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const types = [
    parsed.data.identityType,
    parsed.data.proofOfAddressType,
    ROLE_ALLOWED_TYPES.PHOTO[0],
  ] as const;

  // 5. Reject duplicate pending submissions
  const existingPending = await db.verificationEvent.findFirst({
    where: { customerId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    return {
      success: false,
      error: "A submission is already under review.",
      errorCode: "DUPLICATE_PENDING",
    };
  }

  // 6. Create VerificationEvent
  let event: { id: string };
  try {
    event = await db.verificationEvent.create({
      data: {
        customerId,
        provider: "MANUAL_REVIEW",
        status: "PENDING",
        rawPayload: { notes: parsed.data.notes ?? null },
        declaredIdNumber: parsed.data.declaredIdNumber,
        declaredAddress: parsed.data.declaredAddress,
        acknowledgmentText:
          acknowledgmentText.length > 0 ? acknowledgmentText : null,
        acknowledgedAt: acknowledgmentText.length > 0 ? now : null,
      },
      select: { id: true },
    });
  } catch {
    return {
      success: false,
      error: "Failed to initiate verification. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  // 7. Upload files
  const storageKeys: string[] = [];
  try {
    for (let i = 0; i < slots.length; i++) {
      const file = files[i];
      const filename = `${slots[i].role}_${sanitizeFilename(i, file.name)}`;
      const path = `${customerId}/${event.id}/${filename}`;

      const result = await uploadFile({
        bucket: VERIFICATION_DOCS_BUCKET,
        path,
        file,
        contentType: detectedTypes[i],
      });
      storageKeys.push(result.storageKey);
    }
  } catch {
    // Rollback: delete the event if upload fails
    try {
      await db.verificationEvent.delete({ where: { id: event.id } });
    } catch {
      // best-effort cleanup — log in production
    }
    return {
      success: false,
      error: "Failed to upload documents. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  // 8. Create documents + customer status + audit log in a transaction
  try {
    await db.$transaction(
      async (tx) => {
        await tx.verificationDocument.createMany({
          data: slots.map((slot, i) => ({
            verificationEventId: event.id,
            role: slot.role,
            type: types[i],
            filename: files[i].name,
            storageKey: storageKeys[i],
            mimeType: detectedTypes[i],
            sizeBytes: files[i].size,
          })),
        });

        await tx.customer.update({
          where: { id: customerId },
          data: { verificationStatus: "PENDING" },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "verification.submit",
            entityType: "VerificationEvent",
            entityId: event.id,
            before: Prisma.JsonNull,
            after: {
              status: "PENDING",
              provider: "MANUAL_REVIEW",
              documents: slots.map((slot, i) => ({
                role: slot.role,
                type: types[i],
              })),
              declaredIdNumber: parsed.data.declaredIdNumber,
              declaredAddress: parsed.data.declaredAddress,
              acknowledged: acknowledgmentText.length > 0,
              acknowledgedAt:
                acknowledgmentText.length > 0 ? now.toISOString() : null,
            } as Prisma.InputJsonValue,
            metadata: { customerId } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    // Attempt storage cleanup on transaction failure
    for (const key of storageKeys) {
      try {
        await deleteFile(VERIFICATION_DOCS_BUCKET, key);
      } catch {
        // best-effort
      }
    }
    try {
      await db.verificationEvent.delete({ where: { id: event.id } });
    } catch {
      // best-effort
    }
    return {
      success: false,
      error: "Failed to save verification submission. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");

  after(async () => {
    const { support: supportRecipients } = await getSetting("email_recipients");
    const data = await loadCustomerEmailData(customerId);
    if (!data) return;
    for (const toEmail of supportRecipients) {
      await logAndSendEmail({
        templateKey: "verification_submitted_staff",
        toEmail,
        chromeOptions: {
          badges: [{ text: "Pending review", tone: "warning" }],
          infoRows: [
            {
              label: "Customer",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            { label: "Submitted on", value: emailDate(now) },
          ],
          ctaUrl: data.adminUrl,
          transparencyNote: STAFF_SUPPORT_NOTE,
        },
      });
    }
  });

  return { success: true, data: { eventId: event.id } };
}

// ---------------------------------------------------------------------------
// Action 2: initiateUaePassAction (customer-facing)
// ---------------------------------------------------------------------------

export async function initiateUaePassAction(input: {
  locale: "en" | "ar" | "ru";
  callbackPath: string;
}): Promise<VerificationActionResult<{ redirectUrl: string }>> {
  if (!isUaePassEnabled()) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "NOT_IMPLEMENTED",
    };
  }

  // 1. Auth
  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to use UAE Pass.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  // 2. Check provider
  const provider = getIdentityProvider();
  if (provider.name === "manual") {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "NOT_IMPLEMENTED",
    };
  }

  // 3. Initiate verification
  const safeCallbackPath =
    safeRelativePath(input.callbackPath) ?? "/account/verification";
  try {
    const result = await provider.initiateVerification({
      customerId,
      customerEmail: session.user.email ?? "",
      customerName: session.user.name ?? "",
      locale: input.locale,
      redirectUrl: safeCallbackPath,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.errorMessage,
        errorCode:
          result.errorCode === "NOT_IMPLEMENTED"
            ? "NOT_IMPLEMENTED"
            : "INTERNAL_ERROR",
      };
    }
    if (!result.redirectUrl) {
      return {
        success: false,
        error: "UAE Pass did not return a redirect URL.",
        errorCode: "INTERNAL_ERROR",
      };
    }

    await setUaePassState({
      state: result.applicantId,
      locale: input.locale,
      flow: "verification",
      callbackUrl: safeCallbackPath,
    });

    return { success: true, data: { redirectUrl: result.redirectUrl } };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred initiating UAE Pass.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ---------------------------------------------------------------------------
// Action 3: approveVerificationAction (staff-facing)
// ---------------------------------------------------------------------------

export async function approveVerificationAction(
  input: ApproveVerificationInput,
): Promise<VerificationActionResult<void>> {
  // 1. Auth — staff only. Never .catch() this; redirects to /admin/login on failure.
  const staff = await requireStaffAction("verification:approve");

  // 2. Validate input
  const parsed = approveVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { eventId, note, attestation } = parsed.data;

  // 3. Preload the event
  const event = await db.verificationEvent.findUnique({
    where: { id: eventId },
    select: { id: true, customerId: true, status: true },
  });

  if (!event) {
    return {
      success: false,
      error: "Verification event not found.",
      errorCode: "EVENT_NOT_FOUND",
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);

  // 4. Transaction: update event + customer + audit log
  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.verificationEvent.findUnique({
          where: { id: eventId },
          select: { status: true },
        });

        if (!current || current.status !== "PENDING") {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.verificationEvent.update({
          where: { id: eventId },
          data: {
            status: "APPROVED",
            reviewedAt: now,
            reviewResult: note ?? null,
            reviewedById: staff.id,
          },
        });

        await tx.customer.update({
          where: { id: event.customerId },
          data: {
            verificationStatus: "APPROVED",
            verifiedAt: now,
            verificationExpiresAt: expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "verification.approve",
            entityType: "VerificationEvent",
            entityId: eventId,
            before: { status: "PENDING" } as Prisma.InputJsonValue,
            after: {
              status: "APPROVED",
              reviewedById: staff.id,
              reviewedAt: now.toISOString(),
              attestation,
            } as Prisma.InputJsonValue,
            metadata: { customerId: event.customerId } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This verification event is no longer pending review.",
        errorCode: "INVALID_STATE_TRANSITION",
      };
    }
    return {
      success: false,
      error: "Failed to approve verification. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/verification");

  after(async () => {
    const data = await loadCustomerEmailData(event.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "verification_approved",
      toEmail: data.customerEmail,
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Approved", tone: "success" },
        infoRows: [
          { label: "Customer name", value: data.customerName },
          ...(data.verifiedAt
            ? [{ label: "Approved on", value: data.verifiedAt }]
            : []),
          ...(data.verificationExpiresAt
            ? [{ label: "Valid until", value: data.verificationExpiresAt }]
            : []),
        ],
      }),
    });
  });

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action: overrideApproveVerificationAction (staff-facing, out-of-band evidence)
// ---------------------------------------------------------------------------

export async function overrideApproveVerificationAction(
  input: OverrideApproveVerificationInput,
): Promise<VerificationActionResult<void>> {
  const staff = await requireStaffAction("compliance:override");

  const parsed = overrideApproveVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { eventId, justification, attestation } = parsed.data;

  const event = await db.verificationEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      customerId: true,
      customer: {
        select: { verificationStatus: true, verificationExpiresAt: true },
      },
    },
  });

  if (!event) {
    return {
      success: false,
      error: "Verification event not found.",
      errorCode: "EVENT_NOT_FOUND",
    };
  }

  const isOverrideEligible = (
    status: VerificationStatusProjection["status"],
    expiresAt: Date | null,
  ) =>
    deriveVerificationStatus(status, expiresAt) === "EXPIRED" ||
    status === "REJECTED";

  const oldStatus = event.customer.verificationStatus;

  if (!isOverrideEligible(oldStatus, event.customer.verificationExpiresAt)) {
    return {
      success: false,
      error: "This customer's verification is not expired or rejected.",
      errorCode: "INVALID_STATE_TRANSITION",
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWO_YEARS_MS);

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.customer.findUnique({
          where: { id: event.customerId },
          select: { verificationStatus: true, verificationExpiresAt: true },
        });

        if (
          !current ||
          !isOverrideEligible(
            current.verificationStatus,
            current.verificationExpiresAt,
          )
        ) {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.customer.update({
          where: { id: event.customerId },
          data: {
            verificationStatus: "APPROVED",
            verifiedAt: now,
            verificationExpiresAt: expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "verification.override_approve",
            entityType: "VerificationEvent",
            entityId: eventId,
            before: {
              verificationStatus: oldStatus,
            } as Prisma.InputJsonValue,
            after: {
              verificationStatus: "APPROVED",
              attestation,
              override: true,
            } as Prisma.InputJsonValue,
            metadata: {
              customerId: event.customerId,
              justification,
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This customer's verification is not expired or rejected.",
        errorCode: "INVALID_STATE_TRANSITION",
      };
    }
    return {
      success: false,
      error: "Failed to override verification. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/verification");

  after(async () => {
    const data = await loadCustomerEmailData(event.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "verification_approved",
      toEmail: data.customerEmail,
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Approved", tone: "success" },
        infoRows: [
          { label: "Customer name", value: data.customerName },
          ...(data.verifiedAt
            ? [{ label: "Approved on", value: data.verifiedAt }]
            : []),
          ...(data.verificationExpiresAt
            ? [{ label: "Valid until", value: data.verificationExpiresAt }]
            : []),
        ],
      }),
    });
  });

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 4: rejectVerificationAction
// ---------------------------------------------------------------------------

export async function rejectVerificationAction(
  input: RejectVerificationInput,
): Promise<VerificationActionResult<void>> {
  // 1. Auth — staff only. Never .catch() this; redirects to /admin/login on failure.
  const staff = await requireStaffAction("verification:approve");

  // 2. Validate input
  const parsed = rejectVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { eventId, reason } = parsed.data;

  // 3. Preload the event
  const event = await db.verificationEvent.findUnique({
    where: { id: eventId },
    select: { id: true, customerId: true, status: true },
  });

  if (!event) {
    return {
      success: false,
      error: "Verification event not found.",
      errorCode: "EVENT_NOT_FOUND",
    };
  }

  const now = new Date();

  // 4. Transaction: update event + customer + audit log
  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.verificationEvent.findUnique({
          where: { id: eventId },
          select: { status: true },
        });

        if (!current || current.status !== "PENDING") {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.verificationEvent.update({
          where: { id: eventId },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
            reviewedAt: now,
            reviewedById: staff.id,
          },
        });

        await tx.customer.update({
          where: { id: event.customerId },
          data: {
            verificationStatus: "REJECTED",
            // Do NOT clear verifiedAt / verificationExpiresAt — preserve historical approval
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "verification.reject",
            entityType: "VerificationEvent",
            entityId: eventId,
            before: { status: "PENDING" } as Prisma.InputJsonValue,
            after: {
              status: "REJECTED",
              reviewedById: staff.id,
              reviewedAt: now.toISOString(),
              rejectionReason: reason,
            } as Prisma.InputJsonValue,
            metadata: { customerId: event.customerId } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This verification event is no longer pending review.",
        errorCode: "INVALID_STATE_TRANSITION",
      };
    }
    return {
      success: false,
      error: "Failed to reject verification. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/verification");

  after(async () => {
    const data = await loadCustomerEmailData(event.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "verification_rejected",
      toEmail: data.customerEmail,
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Not approved", tone: "warning" },
        infoRows: [
          { label: "Customer name", value: data.customerName },
          { label: "Reviewed on", value: emailDate(now) },
        ],
        excerpt: { label: "Reason from our team", text: excerpt(reason) },
      }),
    });
  });

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action 5: expireVerificationAction (staff-facing)
// ---------------------------------------------------------------------------

export async function expireVerificationAction(
  input: ExpireVerificationInput,
): Promise<VerificationActionResult<void>> {
  const staff = await requireStaffAction("verification:approve");

  const parsed = expireVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { eventId, reason } = parsed.data;

  const event = await db.verificationEvent.findUnique({
    where: { id: eventId },
    select: { id: true, customerId: true },
  });

  if (!event) {
    return {
      success: false,
      error: "Verification event not found.",
      errorCode: "EVENT_NOT_FOUND",
    };
  }

  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: event.customerId },
          select: { verificationStatus: true, verificationExpiresAt: true },
        });

        if (!customer || customer.verificationStatus !== "APPROVED") {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        if (
          deriveVerificationStatus(
            customer.verificationStatus,
            customer.verificationExpiresAt,
          ) === "EXPIRED"
        ) {
          throw new Error("ALREADY_EXPIRED");
        }

        await tx.customer.update({
          where: { id: event.customerId },
          data: { verificationStatus: "EXPIRED" },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "verification.expire",
            entityType: "VerificationEvent",
            entityId: eventId,
            before: {
              verificationStatus: customer.verificationStatus,
            } as Prisma.InputJsonValue,
            after: {
              verificationStatus: "EXPIRED",
              reason: reason ?? null,
              actedById: staff.id,
              actedAt: now.toISOString(),
            } as Prisma.InputJsonValue,
            metadata: { customerId: event.customerId } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This customer's verification is not currently active.",
        errorCode: "INVALID_STATE_TRANSITION",
      };
    }
    if (err instanceof Error && err.message === "ALREADY_EXPIRED") {
      return {
        success: false,
        error: "This customer's verification has already expired.",
        errorCode: "ALREADY_EXPIRED",
      };
    }
    return {
      success: false,
      error: "Failed to expire verification. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/verification");

  after(async () => {
    const data = await loadCustomerEmailData(event.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "verification_expired",
      toEmail: data.customerEmail,
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Expired", tone: "warning" },
        infoRows: [
          { label: "Customer name", value: data.customerName },
          { label: "Expired on", value: emailDate(now) },
        ],
      }),
    });
  });

  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Action: initiateUaePassLinkAction (customer-facing)
// ---------------------------------------------------------------------------

export type UaePassLinkErrorCode =
  | "UNAUTHENTICATED"
  | "ALREADY_LINKED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export type UaePassLinkResult =
  | { success: true; data: { redirectUrl: string } }
  | { success: false; error: string; errorCode: UaePassLinkErrorCode };

export async function initiateUaePassLinkAction(input: {
  locale: "en" | "ar" | "ru";
}): Promise<UaePassLinkResult> {
  if (!isUaePassEnabled()) {
    return {
      success: false,
      error: "UAE PASS is not available in this environment.",
      errorCode: "NOT_IMPLEMENTED",
    };
  }

  const session = await auth();
  const customerId = await getSessionCustomerId();
  if (session?.user?.principal !== "customer" || !customerId) {
    return {
      success: false,
      error: "You must be signed in to link UAE PASS.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { uaePassUuid: true },
  });
  if (customer?.uaePassUuid) {
    return {
      success: false,
      error: "UAE PASS is already linked to this account.",
      errorCode: "ALREADY_LINKED",
    };
  }

  const provider = getIdentityProvider();
  if (!(provider instanceof UaePassProvider)) {
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "NOT_IMPLEMENTED",
    };
  }

  try {
    const result = await provider.initiateVerification({
      customerId,
      customerEmail: session.user.email ?? "",
      customerName: session.user.name ?? "",
      locale: input.locale,
      redirectUrl: "/account/settings",
    });

    if (!result.success || !result.redirectUrl) {
      return {
        success: false,
        error: "UAE PASS did not return a redirect URL.",
        errorCode: "INTERNAL_ERROR",
      };
    }

    await setUaePassState({
      state: result.applicantId,
      locale: input.locale,
      flow: "link",
      callbackUrl: "/account/settings",
    });

    return { success: true, data: { redirectUrl: result.redirectUrl } };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred initiating UAE PASS.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// ---------------------------------------------------------------------------
// Action: createVerificationDocumentRequestAction (staff-facing)
// ---------------------------------------------------------------------------

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

export type CreateVerificationDocumentRequestErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_ROLES"
  | "EVENT_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "DETAILS_NOT_APPLICABLE"
  | "DUPLICATE_OPEN"
  | "INTERNAL_ERROR";

export type CreateVerificationDocumentRequestResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: CreateVerificationDocumentRequestErrorCode;
    };

export async function createVerificationDocumentRequestAction(
  input: CreateVerificationDocumentRequestInput,
): Promise<CreateVerificationDocumentRequestResult<{ requestId: string }>> {
  // Requesting a document is review work, not approval — SUPPORT must be able to do it.
  const { id: staffId } = await requireStaffAction("verification:review");

  const parsed = createVerificationDocumentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode:
        parsed.error.issues[0]?.path[0] === "roles"
          ? "INVALID_ROLES"
          : "VALIDATION_ERROR",
    };
  }
  const { eventId, scope, roles, message } = parsed.data;

  const event = await db.verificationEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      customerId: true,
      provider: true,
      declaredIdNumber: true,
      declaredAddress: true,
    },
  });

  if (!event) {
    return {
      success: false,
      error: "Verification event not found.",
      errorCode: "EVENT_NOT_FOUND",
    };
  }

  if (event.status !== "PENDING") {
    return {
      success: false,
      error: `Cannot request documents on a ${event.status} verification.`,
      errorCode: "INVALID_STATE_TRANSITION",
    };
  }

  if (
    scope === "DETAILS" &&
    (event.provider !== "MANUAL_REVIEW" ||
      event.declaredIdNumber === null ||
      event.declaredAddress === null)
  ) {
    return {
      success: false,
      error: "Only a manual submission has declared details to correct.",
      errorCode: "DETAILS_NOT_APPLICABLE",
    };
  }

  let requestId: string;
  try {
    requestId = await db.$transaction(
      async (tx) => {
        const current = await tx.verificationEvent.findUnique({
          where: { id: eventId },
          select: {
            status: true,
            provider: true,
            declaredIdNumber: true,
            declaredAddress: true,
          },
        });
        if (!current || current.status !== "PENDING") {
          throw new Error("INVALID_STATE_TRANSITION");
        }
        if (
          scope === "DETAILS" &&
          (current.provider !== "MANUAL_REVIEW" ||
            current.declaredIdNumber === null ||
            current.declaredAddress === null)
        ) {
          throw new Error("DETAILS_NOT_APPLICABLE");
        }

        const request = await tx.verificationDocumentRequest.create({
          data: {
            verificationEventId: eventId,
            scope,
            status: "OPEN",
            roles: scope === "DETAILS" ? [] : roles,
            message,
            requestedById: staffId,
          },
          select: { id: true },
        });

        // metadata.note is deliberate: reasonTextOf reads
        // metadata.reason|justification|note, so the message renders in EntityEventThread.
        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action:
              scope === "DETAILS"
                ? "verification.details_requested"
                : "verification.documents_requested",
            entityType: "VerificationEvent",
            entityId: eventId,
            after: {
              requestId: request.id,
              scope,
              roles: scope === "DETAILS" ? [] : roles,
            } as Prisma.InputJsonValue,
            metadata: {
              note: message,
              requestId: request.id,
              customerId: event.customerId,
            } as Prisma.InputJsonValue,
          },
        });

        return request.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This verification is no longer pending.",
        errorCode: "INVALID_STATE_TRANSITION",
      };
    }
    if (err instanceof Error && err.message === "DETAILS_NOT_APPLICABLE") {
      return {
        success: false,
        error: "Only a manual submission has declared details to correct.",
        errorCode: "DETAILS_NOT_APPLICABLE",
      };
    }
    if (isP2002(err)) {
      return {
        success: false,
        error: "This verification already has an open document request.",
        errorCode: "DUPLICATE_OPEN",
      };
    }
    console.error("[createVerificationDocumentRequestAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/verification/${eventId}`);
  revalidatePath("/", "layout");

  after(async () => {
    const data = await loadCustomerEmailData(event.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey:
        scope === "DETAILS"
          ? "verification_details_requested"
          : "verification_documents_requested",
      toEmail: data.customerEmail,
      payload: { eventId, requestId },
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Action needed", tone: "info" },
        infoRows: [
          {
            label: "Requested on",
            value: formatDisplayDate(new Date().toISOString(), "en"),
          },
        ],
        excerpt: { label: "What we need", text: excerpt(message) },
        ctaUrl:
          scope === "DETAILS"
            ? accountUrl("/verification/details")
            : accountUrl("/verification"),
      }),
    });
  });

  return { success: true, data: { requestId } };
}

// ---------------------------------------------------------------------------
// Action: cancelVerificationDocumentRequestAction (staff-facing)
// ---------------------------------------------------------------------------

export type CancelVerificationDocumentRequestErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

export type CancelVerificationDocumentRequestResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: CancelVerificationDocumentRequestErrorCode;
    };

export async function cancelVerificationDocumentRequestAction(
  input: CancelVerificationDocumentRequestInput,
): Promise<CancelVerificationDocumentRequestResult<{ status: "CANCELLED" }>> {
  const { id: staffId } = await requireStaffAction("verification:review");

  const parsed = cancelVerificationDocumentRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      errorCode: "VALIDATION_ERROR",
    };
  }
  const { requestId } = parsed.data;

  const existing = await db.verificationDocumentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      verificationEventId: true,
      status: true,
      verificationEvent: { select: { customerId: true } },
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

  const eventId = existing.verificationEventId;
  const now = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.verificationDocumentRequest.findUnique({
          where: { id: requestId },
          select: { status: true },
        });
        if (!current || current.status !== "OPEN") {
          throw new Error("INVALID_STATE_TRANSITION");
        }

        await tx.verificationDocumentRequest.update({
          where: { id: requestId },
          data: { status: "CANCELLED", cancelledAt: now },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "verification.request_cancelled",
            entityType: "VerificationEvent",
            entityId: eventId,
            metadata: {
              requestId,
              customerId: existing.verificationEvent.customerId,
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_STATE_TRANSITION") {
      return {
        success: false,
        error: "This document request is no longer open.",
        errorCode: "INVALID_TRANSITION",
      };
    }
    console.error("[cancelVerificationDocumentRequestAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/verification/${eventId}`);
  revalidatePath("/", "layout");

  after(async () => {
    const data = await loadCustomerEmailData(existing.verificationEvent.customerId);
    if (!data) return;
    await logAndSendEmail({
      templateKey: "verification_request_cancelled",
      toEmail: data.customerEmail,
      payload: { eventId, requestId },
      chromeOptions: customerAccountChrome(data, {
        badge: { text: "Request withdrawn", tone: "info" },
        infoRows: [
          {
            label: "Withdrawn on",
            value: formatDisplayDate(new Date().toISOString(), "en"),
          },
        ],
        ctaUrl: accountUrl("/verification"),
      }),
    });
  });

  return { success: true, data: { status: "CANCELLED" } };
}

// ---------------------------------------------------------------------------
// Action: provideVerificationDocumentsAction (customer-facing)
// ---------------------------------------------------------------------------

export type ProvideVerificationDocumentsErrorCode =
  | "DEMO_UPLOADS_DISABLED"
  | "UNAUTHENTICATED"
  | "NO_REQUEST"
  | "NO_FILES_PROVIDED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VALIDATION_ERROR"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

export type ProvideVerificationDocumentsResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: ProvideVerificationDocumentsErrorCode;
    };

export async function provideVerificationDocumentsAction(
  formData: unknown,
): Promise<ProvideVerificationDocumentsResult<{ eventId: string }>> {
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
      error: "You must be signed in to upload documents.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const parsed = provideVerificationDocumentsSchema.safeParse({
    locale: formData.get("locale"),
    roles: formData.getAll("roles"),
    acknowledged: formData.get("acknowledged") === "true",
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const event = await db.verificationEvent.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      documentRequests: {
        where: { status: "OPEN" },
        select: { id: true, roles: true, scope: true },
        take: 1,
      },
    },
  });

  const openRequest = event?.documentRequests[0];
  if (
    !event ||
    !openRequest ||
    event.status !== "PENDING" ||
    openRequest.scope !== "DOCUMENTS"
  ) {
    return {
      success: false,
      error: "There is no open document request on your account.",
      errorCode: "NO_REQUEST",
    };
  }
  const eventId = event.id;
  const requestId = openRequest.id;
  // The authoritative role list is the request's roles, never the client's.
  const requestedRoles = openRequest.roles;

  const files: File[] = [];
  const types: string[] = [];
  for (const role of requestedRoles) {
    const file = formData.get(`doc.${role}.file`);
    if (!(file instanceof File) || file.size === 0) {
      return {
        success: false,
        error: "Every requested document must include a file.",
        errorCode: "NO_FILES_PROVIDED",
      };
    }
    const type =
      role === VerificationDocumentRole.PHOTO
        ? ROLE_ALLOWED_TYPES.PHOTO[0]
        : formData.get(`doc.${role}.type`);
    if (
      typeof type !== "string" ||
      !(ROLE_ALLOWED_TYPES[role] as readonly string[]).includes(type)
    ) {
      return {
        success: false,
        error: "Please check the form and try again.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    files.push(file);
    types.push(type);
  }

  const detectedTypes: string[] = [];
  for (let i = 0; i < requestedRoles.length; i++) {
    const role = requestedRoles[i];
    const file = files[i];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${file.name}" exceeds the 5 MB size limit.`,
        errorCode: "FILE_TOO_LARGE",
      };
    }
    const detectedType = await detectMimeType(file);
    if (detectedType === null || detectedType !== file.type) {
      return {
        success: false,
        error: `File "${file.name}" has an unsupported type. Allowed: JPEG, PNG, PDF.`,
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    if (
      role === VerificationDocumentRole.PHOTO &&
      !detectedType.startsWith("image/")
    ) {
      return {
        success: false,
        error: "Your photo must be a JPEG or PNG image, not a PDF.",
        errorCode: "INVALID_FILE_TYPE",
      };
    }
    detectedTypes.push(detectedType);
  }

  const verificationContent = await getSetting("verification_content");
  const acknowledgmentText =
    verificationContent[parsed.data.locale].acknowledgment.trim();
  if (acknowledgmentText.length > 0 && parsed.data.acknowledged !== true) {
    return {
      success: false,
      error: "You must accept the acknowledgment to continue.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const submittedAt = new Date();

  const storageKeys: string[] = [];
  try {
    for (let i = 0; i < requestedRoles.length; i++) {
      const role = requestedRoles[i];
      const file = files[i];
      const filename = `${role}_${sanitizeFilename(i, file.name)}`;
      const path = `${customerId}/${eventId}/${submittedAt.getTime()}/${filename}`;

      const result = await uploadFile({
        bucket: VERIFICATION_DOCS_BUCKET,
        path,
        file,
        contentType: detectedTypes[i],
      });
      storageKeys.push(result.storageKey);
    }
  } catch {
    for (const key of storageKeys) {
      try {
        await deleteFile(VERIFICATION_DOCS_BUCKET, key);
      } catch {
        // best-effort
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
        const current = await tx.verificationDocumentRequest.findUnique({
          where: { id: requestId },
          select: {
            status: true,
            scope: true,
            verificationEvent: { select: { status: true } },
          },
        });
        if (
          !current ||
          current.status !== "OPEN" ||
          current.scope !== "DOCUMENTS" ||
          current.verificationEvent.status !== "PENDING"
        ) {
          throw new Error("NO_REQUEST");
        }

        await tx.verificationDocument.updateMany({
          where: {
            verificationEventId: eventId,
            role: { in: requestedRoles },
            supersededAt: null,
          },
          data: { supersededAt: submittedAt },
        });

        await tx.verificationDocument.createMany({
          data: requestedRoles.map((role, i) => ({
            verificationEventId: eventId,
            role,
            type: types[i] as VerificationDocumentType,
            filename: files[i].name,
            storageKey: storageKeys[i],
            mimeType: detectedTypes[i],
            sizeBytes: files[i].size,
            requestId,
          })),
        });

        await tx.verificationDocumentRequest.update({
          where: { id: requestId },
          data: { status: "FULFILLED", fulfilledAt: submittedAt },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "verification.documents_provided",
            entityType: "VerificationEvent",
            entityId: eventId,
            after: {
              requestId,
              documents: requestedRoles.map((role, i) => ({
                role,
                type: types[i],
              })),
            } as Prisma.InputJsonValue,
            metadata: {
              requestId,
              customerId,
              acknowledgmentText,
              acknowledgedAt: submittedAt.toISOString(),
              locale: parsed.data.locale,
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    for (const key of storageKeys) {
      try {
        await deleteFile(VERIFICATION_DOCS_BUCKET, key);
      } catch {
        // best-effort
      }
    }
    if (err instanceof Error && err.message === "NO_REQUEST") {
      return {
        success: false,
        error: "There is no open document request on your account.",
        errorCode: "NO_REQUEST",
      };
    }
    console.error("[provideVerificationDocumentsAction]", err);
    return {
      success: false,
      error: "Failed to save documents. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");

  const documentNames = requestedRoles
    .map(
      (role) =>
        ({
          IDENTITY: "Identity document",
          PROOF_OF_ADDRESS: "Proof of address",
          PHOTO: "Photo",
        })[role],
    )
    .join(", ");
  after(async () => {
    const { support: supportRecipients } = await getSetting("email_recipients");
    const data = await loadCustomerEmailData(customerId);
    if (!data) return;
    for (const toEmail of supportRecipients) {
      await logAndSendEmail({
        templateKey: "verification_documents_provided",
        toEmail,
        payload: { eventId, requestId },
        chromeOptions: {
          badges: [{ text: "Documents received", tone: "info" }],
          infoRows: [
            {
              label: "Customer",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            { label: "Documents", value: documentNames },
          ],
          ctaUrl: adminUrl(`/verification/${eventId}`),
          transparencyNote: STAFF_SUPPORT_NOTE,
        },
      });
    }
  });

  return { success: true, data: { eventId } };
}

// ---------------------------------------------------------------------------
// Action: updateVerificationDetailsAction (customer-facing)
// ---------------------------------------------------------------------------

export type UpdateVerificationDetailsErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "NO_REQUEST"
  | "NO_CHANGES"
  | "INTERNAL_ERROR";

export type UpdateVerificationDetailsResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      errorCode: UpdateVerificationDetailsErrorCode;
    };

export async function updateVerificationDetailsAction(
  formData: unknown,
): Promise<UpdateVerificationDetailsResult<{ eventId: string }>> {
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
      error: "You must be signed in to update your details.",
      errorCode: "UNAUTHENTICATED",
    };
  }

  const parsed = updateVerificationDetailsSchema.safeParse({
    locale: formData.get("locale"),
    acknowledged: formData.get("acknowledged") === "true",
    declaredIdNumber: formData.get("declaredIdNumber"),
    declaredAddress: formData.get("declaredAddress"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid form data.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const event = await db.verificationEvent.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      declaredIdNumber: true,
      declaredAddress: true,
      acknowledgedAt: true,
      documentRequests: {
        where: { status: "OPEN" },
        select: { id: true, scope: true },
        take: 1,
      },
    },
  });

  const openRequest = event?.documentRequests[0];
  if (
    !event ||
    !openRequest ||
    openRequest.scope !== "DETAILS" ||
    event.status !== "PENDING"
  ) {
    return {
      success: false,
      error: "There is no open request to update your details.",
      errorCode: "NO_REQUEST",
    };
  }
  const eventId = event.id;
  const requestId = openRequest.id;

  const storedIdNumber = event.declaredIdNumber ?? "";
  const storedAddress = event.declaredAddress ?? "";
  if (
    parsed.data.declaredIdNumber === storedIdNumber &&
    parsed.data.declaredAddress === storedAddress
  ) {
    return {
      success: false,
      error: "Change at least one detail before submitting.",
      errorCode: "NO_CHANGES",
    };
  }

  const verificationContent = await getSetting("verification_content");
  const acknowledgmentText =
    verificationContent[parsed.data.locale].acknowledgment.trim();
  if (acknowledgmentText.length > 0 && parsed.data.acknowledged !== true) {
    return {
      success: false,
      error: "You must accept the acknowledgment to continue.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const submittedAt = new Date();

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.verificationDocumentRequest.findUnique({
          where: { id: requestId },
          select: {
            status: true,
            scope: true,
            verificationEvent: { select: { status: true } },
          },
        });
        if (
          !current ||
          current.status !== "OPEN" ||
          current.scope !== "DETAILS" ||
          current.verificationEvent.status !== "PENDING"
        ) {
          throw new Error("NO_REQUEST");
        }

        await tx.verificationEvent.update({
          where: { id: eventId },
          data: {
            declaredIdNumber: parsed.data.declaredIdNumber,
            declaredAddress: parsed.data.declaredAddress,
            acknowledgmentText:
              acknowledgmentText.length > 0 ? acknowledgmentText : null,
            acknowledgedAt: acknowledgmentText.length > 0 ? submittedAt : null,
          },
        });

        await tx.verificationDocumentRequest.update({
          where: { id: requestId },
          data: { status: "FULFILLED", fulfilledAt: submittedAt },
        });

        await tx.auditLog.create({
          data: {
            actorType: "CUSTOMER",
            actorId: customerId,
            action: "verification.details_updated",
            entityType: "VerificationEvent",
            entityId: eventId,
            before: {
              declaredIdNumber: event.declaredIdNumber,
              declaredAddress: event.declaredAddress,
              acknowledgedAt: event.acknowledgedAt
                ? event.acknowledgedAt.toISOString()
                : null,
            } as Prisma.InputJsonValue,
            after: {
              declaredIdNumber: parsed.data.declaredIdNumber,
              declaredAddress: parsed.data.declaredAddress,
              acknowledgedAt:
                acknowledgmentText.length > 0
                  ? submittedAt.toISOString()
                  : null,
            } as Prisma.InputJsonValue,
            metadata: {
              requestId,
              customerId,
              acknowledgmentText,
              acknowledgedAt: submittedAt.toISOString(),
              locale: parsed.data.locale,
            } as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NO_REQUEST") {
      return {
        success: false,
        error: "There is no open request to update your details.",
        errorCode: "NO_REQUEST",
      };
    }
    console.error("[updateVerificationDetailsAction]", err);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/", "layout");

  const changedFields = [
    parsed.data.declaredIdNumber !== storedIdNumber ? "ID number" : null,
    parsed.data.declaredAddress !== storedAddress ? "Address" : null,
  ].filter((v): v is string => v !== null);

  after(async () => {
    const { support: supportRecipients } = await getSetting("email_recipients");
    const data = await loadCustomerEmailData(customerId);
    if (!data) return;
    for (const toEmail of supportRecipients) {
      await logAndSendEmail({
        templateKey: "verification_details_updated",
        toEmail,
        payload: { eventId, requestId },
        chromeOptions: {
          badges: [{ text: "Details updated", tone: "info" }],
          infoRows: [
            {
              label: "Customer",
              value: data.customerName
                ? `${data.customerName} · ${data.customerEmail}`
                : data.customerEmail,
            },
            { label: "Changed", value: changedFields.join(", ") },
          ],
          ctaUrl: adminUrl(`/verification/${eventId}`),
          transparencyNote: STAFF_SUPPORT_NOTE,
        },
      });
    }
  });

  return { success: true, data: { eventId } };
}
