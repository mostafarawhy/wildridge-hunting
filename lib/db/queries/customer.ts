import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { REVENUE_STATUSES } from "@/lib/utils/order-status";
import { deriveB2BStatus, type B2BDerivedStatus } from "@/lib/db/queries/b2b";
import {
  deriveVerificationStatus,
  type VerificationStatusProjection,
} from "@/lib/db/queries/verification";
import type {
  CustomerRole,
  VerificationStatus,
  TicketStatus,
  TicketPriority,
  QuoteStatus,
  OrderStatus,
  DocumentType,
  Prisma,
} from "@/app/generated/prisma/client";

export interface AdminCustomerListItemProjection {
  id: string;
  name: string;
  email: string;
  role: CustomerRole;
  isActive: boolean;
  verificationStatus: VerificationStatus;
  verificationDisplay: VerificationStatusProjection["status"];
  b2bStatus: B2BDerivedStatus | null;
  loyaltyPoints: number;
  ordersCount: number;
  lifetimeSpendAed: number;
  createdAt: string;
}

export interface AdminCustomerFilters {
  search?: string;
  role?: CustomerRole;
  status?: "ACTIVE" | "SUSPENDED";
  verification?: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  b2b?: "NONE" | "PENDING" | "APPROVED" | "EXPIRED" | "SUSPENDED" | "REJECTED";
  orders?: "HAS" | "NONE";
  points?: "HAS" | "NONE";
  sort?: "newest" | "oldest" | "name";
  from?: string;
  to?: string;
}

export interface AdminCustomerSummary {
  total: number;
  b2b: number;
  b2c: number;
  verified: number;
  expired: number;
  rejected: number;
  pending: number;
  suspended: number;
}

export interface AdminCustomerPage {
  rows: AdminCustomerListItemProjection[];
  total: number;
  page: number;
  totalPages: number;
  summary: AdminCustomerSummary;
}

export interface AdminCustomerRecentOrderProjection {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAed: number;
  createdAt: string;
}

export interface AdminCustomerRecentQuoteProjection {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  createdAt: string;
}

export interface AdminCustomerRecentTicketProjection {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  createdAt: string;
}

export interface AdminCustomerB2BSummaryProjection {
  id: string;
  status: B2BDerivedStatus;
  companyNameEn: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminCustomerIdentityVerificationProjection {
  status: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  verifiedAt: string | null;
  expiresAt: string | null;
  submissionCount: number;
  latestEventId: string | null;
}

export interface AdminCustomerAddressProjection {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  emirate: string;
  country: string;
  isDefault: boolean;
}

export interface AdminCustomerLoyaltyRecentProjection {
  id: string;
  type:
    | "EARNED"
    | "REDEEMED"
    | "ADJUSTED"
    | "EXPIRED"
    | "REFUNDED"
    | "REVERSED";
  delta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  orderId: string | null;
  orderNumber: string | null;
}

export interface AdminCustomerDetailProjection {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: CustomerRole;
  isActive: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  loyaltyPoints: number;
  loyaltyRecent: AdminCustomerLoyaltyRecentProjection[];
  internalNotes: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  locale: string;
  uaePassLinked: boolean;
  ordersCount: number;
  paidOrdersCount: number;
  awaitingPaymentCount: number;
  lifetimeSpendAed: number;
  quotesCount: number;
  ticketsCount: number;
  openTicketsCount: number;
  addressesCount: number;
  verificationEventIds: string[];
  b2bAccountIds: string[];
  recentOrders: AdminCustomerRecentOrderProjection[];
  recentQuotes: AdminCustomerRecentQuoteProjection[];
  recentTickets: AdminCustomerRecentTicketProjection[];
  b2bAccount: AdminCustomerB2BSummaryProjection | null;
  identityVerification: AdminCustomerIdentityVerificationProjection;
  addresses: AdminCustomerAddressProjection[];
}

const CUSTOMER_ORDER_BY: Record<
  NonNullable<AdminCustomerFilters["sort"]>,
  Prisma.CustomerOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  name: [{ name: "asc" }, { id: "asc" }],
};

function derivedVerificationWhere(
  status: NonNullable<AdminCustomerFilters["verification"]>,
  now: Date,
): Prisma.CustomerWhereInput {
  if (status === "APPROVED") {
    return {
      verificationStatus: "APPROVED",
      OR: [
        { verificationExpiresAt: null },
        { verificationExpiresAt: { gte: now } },
      ],
    };
  }
  if (status === "EXPIRED") {
    return {
      OR: [
        { verificationStatus: "EXPIRED" },
        {
          verificationStatus: "APPROVED",
          verificationExpiresAt: { lt: now },
        },
      ],
    };
  }
  return { verificationStatus: status };
}

export async function getAdminCustomers(
  opts: AdminCustomerFilters & { page: number; pageSize: number },
): Promise<AdminCustomerPage> {
  const now = new Date();
  const and: Prisma.CustomerWhereInput[] = [{ deletedAt: null }];

  if (opts.role) {
    and.push({ role: opts.role });
  }

  if (opts.status === "ACTIVE") {
    and.push({ isActive: true });
  } else if (opts.status === "SUSPENDED") {
    and.push({ isActive: false });
  }

  const term = opts.search?.trim();
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (opts.verification) {
    and.push(derivedVerificationWhere(opts.verification, now));
  }

  if (opts.b2b === "NONE") {
    and.push({ b2bAccount: { none: {} } });
  } else if (opts.b2b === "PENDING" || opts.b2b === "SUSPENDED") {
    and.push({ b2bAccount: { some: { status: opts.b2b } } });
  } else if (opts.b2b === "APPROVED") {
    and.push({
      b2bAccount: {
        some: {
          status: "APPROVED",
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      },
    });
  } else if (opts.b2b === "EXPIRED") {
    and.push({
      b2bAccount: {
        some: { status: "APPROVED", expiresAt: { lt: now } },
      },
    });
  } else if (opts.b2b === "REJECTED") {
    and.push({
      b2bAccount: {
        some: { status: "REJECTED" },
        none: { status: { in: ["PENDING", "APPROVED", "SUSPENDED"] } },
      },
    });
  }

  if (opts.orders === "HAS") {
    and.push({ orders: { some: {} } });
  } else if (opts.orders === "NONE") {
    and.push({ orders: { none: {} } });
  }

  if (opts.points === "HAS") {
    and.push({ loyaltyPoints: { gt: 0 } });
  } else if (opts.points === "NONE") {
    and.push({ loyaltyPoints: 0 });
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

  const where: Prisma.CustomerWhereInput = { AND: and };
  const notDeleted: Prisma.CustomerWhereInput = { deletedAt: null };

  const [
    total,
    summaryTotal,
    summaryB2b,
    summaryB2c,
    summaryVerified,
    summaryExpired,
    summaryRejected,
    summaryPending,
    summarySuspended,
  ] = await Promise.all([
    db.customer.count({ where }),
    db.customer.count({ where: notDeleted }),
    db.customer.count({ where: { ...notDeleted, role: "B2B" } }),
    db.customer.count({ where: { ...notDeleted, role: "B2C" } }),
    db.customer.count({
      where: { AND: [notDeleted, derivedVerificationWhere("APPROVED", now)] },
    }),
    db.customer.count({
      where: { AND: [notDeleted, derivedVerificationWhere("EXPIRED", now)] },
    }),
    db.customer.count({
      where: { AND: [notDeleted, derivedVerificationWhere("REJECTED", now)] },
    }),
    db.customer.count({
      where: { AND: [notDeleted, derivedVerificationWhere("PENDING", now)] },
    }),
    db.customer.count({ where: { ...notDeleted, isActive: false } }),
  ]);

  const summary: AdminCustomerSummary = {
    total: summaryTotal,
    b2b: summaryB2b,
    b2c: summaryB2c,
    verified: summaryVerified,
    expired: summaryExpired,
    rejected: summaryRejected,
    pending: summaryPending,
    suspended: summarySuspended,
  };

  const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), totalPages);

  const rows = await db.customer.findMany({
    where,
    orderBy: CUSTOMER_ORDER_BY[opts.sort ?? "newest"],
    skip: (page - 1) * opts.pageSize,
    take: opts.pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      verificationStatus: true,
      verificationExpiresAt: true,
      loyaltyPoints: true,
      b2bAccount: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, expiresAt: true },
      },
      createdAt: true,
    },
  });

  if (rows.length === 0) {
    return { rows: [], total, page, totalPages, summary };
  }

  const ids = rows.map((r) => r.id);

  const [revenueGroups, countGroups] = await Promise.all([
    db.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids }, status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const revenueByCustomer = new Map(
    revenueGroups.map((g) => [g.customerId, Number(g._sum.total ?? 0)]),
  );
  const countByCustomer = new Map(
    countGroups.map((g) => [g.customerId, g._count._all]),
  );

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      verificationStatus: row.verificationStatus,
      verificationDisplay: deriveVerificationStatus(
        row.verificationStatus as VerificationStatusProjection["status"],
        row.verificationExpiresAt,
      ),
      b2bStatus: row.b2bAccount[0]
        ? deriveB2BStatus(
            row.b2bAccount[0].status,
            row.b2bAccount[0].expiresAt,
          )
        : null,
      loyaltyPoints: row.loyaltyPoints,
      ordersCount: countByCustomer.get(row.id) ?? 0,
      lifetimeSpendAed: revenueByCustomer.get(row.id) ?? 0,
      createdAt: toISOString(row.createdAt),
    })),
    total,
    page,
    totalPages,
    summary,
  };
}

export async function getAdminCustomerDetail(
  customerId: string,
): Promise<AdminCustomerDetailProjection | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      verificationStatus: true,
      verifiedAt: true,
      verificationExpiresAt: true,
      loyaltyPoints: true,
      internalNotes: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      locale: true,
      uaePassUuid: true,
    },
  });

  if (!customer) return null;

  const [
    orderAgg,
    revenueAgg,
    awaitingPaymentCount,
    quotesCount,
    ticketsCount,
    openTicketsCount,
    verificationEventRows,
    b2bAccountRows,
    recentOrders,
    recentQuotes,
    recentTickets,
    b2bAccount,
    addresses,
    verificationEventCount,
    latestVerificationEvent,
    loyaltyRecent,
  ] = await Promise.all([
    db.order.aggregate({
      where: { customerId },
      _count: { _all: true },
    }),
    db.order.aggregate({
      where: { customerId, status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.order.count({
      where: { customerId, status: "AWAITING_MANUAL_PAYMENT" },
    }),
    db.quoteRequest.count({ where: { customerId } }),
    db.ticket.count({ where: { customerId } }),
    db.ticket.count({ where: { customerId, status: { not: "CLOSED" } } }),
    db.verificationEvent.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.b2BAccount.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    db.quoteRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        createdAt: true,
      },
    }),
    db.ticket.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
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
    db.b2BAccount.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        companyNameEn: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
    db.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        fullName: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        emirate: true,
        country: true,
        isDefault: true,
      },
    }),
    db.verificationEvent.count({ where: { customerId } }),
    db.verificationEvent.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        type: true,
        delta: true,
        balanceAfter: true,
        reason: true,
        createdAt: true,
        orderId: true,
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    role: customer.role,
    isActive: customer.isActive,
    verificationStatus: customer.verificationStatus,
    verifiedAt: customer.verifiedAt ? toISOString(customer.verifiedAt) : null,
    loyaltyPoints: customer.loyaltyPoints,
    loyaltyRecent: loyaltyRecent.map((t) => ({
      id: t.id,
      type: t.type,
      delta: t.delta,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      createdAt: toISOString(t.createdAt),
      orderId: t.orderId,
      orderNumber: t.order?.orderNumber ?? null,
    })),
    internalNotes: customer.internalNotes,
    createdAt: toISOString(customer.createdAt),
    lastLoginAt: customer.lastLoginAt ? toISOString(customer.lastLoginAt) : null,
    emailVerifiedAt: customer.emailVerifiedAt
      ? toISOString(customer.emailVerifiedAt)
      : null,
    locale: customer.locale,
    uaePassLinked: customer.uaePassUuid !== null,
    ordersCount: orderAgg._count._all,
    paidOrdersCount: revenueAgg._count._all,
    awaitingPaymentCount,
    lifetimeSpendAed: Number(revenueAgg._sum.total ?? 0),
    quotesCount,
    ticketsCount,
    openTicketsCount,
    addressesCount: addresses.length,
    verificationEventIds: verificationEventRows.map((e) => e.id),
    b2bAccountIds: b2bAccountRows.map((a) => a.id),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAed: Number(o.total),
      createdAt: toISOString(o.createdAt),
    })),
    recentQuotes: recentQuotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      createdAt: toISOString(q.createdAt),
    })),
    recentTickets: recentTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      priority: t.priority,
      subject: t.subject,
      createdAt: toISOString(t.createdAt),
    })),
    b2bAccount: b2bAccount
      ? {
          id: b2bAccount.id,
          status: deriveB2BStatus(b2bAccount.status, b2bAccount.expiresAt),
          companyNameEn: b2bAccount.companyNameEn,
          rejectionReason: b2bAccount.rejectionReason,
          reviewedAt: b2bAccount.reviewedAt
            ? toISOString(b2bAccount.reviewedAt)
            : null,
          createdAt: toISOString(b2bAccount.createdAt),
        }
      : null,
    identityVerification: {
      status: deriveVerificationStatus(
        customer.verificationStatus as VerificationStatusProjection["status"],
        customer.verificationExpiresAt,
      ),
      verifiedAt: customer.verifiedAt ? toISOString(customer.verifiedAt) : null,
      expiresAt: customer.verificationExpiresAt
        ? toISOString(customer.verificationExpiresAt)
        : null,
      submissionCount: verificationEventCount,
      latestEventId: latestVerificationEvent?.id ?? null,
    },
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      city: a.city,
      emirate: a.emirate,
      country: a.country,
      isDefault: a.isDefault,
    })),
  };
}

export interface B2BAccountStatusProjection {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  derivedStatus: B2BDerivedStatus;
  companyNameEn: string;
  companyNameAr: string | null;
  tradeLicenseNo: string;
  vatNumber: string | null;
  contactName: string | null;
  contactPhone: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  openRequest: {
    id: string;
    scope: "DOCUMENTS" | "DETAILS";
    types: DocumentType[];
    message: string;
    requestedAt: string;
  } | null;
}

export async function getCustomerB2BStatus(
  customerId: string,
): Promise<B2BAccountStatusProjection | null> {
  const account = await db.b2BAccount.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      companyNameEn: true,
      companyNameAr: true,
      tradeLicenseNo: true,
      vatNumber: true,
      contactName: true,
      contactPhone: true,
      rejectionReason: true,
      reviewedAt: true,
      verifiedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!account) return null;

  const openRequest = await db.documentRequest.findFirst({
    where: { b2bAccountId: account.id, status: "OPEN" },
    select: { id: true, scope: true, types: true, message: true, createdAt: true },
  });

  return {
    id: account.id,
    status: account.status,
    derivedStatus: deriveB2BStatus(account.status, account.expiresAt),
    companyNameEn: account.companyNameEn,
    companyNameAr: account.companyNameAr,
    tradeLicenseNo: account.tradeLicenseNo,
    vatNumber: account.vatNumber,
    contactName: account.contactName,
    contactPhone: account.contactPhone,
    rejectionReason: account.rejectionReason,
    reviewedAt: account.reviewedAt ? toISOString(account.reviewedAt) : null,
    verifiedAt: account.verifiedAt ? toISOString(account.verifiedAt) : null,
    expiresAt: account.expiresAt ? toISOString(account.expiresAt) : null,
    createdAt: toISOString(account.createdAt),
    openRequest: openRequest
      ? {
          id: openRequest.id,
          scope: openRequest.scope,
          types: openRequest.types,
          message: openRequest.message,
          requestedAt: toISOString(openRequest.createdAt),
        }
      : null,
  };
}
