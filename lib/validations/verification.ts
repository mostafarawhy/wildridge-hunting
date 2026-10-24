import { z } from "zod";
import type {
  VerificationDocumentRole,
  VerificationDocumentType,
} from "@/app/generated/prisma/enums";

// ---------------------------------------------------------------------------
// File validation constants
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

// ---------------------------------------------------------------------------
// ROLE_ALLOWED_TYPES — valid document types per role
// ---------------------------------------------------------------------------

export const ROLE_ALLOWED_TYPES = {
  IDENTITY: ["EMIRATES_ID", "PASSPORT"],
  PROOF_OF_ADDRESS: [
    "UTILITY_BILL",
    "TENANCY_CONTRACT",
    "RESIDENCE_VISA",
    "DRIVING_LICENSE",
    "BANK_STATEMENT",
  ],
  PHOTO: ["SELFIE"],
} as const satisfies Record<
  VerificationDocumentRole,
  readonly [VerificationDocumentType, ...VerificationDocumentType[]]
>;

// ---------------------------------------------------------------------------
// manualUploadSubmissionSchema
// (validates non-file fields from FormData — files are validated in the action)
// ---------------------------------------------------------------------------

export const manualUploadSubmissionSchema = z.object({
  identityType: z.enum(ROLE_ALLOWED_TYPES.IDENTITY, {
    message: "Identity document type must be one of: Emirates ID, Passport.",
  }),
  proofOfAddressType: z.enum(ROLE_ALLOWED_TYPES.PROOF_OF_ADDRESS, {
    message:
      "Proof of address type must be one of: Utility Bill, Tenancy Contract, Residence Visa, Driving License, Bank Statement.",
  }),
  notes: z
    .string()
    .max(500, { message: "Notes must not exceed 500 characters." })
    .optional(),
  declaredIdNumber: z
    .string()
    .trim()
    .min(1, { message: "ID number is required." })
    .max(50, { message: "ID number must not exceed 50 characters." }),
  declaredAddress: z
    .string()
    .trim()
    .min(1, { message: "Address is required." })
    .max(200, { message: "Address must not exceed 200 characters." }),
  locale: z.enum(["en", "ar", "ru"]),
  acknowledged: z.boolean(),
});

export type ManualUploadSubmissionInput = z.infer<
  typeof manualUploadSubmissionSchema
>;

// ---------------------------------------------------------------------------
// approveVerificationSchema
// ---------------------------------------------------------------------------

export const approveVerificationSchema = z.object({
  eventId: z.string().min(1, { message: "Invalid verification event ID." }),
  note: z
    .string()
    .max(500, { message: "Note must not exceed 500 characters." })
    .optional(),
  attestation: z.object({
    idMatches: z.literal(true),
    addressMatches: z.literal(true),
    nameMatches: z.literal(true),
  }),
});

export type ApproveVerificationInput = z.infer<
  typeof approveVerificationSchema
>;

// ---------------------------------------------------------------------------
// overrideApproveVerificationSchema
// ---------------------------------------------------------------------------

export const overrideApproveVerificationSchema = z.object({
  eventId: z.string().min(1, { message: "Invalid verification event ID." }),
  justification: z
    .string()
    .trim()
    .min(20, {
      message:
        "Describe the evidence obtained outside this system (minimum 20 characters).",
    })
    .max(1000, { message: "Justification must not exceed 1000 characters." }),
  attestation: z.object({
    evidenceObtained: z.literal(true),
    responsibilityAccepted: z.literal(true),
    overrideAcknowledged: z.literal(true),
  }),
});

export type OverrideApproveVerificationInput = z.infer<
  typeof overrideApproveVerificationSchema
>;

// ---------------------------------------------------------------------------
// rejectVerificationSchema
// ---------------------------------------------------------------------------

export const rejectVerificationSchema = z.object({
  eventId: z.string().min(1, { message: "Invalid verification event ID." }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "Rejection reason is required." })
    .max(500, { message: "Rejection reason must not exceed 500 characters." }),
});

export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;

// ---------------------------------------------------------------------------
// expireVerificationSchema
// ---------------------------------------------------------------------------

export const expireVerificationSchema = z.object({
  eventId: z.string().min(1, { message: "Invalid verification event ID." }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "An expiry reason is required." })
    .max(500, { message: "Reason must not exceed 500 characters." }),
});

export type ExpireVerificationInput = z.infer<typeof expireVerificationSchema>;

// ---------------------------------------------------------------------------
// createVerificationDocumentRequestSchema
// ---------------------------------------------------------------------------

export const createVerificationDocumentRequestSchema = z
  .object({
    eventId: z.string().min(1, { message: "Invalid verification event ID." }),
    scope: z.enum(["DOCUMENTS", "DETAILS"]),
    roles: z.array(z.enum(["IDENTITY", "PROOF_OF_ADDRESS", "PHOTO"])),
    message: z
      .string()
      .trim()
      .min(10, {
        message: "Describe what you need in at least 10 characters.",
      })
      .max(500, { message: "Message must not exceed 500 characters." }),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "DOCUMENTS" && data.roles.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one document to request.",
        path: ["roles"],
      });
    }
    if (data.scope === "DETAILS" && data.roles.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Details requests cannot name documents.",
        path: ["roles"],
      });
    }
  });
export type CreateVerificationDocumentRequestInput = z.infer<
  typeof createVerificationDocumentRequestSchema
>;

// ---------------------------------------------------------------------------
// cancelVerificationDocumentRequestSchema
// ---------------------------------------------------------------------------

export const cancelVerificationDocumentRequestSchema = z.object({
  requestId: z.string().min(1, { message: "Invalid request ID." }),
});
export type CancelVerificationDocumentRequestInput = z.infer<
  typeof cancelVerificationDocumentRequestSchema
>;

// ---------------------------------------------------------------------------
// provideVerificationDocumentsSchema
// ---------------------------------------------------------------------------

export const provideVerificationDocumentsSchema = z.object({
  locale: z.enum(["en", "ar", "ru"]),
  roles: z
    .array(z.enum(["IDENTITY", "PROOF_OF_ADDRESS", "PHOTO"]))
    .min(1, { message: "No documents were requested." }),
  acknowledged: z.boolean(),
});
export type ProvideVerificationDocumentsInput = z.infer<
  typeof provideVerificationDocumentsSchema
>;

// ---------------------------------------------------------------------------
// updateVerificationDetailsSchema
// ---------------------------------------------------------------------------

export const updateVerificationDetailsSchema = z.object({
  locale: z.enum(["en", "ar", "ru"]),
  acknowledged: z.boolean(),
  declaredIdNumber: z
    .string()
    .trim()
    .min(1, { message: "ID number is required." })
    .max(50, { message: "ID number must not exceed 50 characters." }),
  declaredAddress: z
    .string()
    .trim()
    .min(1, { message: "Address is required." })
    .max(200, { message: "Address must not exceed 200 characters." }),
});
export type UpdateVerificationDetailsInput = z.infer<
  typeof updateVerificationDetailsSchema
>;

// ---------------------------------------------------------------------------
// detectMimeType — magic-byte sniffing (do not trust file.type)
// ---------------------------------------------------------------------------

export async function detectMimeType(
  file: File,
): Promise<(typeof ALLOWED_MIME_TYPES)[number] | null> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }

  return null;
}
