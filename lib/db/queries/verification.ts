import "server-only";

import { db } from "@/lib/db/client";
import { toISOString, nowISO, dubaiDayBoundsUtc } from "@/lib/utils/date";
import type {
  VerificationDocumentRole,
  VerificationDocumentType,
} from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ComplianceSnapshot } from "@/types/order";

/** Window before expiry where we prompt the user to renew (30 days). */
const RENEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Projection interfaces (co-located)
// ---------------------------------------------------------------------------

export interface VerificationDocumentProjection {
  id: string;
  role: VerificationDocumentRole;
  type: VerificationDocumentType;
  filename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string; // ISO
  supersededAt: string | null; // ISO
  requestId: string | null;
}

export interface VerificationEventProjection {
  id: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  reviewedAt: string | null; // ISO
  createdAt: string; // ISO
  acknowledgedAt: string | null; // ISO
}

export interface VerificationStatusProjection {
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  verifiedAt: string | null; // ISO
  expiryPassed?: boolean;
  expiresAt: string | null; // ISO
  /** True if verification expires within 30 days. Computed server-side to keep components pure. */
  nearExpiry: boolean;
  latestEvent: VerificationEventProjection | null;
  openRequest: {
    id: string;
    scope: "DOCUMENTS" | "DETAILS";
    message: string;
    roles: VerificationDocumentRole[];
    createdAt: string;
  } | null;
}

export function deriveVerificationStatus(
  stored: VerificationStatusProjection["status"],
  expiresAt: Date | null,
): VerificationStatusProjection["status"] {
  const expired = expiresAt != null && expiresAt.getTime() < Date.now();
  return expired && stored === "APPROVED" ? "EXPIRED" : stored;
}

// ---------------------------------------------------------------------------
// getCustomerVerificationStatus
// ---------------------------------------------------------------------------

export async function getCustomerVerificationStatus(
  customerId: string,
): Promise<VerificationStatusProjection | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      verificationStatus: true,
      verifiedAt: true,
      verificationExpiresAt: true,
    },
  });

  if (!customer) return null;

  const latestEvent = await db.verificationEvent.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      status: true,
      rejectionReason: true,
      declaredIdNumber: true,
      declaredAddress: true,
      reviewedAt: true,
      createdAt: true,
      acknowledgedAt: true,
      documentRequests: {
        where: { status: "OPEN" },
        select: {
          id: true,
          scope: true,
          message: true,
          roles: true,
          createdAt: true,
        },
        take: 1,
      },
    },
  });

  const mapEvent = (
    e: NonNullable<typeof latestEvent>,
  ): VerificationEventProjection => ({
    id: e.id,
    provider: e.provider as VerificationEventProjection["provider"],
    status: e.status as VerificationEventProjection["status"],
    rejectionReason: e.rejectionReason,
    declaredIdNumber: e.declaredIdNumber,
    declaredAddress: e.declaredAddress,
    reviewedAt: e.reviewedAt ? toISOString(e.reviewedAt) : null,
    createdAt: toISOString(e.createdAt),
    acknowledgedAt: e.acknowledgedAt ? toISOString(e.acknowledgedAt) : null,
  });

  return {
    status: deriveVerificationStatus(
      customer.verificationStatus as VerificationStatusProjection["status"],
      customer.verificationExpiresAt,
    ),
    verifiedAt: customer.verifiedAt ? toISOString(customer.verifiedAt) : null,
    expiresAt: customer.verificationExpiresAt
      ? toISOString(customer.verificationExpiresAt)
      : null,
    nearExpiry: customer.verificationExpiresAt
      ? customer.verificationExpiresAt.getTime() - Date.now() < RENEW_WINDOW_MS
      : false,
    expiryPassed: customer.verificationExpiresAt
      ? customer.verificationExpiresAt.getTime() <= Date.now()
      : false,
    latestEvent: latestEvent ? mapEvent(latestEvent) : null,
    openRequest: latestEvent?.status === "PENDING" && latestEvent.documentRequests[0]
      ? {
          id: latestEvent.documentRequests[0].id,
          scope: latestEvent.documentRequests[0].scope,
          message: latestEvent.documentRequests[0].message,
          roles: latestEvent.documentRequests[0].roles,
          createdAt: toISOString(latestEvent.documentRequests[0].createdAt),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// getOwnVerificationDocuments (customer self-view)
// ---------------------------------------------------------------------------

export interface OwnVerificationDocumentSource {
  id: string;
  role: VerificationDocumentRole;
  mimeType: string;
  storageKey: string;
  supersededAt: Date | null;
}

export async function getOwnVerificationDocuments(
  customerId: string,
): Promise<OwnVerificationDocumentSource[]> {
  const latest = await db.verificationEvent.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      documents: {
        select: {
          id: true,
          role: true,
          mimeType: true,
          storageKey: true,
          supersededAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return latest?.documents ?? [];
}

// ---------------------------------------------------------------------------
// getVerificationEvents (admin review queue)
// ---------------------------------------------------------------------------

export interface VerificationEventListItem {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  displayStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  documentCount: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  awaitingCustomer: boolean;
  customerResponded: boolean;
}

export interface VerificationEventFilters {
  status?: VerificationEventListItem["status"];
  provider?: VerificationEventListItem["provider"];
  search?: string;
  from?: string;
  to?: string;
}

export interface VerificationEventPage {
  items: VerificationEventListItem[];
  total: number;
  page: number;
  pageSize: number;
}

async function latestApprovedEventIdByCustomer(
  customerIds: string[],
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (customerIds.length === 0) return latest;

  const approved = await db.verificationEvent.findMany({
    where: { customerId: { in: customerIds }, status: "APPROVED" },
    orderBy: [
      { reviewedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: { id: true, customerId: true },
  });

  for (const event of approved) {
    if (!latest.has(event.customerId)) latest.set(event.customerId, event.id);
  }
  return latest;
}

export async function getVerificationEvents(
  opts?: VerificationEventFilters & { page?: number; pageSize?: number },
): Promise<VerificationEventPage> {
  const where: Prisma.VerificationEventWhereInput = {};

  if (opts?.status) {
    where.status = opts.status;
  }

  if (opts?.provider) {
    where.provider = opts.provider;
  }

  const term = opts?.search?.trim();
  if (term) {
    where.customer = {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  const fromBounds = opts?.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts?.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    where.createdAt = {
      ...(fromBounds ? { gte: fromBounds.start } : {}),
      ...(toBounds ? { lt: toBounds.end } : {}),
    };
  }

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    db.verificationEvent.count({ where }),
    db.verificationEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        customerId: true,
        provider: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        customer: {
          select: {
            name: true,
            email: true,
            verificationStatus: true,
            verificationExpiresAt: true,
          },
        },
        reviewedBy: { select: { name: true } },
        documents: { select: { id: true } },
        documentRequests: { select: { status: true, fulfilledAt: true } },
      },
    }),
  ]);

  const customerExpired = (row: (typeof rows)[number]) =>
    deriveVerificationStatus(
      row.customer.verificationStatus as VerificationStatusProjection["status"],
      row.customer.verificationExpiresAt,
    ) === "EXPIRED";

  const expiredCustomerIds = [
    ...new Set(
      rows
        .filter((row) => row.status === "APPROVED" && customerExpired(row))
        .map((row) => row.customerId),
    ),
  ];
  const latestApprovedByCustomer =
    await latestApprovedEventIdByCustomer(expiredCustomerIds);

  const items = rows.map((row) => ({
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.name,
    customerEmail: row.customer.email,
    provider: row.provider as VerificationEventListItem["provider"],
    status: row.status as VerificationEventListItem["status"],
    displayStatus: (row.status === "APPROVED" &&
    customerExpired(row) &&
    latestApprovedByCustomer.get(row.customerId) === row.id
      ? "EXPIRED"
      : row.status) as VerificationEventListItem["displayStatus"],
    documentCount: row.documents.length,
    createdAt: toISOString(row.createdAt),
    reviewedAt: row.reviewedAt ? toISOString(row.reviewedAt) : null,
    reviewedByName: row.reviewedBy?.name ?? null,
    awaitingCustomer: row.documentRequests.some((r) => r.status === "OPEN"),
    customerResponded:
      !row.documentRequests.some((r) => r.status === "OPEN") &&
      row.documentRequests.some(
        (r) =>
          r.status === "FULFILLED" &&
          r.fulfilledAt !== null &&
          (row.reviewedAt === null ||
            r.fulfilledAt.getTime() > row.reviewedAt.getTime()),
      ),
  }));

  return { items, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// getVerificationEventDetail (admin review queue)
// ---------------------------------------------------------------------------

export interface VerificationEventDetail {
  id: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  reviewResult: string | null;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { name: string } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    role: "B2C" | "B2B";
    currentStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
    verifiedAt: string | null;
    expiresAt: string | null;
    latestApprovedEventId: string | null;
    b2bAccount: {
      id: string;
      status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
      expiresAt: string | null;
    } | null;
  };
  documents: VerificationDocumentProjection[];
  openRequest: {
    id: string;
    scope: "DOCUMENTS" | "DETAILS";
    message: string;
    roles: VerificationDocumentRole[];
    requestedByName: string;
    createdAt: string;
  } | null;
  fulfilledRequests: {
    id: string;
    requestedByName: string;
    fulfilledAt: string;
  }[];
}

export async function getVerificationEventDetail(
  id: string,
): Promise<VerificationEventDetail | null> {
  const event = await db.verificationEvent.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      status: true,
      rejectionReason: true,
      declaredIdNumber: true,
      declaredAddress: true,
      reviewResult: true,
      rawPayload: true,
      createdAt: true,
      reviewedAt: true,
      reviewedBy: { select: { name: true } },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          verificationStatus: true,
          verifiedAt: true,
          verificationExpiresAt: true,
        },
      },
      documents: {
        select: {
          id: true,
          role: true,
          type: true,
          filename: true,
          storageKey: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          supersededAt: true,
          requestId: true,
        },
        orderBy: { createdAt: "asc" },
      },
      documentRequests: {
        select: {
          id: true,
          status: true,
          scope: true,
          roles: true,
          message: true,
          createdAt: true,
          fulfilledAt: true,
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!event) return null;

  const b2bAccount = await db.b2BAccount.findFirst({
    where: { customerId: event.customer.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, expiresAt: true },
  });

  const latestApprovedEvent = await db.verificationEvent.findFirst({
    where: { customerId: event.customer.id, status: "APPROVED" },
    orderBy: [
      { reviewedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: { id: true },
  });

  const rawPayload = event.rawPayload;
  const notes =
    event.provider === "MANUAL_REVIEW" &&
    rawPayload != null &&
    typeof rawPayload === "object" &&
    !Array.isArray(rawPayload) &&
    typeof (rawPayload as Record<string, unknown>).notes === "string"
      ? ((rawPayload as Record<string, unknown>).notes as string)
      : null;

  return {
    id: event.id,
    provider: event.provider as VerificationEventDetail["provider"],
    status: event.status as VerificationEventDetail["status"],
    rejectionReason: event.rejectionReason,
    declaredIdNumber: event.declaredIdNumber,
    declaredAddress: event.declaredAddress,
    reviewResult: event.reviewResult,
    notes,
    createdAt: toISOString(event.createdAt),
    reviewedAt: event.reviewedAt ? toISOString(event.reviewedAt) : null,
    reviewedBy: event.reviewedBy,
    customer: {
      id: event.customer.id,
      name: event.customer.name,
      email: event.customer.email,
      role: event.customer.role,
      currentStatus: deriveVerificationStatus(
        event.customer.verificationStatus as VerificationStatusProjection["status"],
        event.customer.verificationExpiresAt,
      ),
      verifiedAt: event.customer.verifiedAt
        ? toISOString(event.customer.verifiedAt)
        : null,
      expiresAt: event.customer.verificationExpiresAt
        ? toISOString(event.customer.verificationExpiresAt)
        : null,
      latestApprovedEventId: latestApprovedEvent?.id ?? null,
      b2bAccount: b2bAccount
        ? {
            id: b2bAccount.id,
            status: b2bAccount.status,
            expiresAt: b2bAccount.expiresAt
              ? toISOString(b2bAccount.expiresAt)
              : null,
          }
        : null,
    },
    documents: event.documents.map((d) => ({
      id: d.id,
      role: d.role,
      type: d.type,
      filename: d.filename,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: toISOString(d.createdAt),
      supersededAt: d.supersededAt ? toISOString(d.supersededAt) : null,
      requestId: d.requestId,
    })),
    openRequest: (() => {
      const open = event.documentRequests.find((r) => r.status === "OPEN");
      return open
        ? {
            id: open.id,
            scope: open.scope,
            message: open.message,
            roles: open.roles,
            requestedByName: open.requestedBy.name,
            createdAt: toISOString(open.createdAt),
          }
        : null;
    })(),
    fulfilledRequests: event.documentRequests
      .filter(
        (r): r is typeof r & { fulfilledAt: Date } =>
          r.status === "FULFILLED" && r.fulfilledAt !== null,
      )
      .map((r) => ({
        id: r.id,
        requestedByName: r.requestedBy.name,
        fulfilledAt: toISOString(r.fulfilledAt),
      })),
  };
}

// ---------------------------------------------------------------------------
// getCustomerVerificationEvents (submission history, admin detail page)
// ---------------------------------------------------------------------------

export interface CustomerVerificationEventItem {
  id: string;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  declaredIdNumber: string | null;
  declaredAddress: string | null;
  documents: {
    id: string;
    role: VerificationDocumentRole;
    type: VerificationDocumentType;
    filename: string;
    mimeType: string;
    createdAt: string;
    supersededAt: string | null;
    requestId: string | null;
  }[];
  fulfilledRequests: { id: string; requestedByName: string; fulfilledAt: string }[];
}

export async function getCustomerVerificationEvents(
  customerId: string,
): Promise<CustomerVerificationEventItem[]> {
  const rows = await db.verificationEvent.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewedBy: { select: { name: true } },
      declaredIdNumber: true,
      declaredAddress: true,
      documents: {
        select: {
          id: true,
          role: true,
          type: true,
          filename: true,
          mimeType: true,
          createdAt: true,
          supersededAt: true,
          requestId: true,
        },
        orderBy: { createdAt: "asc" },
      },
      documentRequests: {
        where: { status: "FULFILLED" },
        select: {
          id: true,
          status: true,
          fulfilledAt: true,
          requestedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider as CustomerVerificationEventItem["provider"],
    status: row.status as CustomerVerificationEventItem["status"],
    createdAt: toISOString(row.createdAt),
    reviewedAt: row.reviewedAt ? toISOString(row.reviewedAt) : null,
    reviewedByName: row.reviewedBy?.name ?? null,
    declaredIdNumber: row.declaredIdNumber,
    declaredAddress: row.declaredAddress,
    documents: row.documents.map((d) => ({
      id: d.id,
      role: d.role,
      type: d.type,
      filename: d.filename,
      mimeType: d.mimeType,
      createdAt: toISOString(d.createdAt),
      supersededAt: d.supersededAt ? toISOString(d.supersededAt) : null,
      requestId: d.requestId,
    })),
    fulfilledRequests: row.documentRequests
      .filter(
        (r): r is typeof r & { fulfilledAt: Date } =>
          r.status === "FULFILLED" && r.fulfilledAt !== null,
      )
      .map((r) => ({
        id: r.id,
        requestedByName: r.requestedBy.name,
        fulfilledAt: toISOString(r.fulfilledAt),
      })),
  }));
}

// ---------------------------------------------------------------------------
// getComplianceSnapshot
// ---------------------------------------------------------------------------

/**
 * Builds the compliance snapshot to persist on Order.complianceSnapshot at
 * order-creation time. Snapshot, never join — verification/B2B documents
 * cascade-delete under the five-year purge, so a join would leave inspected
 * orders with an empty compliance record.
 */
export async function getComplianceSnapshot(
  customerId: string,
  restrictedSkus: string[],
): Promise<ComplianceSnapshot> {
  const eventSelect = {
    id: true,
    provider: true,
    status: true,
    declaredIdNumber: true,
    declaredAddress: true,
    documents: {
      where: { supersededAt: null },
      select: {
        storageKey: true,
        role: true,
        type: true,
        filename: true,
        mimeType: true,
      },
    },
  } as const;

  const [customer, latestAnyEvent, latestApprovedEvent, b2bAccount] =
    await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        verificationStatus: true,
        verifiedAt: true,
        verificationExpiresAt: true,
      },
    }),
    db.verificationEvent.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: eventSelect,
    }),
    db.verificationEvent.findFirst({
      where: { customerId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: eventSelect,
    }),
    db.b2BAccount.findFirst({
      where: { customerId, status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        tradeLicenseNo: true,
        documents: {
          where: { supersededAt: null },
          select: {
            storageKey: true,
            type: true,
            filename: true,
            mimeType: true,
            declaredNumber: true,
          },
        },
      },
    }),
  ]);

  const derivedStatus = customer
    ? deriveVerificationStatus(
        customer.verificationStatus as VerificationStatusProjection["status"],
        customer.verificationExpiresAt,
      )
    : null;
  const latestEvent =
    derivedStatus === "APPROVED"
      ? (latestApprovedEvent ?? latestAnyEvent)
      : latestAnyEvent;

  const verification: ComplianceSnapshot["verification"] =
    latestEvent && customer
      ? {
          eventId: latestEvent.id,
          provider: latestEvent.provider,
          status: deriveVerificationStatus(
            customer.verificationStatus as VerificationStatusProjection["status"],
            customer.verificationExpiresAt,
          ),
          verifiedAt: customer.verifiedAt
            ? toISOString(customer.verifiedAt)
            : null,
          expiresAt: customer.verificationExpiresAt
            ? toISOString(customer.verificationExpiresAt)
            : null,
          declaredIdNumber: latestEvent.declaredIdNumber,
          declaredAddress: latestEvent.declaredAddress,
          documents: latestEvent.documents.map((d) => ({
            storageKey: d.storageKey,
            role: d.role,
            type: d.type,
            filename: d.filename,
            mimeType: d.mimeType,
          })),
        }
      : null;

  const b2b: ComplianceSnapshot["b2b"] = b2bAccount
    ? {
        accountId: b2bAccount.id,
        status: b2bAccount.status,
        tradeLicenseNo: b2bAccount.tradeLicenseNo,
        documents: b2bAccount.documents.map((d) => ({
          storageKey: d.storageKey,
          type: d.type,
          filename: d.filename,
          mimeType: d.mimeType,
          declaredNumber: d.declaredNumber,
        })),
      }
    : null;

  return {
    snapshotAt: nowISO(),
    verification,
    b2b,
    restrictedSkus,
  };
}

export async function getPendingVerificationReviewCount(): Promise<number> {
  return db.verificationEvent.count({ where: { status: "PENDING" } });
}

// ---------------------------------------------------------------------------
// getVerificationDocumentForMint
// ---------------------------------------------------------------------------

export interface VerificationDocumentMintSource {
  storageKey: string;
  filename: string;
  role: VerificationDocumentRole;
  mimeType: string;
  customerName: string;
}

export async function getVerificationDocumentForMint(
  eventId: string,
  documentId: string,
): Promise<VerificationDocumentMintSource | null> {
  const doc = await db.verificationDocument.findFirst({
    where: { id: documentId, verificationEventId: eventId },
    select: {
      storageKey: true,
      filename: true,
      role: true,
      mimeType: true,
      verificationEvent: { select: { customer: { select: { name: true } } } },
    },
  });
  if (!doc) return null;
  return {
    storageKey: doc.storageKey,
    filename: doc.filename,
    role: doc.role,
    mimeType: doc.mimeType,
    customerName: doc.verificationEvent.customer.name,
  };
}
