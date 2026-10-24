import "server-only";

import { cache } from "react";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import {
  deriveVerificationStatus,
  type VerificationStatusProjection,
} from "@/lib/db/queries/verification";
import type {
  B2BStatus,
  DocumentType,
  Prisma,
  QuoteStatus,
  TicketPriority,
  TicketStatus,
} from "@/app/generated/prisma/client";

export type { B2BStatus, DocumentType };

export type B2BDerivedStatus = B2BStatus | "EXPIRED";

export function deriveB2BStatus(
  stored: B2BStatus,
  expiresAt: Date | null,
): B2BDerivedStatus {
  const expired = expiresAt != null && expiresAt.getTime() < Date.now();
  return expired && stored === "APPROVED" ? "EXPIRED" : stored;
}

export interface B2BApplicationRowProjection {
  id: string;
  companyNameEn: string;
  contactName: string;
  customerEmail: string;
  tradeLicenseNo: string;
  status: B2BStatus;
  derivedStatus: B2BDerivedStatus;
  createdAt: string;
  documentCount: number;
  awaitingCustomer: boolean;
  customerResponded: boolean;
  expiresAt: string | null;
  expiryDays: number | null;
  quoteCount: number;
}

export interface AdminB2BFilters {
  search?: string;
  status?: "PENDING" | "APPROVED" | "EXPIRED" | "SUSPENDED" | "REJECTED";
  review?: "DECISION" | "WAITING" | "RESPONDED";
  renewal?: "D30" | "D90";
  quotes?: "HAS" | "NONE";
  sort?: "newest" | "oldest" | "expiry" | "company";
  from?: string;
  to?: string;
}

export interface AdminB2BSummary {
  decision: number;
  waiting: number;
  responded: number;
  active: number;
  expiring30: number;
  expired: number;
  suspended: number;
  rejected: number;
  total: number;
}

export interface AdminB2BPage {
  rows: B2BApplicationRowProjection[];
  total: number;
  page: number;
  totalPages: number;
  summary: AdminB2BSummary;
}

export interface B2BDocumentProjection {
  id: string;
  type: DocumentType;
  filename: string;
  mimeType: string | null;
  storageKey: string;
  declaredNumber: string | null;
  label: string | null;
  supersededAt: string | null;
  uploadedAt: string;
  requestId: string | null;
}

export interface B2BApplicationDetailProjection {
  id: string;
  status: B2BStatus;
  derivedStatus: B2BDerivedStatus;
  companyNameEn: string;
  companyNameAr: string | null;
  contactName: string | null;
  contactPhone: string | null;
  tradeLicenseNo: string;
  vatNumber: string | null;
  creditLimitAed: number | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    role: "B2C" | "B2B";
    verificationStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
    latestVerificationEventId: string | null;
  };
  reviewedBy: { name: string } | null;
  documents: B2BDocumentProjection[];
  openRequest: {
    id: string;
    scope: "DOCUMENTS" | "DETAILS";
    types: DocumentType[];
    message: string;
    requestedByName: string;
    createdAt: string;
  } | null;
  fulfilledRequests: {
    id: string;
    message: string;
    requestedByName: string;
    fulfilledAt: string;
  }[];
}

export interface OwnB2BDocumentSource {
  id: string;
  type: DocumentType;
  mimeType: string | null;
  storageKey: string;
  declaredNumber: string | null;
  label: string | null;
  supersededAt: Date | null;
}

export const hasActiveTradeAccount = cache(
  async (customerId: string): Promise<boolean> => {
    const account = await db.b2BAccount.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { status: true, expiresAt: true },
    });
    if (!account) return false;
    return deriveB2BStatus(account.status, account.expiresAt) === "APPROVED";
  },
);

export async function getOwnB2BDocuments(
  customerId: string,
): Promise<OwnB2BDocumentSource[]> {
  const account = await db.b2BAccount.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      documents: {
        select: {
          id: true,
          type: true,
          mimeType: true,
          storageKey: true,
          declaredNumber: true,
          label: true,
          supersededAt: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });
  return account?.documents ?? [];
}

const B2B_ORDER_BY: Record<
  NonNullable<AdminB2BFilters["sort"]>,
  Prisma.B2BAccountOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  expiry: [{ expiresAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  company: [{ companyNameEn: "asc" }, { id: "asc" }],
};

function derivedB2BStatusWhere(
  status: NonNullable<AdminB2BFilters["status"]>,
  now: Date,
): Prisma.B2BAccountWhereInput {
  if (status === "APPROVED") {
    return {
      status: "APPROVED",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };
  }
  if (status === "EXPIRED") {
    return { status: "APPROVED", expiresAt: { lt: now } };
  }
  return { status };
}

function renewalWhere(
  window: NonNullable<AdminB2BFilters["renewal"]>,
  now: Date,
): Prisma.B2BAccountWhereInput {
  const days = window === "D30" ? 30 : 90;
  return {
    status: "APPROVED",
    expiresAt: { gte: now, lt: new Date(now.getTime() + days * 864e5) },
  };
}

async function respondedAccountIds(): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM "B2BAccount" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "DocumentRequest" r
      WHERE r."b2bAccountId" = a.id AND r.status = 'OPEN'
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentRequest" r
      WHERE r."b2bAccountId" = a.id AND r.status = 'FULFILLED'
        AND r."fulfilledAt" IS NOT NULL
        AND (a."reviewedAt" IS NULL OR r."fulfilledAt" > a."reviewedAt")
    )
  `;
  return rows.map((r) => r.id);
}

export async function getAdminB2BAccounts(
  opts: AdminB2BFilters & { page: number; pageSize: number },
): Promise<AdminB2BPage> {
  const now = new Date();
  const respondedIds = await respondedAccountIds();
  const and: Prisma.B2BAccountWhereInput[] = [];

  if (opts.status) {
    and.push(derivedB2BStatusWhere(opts.status, now));
  }

  if (opts.review === "DECISION") {
    and.push({
      status: "PENDING",
      documentRequests: { none: { status: "OPEN" } },
    });
  } else if (opts.review === "WAITING") {
    and.push({ documentRequests: { some: { status: "OPEN" } } });
  } else if (opts.review === "RESPONDED") {
    and.push({ id: { in: respondedIds } });
  }

  if (opts.renewal) {
    and.push(renewalWhere(opts.renewal, now));
  }

  if (opts.quotes === "HAS") {
    and.push({ quoteRequests: { some: {} } });
  } else if (opts.quotes === "NONE") {
    and.push({ quoteRequests: { none: {} } });
  }

  const q = opts.search?.trim();
  if (q) {
    and.push({
      OR: [
        { companyNameEn: { contains: q, mode: "insensitive" } },
        { companyNameAr: { contains: q, mode: "insensitive" } },
        { tradeLicenseNo: { contains: q, mode: "insensitive" } },
        { vatNumber: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { contactPhone: { contains: q, mode: "insensitive" } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const fromBounds = opts.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    and.push({
      createdAt: {
        ...(fromBounds ? { gte: fromBounds.start } : {}),
        ...(toBounds ? { lt: toBounds.end } : {}),
      },
    });
  }

  const where: Prisma.B2BAccountWhereInput = { AND: and };

  const [
    total,
    summaryTotal,
    summaryDecision,
    summaryWaiting,
    summaryActive,
    summaryExpiring30,
    summaryExpired,
    summarySuspended,
    summaryRejected,
  ] = await Promise.all([
    db.b2BAccount.count({ where }),
    db.b2BAccount.count(),
    db.b2BAccount.count({
      where: {
        status: "PENDING",
        documentRequests: { none: { status: "OPEN" } },
      },
    }),
    db.b2BAccount.count({
      where: { documentRequests: { some: { status: "OPEN" } } },
    }),
    db.b2BAccount.count({ where: derivedB2BStatusWhere("APPROVED", now) }),
    db.b2BAccount.count({ where: renewalWhere("D30", now) }),
    db.b2BAccount.count({ where: derivedB2BStatusWhere("EXPIRED", now) }),
    db.b2BAccount.count({ where: derivedB2BStatusWhere("SUSPENDED", now) }),
    db.b2BAccount.count({ where: derivedB2BStatusWhere("REJECTED", now) }),
  ]);

  const summary: AdminB2BSummary = {
    decision: summaryDecision,
    waiting: summaryWaiting,
    responded: respondedIds.length,
    active: summaryActive,
    expiring30: summaryExpiring30,
    expired: summaryExpired,
    suspended: summarySuspended,
    rejected: summaryRejected,
    total: summaryTotal,
  };

  const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), totalPages);

  const rows = await db.b2BAccount.findMany({
    where,
    orderBy: B2B_ORDER_BY[opts.sort ?? "newest"],
    skip: (page - 1) * opts.pageSize,
    take: opts.pageSize,
    select: {
      id: true,
      companyNameEn: true,
      contactName: true,
      tradeLicenseNo: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      reviewedAt: true,
      customer: { select: { name: true, email: true } },
      documents: { select: { id: true } },
      documentRequests: { select: { status: true, fulfilledAt: true } },
      _count: { select: { quoteRequests: true } },
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    companyNameEn: row.companyNameEn,
    contactName: row.contactName ?? row.customer.name,
    customerEmail: row.customer.email,
    tradeLicenseNo: row.tradeLicenseNo,
    status: row.status,
    derivedStatus: deriveB2BStatus(row.status, row.expiresAt),
    createdAt: toISOString(row.createdAt),
    documentCount: row.documents.length,
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
    expiresAt: row.expiresAt ? toISOString(row.expiresAt) : null,
    expiryDays: row.expiresAt
      ? Math.ceil((row.expiresAt.getTime() - now.getTime()) / 864e5)
      : null,
    quoteCount: row._count.quoteRequests,
  }));

  return { rows: items, total, page, totalPages, summary };
}

export async function getB2BApplicationDetail(
  id: string,
): Promise<B2BApplicationDetailProjection | null> {
  const account = await db.b2BAccount.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      companyNameEn: true,
      companyNameAr: true,
      contactName: true,
      contactPhone: true,
      tradeLicenseNo: true,
      vatNumber: true,
      creditLimitAed: true,
      rejectionReason: true,
      reviewedAt: true,
      verifiedAt: true,
      expiresAt: true,
      createdAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          verificationStatus: true,
          verificationExpiresAt: true,
        },
      },
      reviewedBy: { select: { name: true } },
      documents: {
        select: {
          id: true,
          type: true,
          filename: true,
          mimeType: true,
          storageKey: true,
          declaredNumber: true,
          label: true,
          supersededAt: true,
          uploadedAt: true,
          requestId: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
      documentRequests: {
        select: {
          id: true,
          status: true,
          scope: true,
          types: true,
          message: true,
          createdAt: true,
          fulfilledAt: true,
          requestedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!account) return null;

  const latestVerificationEvent = await db.verificationEvent.findFirst({
    where: { customerId: account.customer.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const openRequestRow = account.documentRequests.find(
    (r) => r.status === "OPEN",
  );
  const fulfilledRequests = account.documentRequests
    .filter(
      (r): r is typeof r & { fulfilledAt: Date } =>
        r.status === "FULFILLED" && r.fulfilledAt !== null,
    )
    .sort((a, b) => a.fulfilledAt.getTime() - b.fulfilledAt.getTime())
    .map((r) => ({
      id: r.id,
      message: r.message,
      requestedByName: r.requestedBy.name,
      fulfilledAt: toISOString(r.fulfilledAt),
    }));

  return {
    id: account.id,
    status: account.status,
    derivedStatus: deriveB2BStatus(account.status, account.expiresAt),
    companyNameEn: account.companyNameEn,
    companyNameAr: account.companyNameAr,
    contactName: account.contactName,
    contactPhone: account.contactPhone,
    tradeLicenseNo: account.tradeLicenseNo,
    vatNumber: account.vatNumber,
    creditLimitAed:
      account.creditLimitAed != null ? Number(account.creditLimitAed) : null,
    rejectionReason: account.rejectionReason,
    reviewedAt: account.reviewedAt ? toISOString(account.reviewedAt) : null,
    verifiedAt: account.verifiedAt ? toISOString(account.verifiedAt) : null,
    expiresAt: account.expiresAt ? toISOString(account.expiresAt) : null,
    createdAt: toISOString(account.createdAt),
    customer: {
      id: account.customer.id,
      name: account.customer.name,
      email: account.customer.email,
      role: account.customer.role,
      verificationStatus: deriveVerificationStatus(
        account.customer.verificationStatus as VerificationStatusProjection["status"],
        account.customer.verificationExpiresAt,
      ),
      latestVerificationEventId: latestVerificationEvent?.id ?? null,
    },
    reviewedBy: account.reviewedBy,
    documents: account.documents.map((doc) => ({
      ...doc,
      supersededAt: doc.supersededAt ? toISOString(doc.supersededAt) : null,
      uploadedAt: toISOString(doc.uploadedAt),
    })),
    openRequest: openRequestRow
      ? {
          id: openRequestRow.id,
          scope: openRequestRow.scope,
          types: openRequestRow.types,
          message: openRequestRow.message,
          requestedByName: openRequestRow.requestedBy.name,
          createdAt: toISOString(openRequestRow.createdAt),
        }
      : null,
    fulfilledRequests,
  };
}

export async function getPendingB2BReviewCount(): Promise<number> {
  return db.b2BAccount.count({ where: { status: "PENDING" } });
}

export interface B2BDocumentMintSource {
  storageKey: string;
  filename: string;
  type: DocumentType;
  companyNameEn: string;
}

export async function getB2BDocumentForMint(
  accountId: string,
  documentId: string,
): Promise<B2BDocumentMintSource | null> {
  const doc = await db.b2BDocument.findFirst({
    where: { id: documentId, b2bAccountId: accountId },
    select: {
      storageKey: true,
      filename: true,
      type: true,
      b2bAccount: { select: { companyNameEn: true } },
    },
  });
  if (!doc) return null;
  return {
    storageKey: doc.storageKey,
    filename: doc.filename,
    type: doc.type,
    companyNameEn: doc.b2bAccount.companyNameEn,
  };
}

export interface B2BLinkedQuoteProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  convertedOrderId: string | null;
  createdAt: string;
}

export interface B2BLinkedTicketProjection {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  createdAt: string;
}

export interface B2BLinkedRecords {
  quotes: { total: number; items: B2BLinkedQuoteProjection[] };
  tickets: { total: number; items: B2BLinkedTicketProjection[] };
}

export async function getB2BLinkedRecords(
  accountId: string,
): Promise<B2BLinkedRecords> {
  const [quoteTotal, quotes, ticketTotal, tickets] = await Promise.all([
    db.quoteRequest.count({ where: { b2bAccountId: accountId } }),
    db.quoteRequest.findMany({
      where: { b2bAccountId: accountId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        convertedOrderId: true,
        createdAt: true,
      },
    }),
    db.ticket.count({ where: { b2bAccountId: accountId } }),
    db.ticket.findMany({
      where: { b2bAccountId: accountId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        priority: true,
        subject: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    quotes: {
      total: quoteTotal,
      items: quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        status: q.status,
        convertedOrderId: q.convertedOrderId,
        createdAt: toISOString(q.createdAt),
      })),
    },
    tickets: {
      total: ticketTotal,
      items: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        status: t.status,
        priority: t.priority,
        subject: t.subject,
        createdAt: toISOString(t.createdAt),
      })),
    },
  };
}
