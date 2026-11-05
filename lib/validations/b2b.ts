import { z } from "zod";

import { ALLOWED_MIME_TYPES, MAX_B2B_FILES, MAX_FILE_SIZE_BYTES } from "@/lib/utils/b2b-limits";

export { ALLOWED_MIME_TYPES, MAX_B2B_FILES, MAX_FILE_SIZE_BYTES };

export const b2bRegistrationSchema = z.object({
  companyNameEn: z
    .string()
    .trim()
    .min(1, "Company name (English) is required.")
    .max(200, "Company name must not exceed 200 characters."),
  companyNameAr: z
    .string()
    .trim()
    .max(200, "Company name (Arabic) must not exceed 200 characters.")
    .nullable()
    .optional(),
  tradeLicenseNo: z
    .string()
    .trim()
    .min(1, "Trade license number is required.")
    .max(100, "Trade license number must not exceed 100 characters."),
  vatNumber: z
    .string()
    .trim()
    .max(100, "VAT number must not exceed 100 characters.")
    .nullable()
    .optional(),
  contactName: z
    .string()
    .trim()
    .min(1, "Contact name is required.")
    .max(200, "Contact name must not exceed 200 characters."),
  contactPhone: z
    .string()
    .trim()
    .regex(
      /^(\+971\d{9}|0\d{9})$/,
      "Phone must be a valid UAE number (+971XXXXXXXXX or 0XXXXXXXXX).",
    ),
});

export type B2BRegistrationInput = z.infer<typeof b2bRegistrationSchema>;

// ---------------------------------------------------------------------------
// approveB2BSchema
// ---------------------------------------------------------------------------

export const approveB2BSchema = z.object({
  accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
  attestation: z.object({
    licenseMatches: z.literal(true),
    companyMatches: z.literal(true),
    documentsAuthentic: z.literal(true),
  }),
});

export type ApproveB2BInput = z.infer<typeof approveB2BSchema>;

// ---------------------------------------------------------------------------
// overrideApproveB2BSchema
// ---------------------------------------------------------------------------

export const overrideApproveB2BSchema = z.object({
  accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
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

export type OverrideApproveB2BInput = z.infer<typeof overrideApproveB2BSchema>;

// ---------------------------------------------------------------------------
// rejectB2BSchema
// ---------------------------------------------------------------------------

export const rejectB2BSchema = z.object({
  accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "A rejection reason is required." })
    .max(500, { message: "Rejection reason must not exceed 500 characters." }),
});

export type RejectB2BInput = z.infer<typeof rejectB2BSchema>;

// ---------------------------------------------------------------------------
// suspendB2BSchema
// ---------------------------------------------------------------------------

export const suspendB2BSchema = z.object({
  accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "A suspension reason is required." })
    .max(500, { message: "Suspension reason must not exceed 500 characters." }),
});

export type SuspendB2BInput = z.infer<typeof suspendB2BSchema>;

// ---------------------------------------------------------------------------
// expireB2BSchema
// ---------------------------------------------------------------------------

export const expireB2BSchema = z.object({
  accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "An expiry reason is required." })
    .max(500, { message: "Expiry reason must not exceed 500 characters." }),
});

export type ExpireB2BInput = z.infer<typeof expireB2BSchema>;

// ---------------------------------------------------------------------------
// b2bRenewalSchema
// ---------------------------------------------------------------------------

export const b2bRenewalDocumentSchema = z.object({
  type: z.enum(["TRADE_LICENSE", "VAT_CERTIFICATE", "COMPANY_ID", "OTHER"]),
  declaredNumber: z.string().trim().max(100).nullable(),
  label: z.string().trim().max(100).nullable(),
});

export const b2bRenewalSchema = z
  .object({
    locale: z.enum(["en", "ar", "ru"]),
    acknowledged: z.boolean(),
    documents: z.array(b2bRenewalDocumentSchema).min(1).max(MAX_B2B_FILES),
  })
  .superRefine((data, ctx) => {
    const tradeLicenseCount = data.documents.filter(
      (doc) => doc.type === "TRADE_LICENSE",
    ).length;
    if (tradeLicenseCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one trade licence document is required.",
        path: ["documents"],
      });
    }
    data.documents.forEach((doc, index) => {
      if (doc.type === "OTHER" && !doc.label) {
        ctx.addIssue({
          code: "custom",
          message: "Give each additional document a name.",
          path: ["documents", index, "label"],
        });
      }
    });
  });

export type B2BRenewalDocumentInput = z.infer<
  typeof b2bRenewalDocumentSchema
>;
export type B2BRenewalInput = z.infer<typeof b2bRenewalSchema>;

// ---------------------------------------------------------------------------
// b2bRegistrationDocumentsSchema
// ---------------------------------------------------------------------------

export const b2bRegistrationDocumentSchema = z.object({
  type: z.enum(["TRADE_LICENSE", "VAT_CERTIFICATE", "COMPANY_ID", "OTHER"]),
  declaredNumber: z.string().trim().max(100).nullable(),
  label: z.string().trim().max(100).nullable(),
});

export const b2bRegistrationDocumentsSchema = z
  .object({
    documents: z.array(b2bRegistrationDocumentSchema).min(1).max(MAX_B2B_FILES),
  })
  .superRefine((data, ctx) => {
    const tradeLicenseCount = data.documents.filter(
      (doc) => doc.type === "TRADE_LICENSE",
    ).length;
    if (tradeLicenseCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one trade licence document is required.",
        path: ["documents"],
      });
    }
    data.documents.forEach((doc, index) => {
      if (doc.type === "OTHER" && !doc.label) {
        ctx.addIssue({
          code: "custom",
          message: "Give each additional document a name.",
          path: ["documents", index, "label"],
        });
      }
    });
  });

export type B2BRegistrationDocumentInput = z.infer<
  typeof b2bRegistrationDocumentSchema
>;
export type B2BRegistrationDocumentsInput = z.infer<
  typeof b2bRegistrationDocumentsSchema
>;

// ---------------------------------------------------------------------------
// b2bDocumentRequestMessageSchema
// ---------------------------------------------------------------------------

export const REQUESTABLE_B2B_DOCUMENT_TYPES = [
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "COMPANY_ID",
  "OTHER",
] as const;

export const b2bDocumentRequestMessageSchema = z
  .object({
    scope: z.enum(["DOCUMENTS", "DETAILS"]),
    accountId: z.string().min(1, { message: "Invalid B2B account ID." }),
    message: z
      .string()
      .trim()
      .min(10, {
        message: "Describe what you need in at least 10 characters.",
      })
      .max(500, { message: "Message must not exceed 500 characters." }),
    types: z.array(z.enum(REQUESTABLE_B2B_DOCUMENT_TYPES)).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "DOCUMENTS" && data.types.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one document to request.",
        path: ["types"],
      });
    }
    if (data.scope === "DETAILS" && data.types.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Business details requests cannot name documents.",
        path: ["types"],
      });
    }
  });

export type B2BDocumentRequestMessageInput = z.infer<
  typeof b2bDocumentRequestMessageSchema
>;

// ---------------------------------------------------------------------------
// cancelB2BDocumentRequestSchema
// ---------------------------------------------------------------------------

export const cancelB2BDocumentRequestSchema = z.object({
  requestId: z.string().min(1, { message: "Invalid request ID." }),
});

export type CancelB2BDocumentRequestInput = z.infer<
  typeof cancelB2BDocumentRequestSchema
>;

// ---------------------------------------------------------------------------
// b2bProvideDocumentsSchema
// ---------------------------------------------------------------------------

export const b2bProvideDocumentSchema = z.object({
  type: z.enum(["TRADE_LICENSE", "VAT_CERTIFICATE", "COMPANY_ID", "OTHER"]),
  declaredNumber: z.string().trim().max(100).nullable(),
  label: z.string().trim().max(100).nullable(),
});

export const b2bProvideDocumentsSchema = z
  .object({
    locale: z.enum(["en", "ar", "ru"]),
    acknowledged: z.boolean(),
    documents: z.array(b2bProvideDocumentSchema).min(1).max(MAX_B2B_FILES),
  })
  .superRefine((data, ctx) => {
    data.documents.forEach((doc, index) => {
      if (doc.type === "OTHER" && !doc.label) {
        ctx.addIssue({
          code: "custom",
          message: "Give each additional document a name.",
          path: ["documents", index, "label"],
        });
      }
    });
  });

export type B2BProvideDocumentInput = z.infer<typeof b2bProvideDocumentSchema>;
export type B2BProvideDocumentsInput = z.infer<
  typeof b2bProvideDocumentsSchema
>;

// ---------------------------------------------------------------------------
// b2bUpdateDetailsSchema
// ---------------------------------------------------------------------------

export const b2bUpdateDetailsSchema = z.object({
  locale: z.enum(["en", "ar", "ru"]),
  acknowledged: z.boolean(),
  companyNameEn: z
    .string()
    .trim()
    .min(1, "Company name (English) is required.")
    .max(200, "Company name must not exceed 200 characters."),
  companyNameAr: z
    .string()
    .trim()
    .max(200, "Company name (Arabic) must not exceed 200 characters.")
    .nullable(),
  tradeLicenseNo: z
    .string()
    .trim()
    .min(1, "Trade license number is required.")
    .max(100, "Trade license number must not exceed 100 characters."),
  vatNumber: z
    .string()
    .trim()
    .max(100, "VAT number must not exceed 100 characters.")
    .nullable(),
  contactName: z
    .string()
    .trim()
    .min(1, "Contact name is required.")
    .max(200, "Contact name must not exceed 200 characters."),
  contactPhone: z
    .string()
    .trim()
    .regex(
      /^(\+971\d{9}|0\d{9})$/,
      "Phone must be a valid UAE number (+971XXXXXXXXX or 0XXXXXXXXX).",
    ),
});

export type B2BUpdateDetailsInput = z.infer<typeof b2bUpdateDetailsSchema>;

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
