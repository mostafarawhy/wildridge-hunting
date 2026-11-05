import type {
  VerificationDocumentRole,
  VerificationDocumentType,
} from "@/app/generated/prisma/enums";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

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
