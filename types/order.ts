// Snapshot shapes persisted to JSON columns on Order.
// Used by checkout actions, order detail pages, admin, and email templates.

import type { Prisma } from "@/app/generated/prisma/client";
import type {
  VerificationDocumentRole,
  VerificationDocumentType,
  B2BStatus,
  DocumentType,
} from "@/app/generated/prisma/enums";

/**
 * Snapshot of the shipping address at the time an order was placed.
 * Persisted to Order.shippingAddressSnapshot (Json column).
 * Index signature required to satisfy Prisma.InputJsonValue.
 */
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  emirate: string;
  postalCode: string | null;
  country: string;
  label: string | null;
  [key: string]: Prisma.InputJsonValue | null;
}

/**
 * Snapshot of the shipping method at the time an order was placed.
 * Persisted to Order.shippingMethodSnapshot (Json column).
 */
export interface ShippingMethodSnapshot {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string;
  priceAed: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  [key: string]: Prisma.InputJsonValue;
}

/**
 * A single verification document as recorded on the compliance snapshot.
 * Persisted to Order.complianceSnapshot (Json column).
 * Index signature required to satisfy Prisma.InputJsonValue.
 */
export interface ComplianceDocumentSnapshot {
  storageKey: string;
  role: VerificationDocumentRole;
  type: VerificationDocumentType;
  filename: string;
  mimeType: string;
  [key: string]: Prisma.InputJsonValue;
}

/**
 * A single B2B document as recorded on the compliance snapshot.
 * Persisted to Order.complianceSnapshot (Json column).
 * Index signature required to satisfy Prisma.InputJsonValue.
 */
export interface ComplianceB2BDocumentSnapshot {
  storageKey: string;
  type: DocumentType;
  filename: string;
  mimeType: string | null;
  declaredNumber: string | null;
  [key: string]: Prisma.InputJsonValue | null;
}

/**
 * Verification standing as recorded on the compliance snapshot.
 * Index signature required to satisfy Prisma.InputJsonValue.
 */
export interface ComplianceVerificationSnapshot {
  eventId: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  verifiedAt: string | null;
  expiresAt: string | null;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  documents: ComplianceDocumentSnapshot[];
  [key: string]: Prisma.InputJsonValue | null;
}

/**
 * B2B standing as recorded on the compliance snapshot.
 * Index signature required to satisfy Prisma.InputJsonValue.
 */
export interface ComplianceB2BSnapshot {
  accountId: string;
  status: B2BStatus;
  tradeLicenseNo: string;
  documents: ComplianceB2BDocumentSnapshot[];
  [key: string]: Prisma.InputJsonValue;
}

/**
 * Snapshot of the customer's verification and B2B compliance standing at
 * the moment an order was placed. Persisted to Order.complianceSnapshot
 * (Json column) — never joined, since documents cascade-delete under the
 * five-year purge and a join would leave inspected orders with an empty
 * compliance record.
 * verification is null when the order needed no verification (no restricted
 * SKUs and no verification event). b2b is null for B2C customers.
 */
export interface ComplianceSnapshot {
  snapshotAt: string;
  verification: ComplianceVerificationSnapshot | null;
  b2b: ComplianceB2BSnapshot | null;
  restrictedSkus: string[];
  [key: string]: Prisma.InputJsonValue | null;
}
