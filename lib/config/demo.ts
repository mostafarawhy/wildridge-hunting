import type { StaffRole } from "@/app/generated/prisma/client";
import type { VerificationDocumentRole } from "@/app/generated/prisma/enums";
import type { StaffPermission } from "@/lib/utils/staff-permissions";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export const DEMO_RESTRICTED_MESSAGE = "This action is disabled in the demo";
export const DEMO_UPLOAD_MESSAGE = "File uploads are disabled in the demo";

export const DEMO_UPLOAD_BUCKETS: readonly string[] = [
  "product-images",
  "site-media",
];

export const DEMO_BLOCKED_PERMISSIONS: readonly StaffPermission[] = [
  "staff:manage",
  "settings:manage",
  "shipping:manage",
  "catalog:import",
];

export const DEMO_GRANTED_PERMISSIONS: readonly StaffPermission[] = [
  "order:mark_paid",
  "loyalty:manage",
  "content:manage",
];

export type DemoGateToken = StaffPermission | "delete" | "upload";

export function isDemoRestricted(role: StaffRole): boolean {
  return isDemoMode() && role !== "SUPER_ADMIN";
}

export function demoBlocks(role: StaffRole, token: DemoGateToken): boolean {
  if (!isDemoRestricted(role)) return false;
  if (token === "delete" || token === "upload") return true;
  return DEMO_BLOCKED_PERMISSIONS.includes(token);
}

export const DEMO_PLACEHOLDER_DOCUMENT = {
  filename: "sample-document.png",
  mimeType: "image/png",
  key: "demo/sample-document.png",
} as const;

export const DEMO_SAMPLES_FIELD = "demoSamples";

export interface DemoSampleDocument {
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

export const DEMO_VERIFICATION_SAMPLES = {
  IDENTITY: { filename: "sample-id.png", storageKey: "seed/sample-id.png", mimeType: "image/png", sizeBytes: 15475 },
  PROOF_OF_ADDRESS: { filename: "sample-address.png", storageKey: "seed/sample-address.png", mimeType: "image/png", sizeBytes: 18127 },
  PHOTO: { filename: "sample-photo.png", storageKey: "seed/sample-photo.png", mimeType: "image/png", sizeBytes: 15332 },
} as const satisfies Record<VerificationDocumentRole, DemoSampleDocument>;

export const DEMO_B2B_SAMPLES = {
  TRADE_LICENSE: { filename: "sample-trade-licence.png", storageKey: "seed/sample-trade-licence.png", mimeType: "image/png", sizeBytes: 16855 },
  VAT_CERTIFICATE: { filename: "sample-vat-certificate.png", storageKey: "seed/sample-vat-certificate.png", mimeType: "image/png", sizeBytes: 16807 },
  COMPANY_ID: { filename: "sample-document.png", storageKey: "seed/sample-document.png", mimeType: "image/png", sizeBytes: 13871 },
  OTHER: { filename: "sample-document.png", storageKey: "seed/sample-document.png", mimeType: "image/png", sizeBytes: 13871 },
} as const satisfies Record<"TRADE_LICENSE" | "VAT_CERTIFICATE" | "COMPANY_ID" | "OTHER", DemoSampleDocument>;

export function demoUploadRefusal<T>(): T {
  return {
    success: false,
    error: DEMO_UPLOAD_MESSAGE,
    errorCode: "DEMO_UPLOADS_DISABLED",
  } as unknown as T;
}
