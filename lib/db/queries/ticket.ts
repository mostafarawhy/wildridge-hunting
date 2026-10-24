import "server-only";

import { db } from "@/lib/db/client";
import { toISOString, formatDisplayDate, dubaiDayBoundsUtc } from "@/lib/utils/date";
import {
  deriveVerificationStatus,
  type VerificationStatusProjection,
} from "@/lib/db/queries/verification";
import { deriveB2BStatus, type B2BDerivedStatus } from "@/lib/db/queries/b2b";
import type { TicketLinkKind } from "@/lib/utils/ticket-status";
import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketEventType,
  OrderStatus,
  QuoteContactReason,
  QuoteStatus,
  Prisma,
} from "@/app/generated/prisma/client";

export type { TicketStatus, TicketPriority, TicketCategory, QuoteContactReason };

// ─── List projection ──────────────────────────────────────────────────────────

export interface AdminTicketListItemProjection {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  contactEmail: string | null;
  linked: { kind: TicketLinkKind; label: string } | null;
  assignedToName: string | null;
  assignedToStaffId: string | null;
  source: "customer" | "staff" | null;
  createdAt: string;
  ageDays: number;
}

export interface AdminTicketListPage {
  items: AdminTicketListItemProjection[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Detail projection ────────────────────────────────────────────────────────

export interface AdminTicketEventProjection {
  id: string;
  type: TicketEventType;
  actor: string;
  staffName: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  note: string | null;
  createdAt: string;
}

export interface AdminTicketDetailProjection {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  contactEmail: string | null;
  quoteContactReason: QuoteContactReason | null;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
  quoteRequest: {
    id: string;
    quoteNumber: string;
    status: QuoteStatus;
    convertedOrderId: string | null;
  } | null;
  b2bAccount: {
    id: string;
    companyNameEn: string;
    tradeLicenseNo: string;
    derivedStatus: B2BDerivedStatus;
  } | null;
  verificationEvent: { id: string; status: string; customerName: string } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    verificationStatus: ReturnType<typeof deriveVerificationStatus>;
    latestVerificationEventId: string | null;
  } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdByName: string;
  createdByEmail: string;
  isStaffAuthored: boolean;
  events: AdminTicketEventProjection[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAdminTickets(opts?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  search?: string;
  includeClosed?: boolean;
  customerId?: string;
  category?: TicketCategory;
  linkKind?: "order" | "quote" | "b2b" | "verification" | "none";
  assigneeId?: string | null;
  source?: "customer" | "staff";
  from?: string;
  to?: string;
  sort?: "priority" | "newest" | "oldest" | "updated";
  page?: number;
  pageSize?: number;
}): Promise<AdminTicketListPage> {
  const where: Prisma.TicketWhereInput = {};

  if (opts?.status) {
    where.status = opts.status;
  } else if (!opts?.includeClosed) {
    where.status = { not: "CLOSED" };
  }

  if (opts?.priority) {
    where.priority = opts.priority;
  }

  if (opts?.customerId) {
    where.customerId = opts.customerId;
  }

  if (opts?.category) {
    where.category = opts.category;
  }

  if (opts?.linkKind === "order") {
    where.orderId = { not: null };
  } else if (opts?.linkKind === "quote") {
    where.quoteRequestId = { not: null };
  } else if (opts?.linkKind === "b2b") {
    where.b2bAccountId = { not: null };
  } else if (opts?.linkKind === "verification") {
    where.verificationEventId = { not: null };
  } else if (opts?.linkKind === "none") {
    where.orderId = null;
    where.quoteRequestId = null;
    where.b2bAccountId = null;
    where.verificationEventId = null;
  }

  if (opts?.assigneeId !== undefined) {
    where.assignedToStaffId = opts.assigneeId;
  }

  if (opts?.source === "customer") {
    where.createdByCustomerId = { not: null };
  } else if (opts?.source === "staff") {
    where.createdByStaffId = { not: null };
  }

  const term = opts?.search?.trim();
  if (term) {
    where.OR = [
      { ticketNumber: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
      { contactEmail: { contains: term, mode: "insensitive" } },
      { order: { orderNumber: { contains: term, mode: "insensitive" } } },
      { quoteRequest: { quoteNumber: { contains: term, mode: "insensitive" } } },
      { b2bAccount: { companyNameEn: { contains: term, mode: "insensitive" } } },
      { createdBy: { email: { contains: term, mode: "insensitive" } } },
      { assignedTo: { email: { contains: term, mode: "insensitive" } } },
    ];
  }

  const fromBounds = opts?.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts?.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    where.createdAt = {
      ...(fromBounds ? { gte: fromBounds.start } : {}),
      ...(toBounds ? { lt: toBounds.end } : {}),
    };
  }

  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    opts?.sort === "newest"
      ? [{ createdAt: "desc" }]
      : opts?.sort === "oldest"
        ? [{ createdAt: "asc" }]
        : opts?.sort === "updated"
          ? [{ updatedAt: "desc" }]
          : [{ priority: "desc" }, { createdAt: "asc" }];

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        contactEmail: true,
        createdAt: true,
        assignedToStaffId: true,
        createdByCustomerId: true,
        createdByStaffId: true,
        order: { select: { orderNumber: true } },
        quoteRequest: { select: { quoteNumber: true } },
        b2bAccount: { select: { companyNameEn: true } },
        verificationEvent: { select: { id: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);

  const now = Date.now();

  const items = rows.map((row) => ({
    id: row.id,
    ticketNumber: row.ticketNumber,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    contactEmail: row.contactEmail ?? null,
    linked: row.order
      ? { kind: "order" as const, label: row.order.orderNumber }
      : row.quoteRequest
        ? { kind: "quote" as const, label: row.quoteRequest.quoteNumber }
        : row.b2bAccount
          ? { kind: "b2b" as const, label: row.b2bAccount.companyNameEn }
          : row.verificationEvent
            ? { kind: "verification" as const, label: "Verification case" }
            : null,
    assignedToName: row.assignedTo?.name ?? null,
    assignedToStaffId: row.assignedToStaffId ?? null,
    source: row.createdByCustomerId
      ? ("customer" as const)
      : row.createdByStaffId
        ? ("staff" as const)
        : null,
    createdAt: toISOString(row.createdAt),
    ageDays: Math.floor((now - row.createdAt.getTime()) / 86400000),
  }));

  return { items, total, page, pageSize };
}

export async function getTicketQuickViewCounts(staffId: string): Promise<{
  active: number;
  unassigned: number;
  mine: number;
  urgent: number;
  waiting: number;
  customer: number;
}> {
  const notClosed: Prisma.TicketWhereInput = { status: { not: "CLOSED" } };

  const [active, unassigned, mine, urgent, waiting, customer] =
    await Promise.all([
      db.ticket.count({ where: notClosed }),
      db.ticket.count({ where: { ...notClosed, assignedToStaffId: null } }),
      db.ticket.count({ where: { ...notClosed, assignedToStaffId: staffId } }),
      db.ticket.count({ where: { ...notClosed, priority: "URGENT" } }),
      db.ticket.count({
        where: { ...notClosed, status: "WAITING_ON_CUSTOMER" },
      }),
      db.ticket.count({
        where: { ...notClosed, createdByCustomerId: { not: null } },
      }),
    ]);

  return { active, unassigned, mine, urgent, waiting, customer };
}

export async function getAdminTicketDetail(
  id: string,
): Promise<AdminTicketDetailProjection | null> {
  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      contactEmail: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      order: { select: { id: true, orderNumber: true, status: true, trackingNumber: true, trackingUrl: true } },
      quoteRequest: {
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          convertedOrderId: true,
        },
      },
      b2bAccount: {
        select: {
          id: true,
          companyNameEn: true,
          tradeLicenseNo: true,
          status: true,
          expiresAt: true,
        },
      },
      verificationEvent: {
        select: {
          id: true,
          status: true,
          customer: { select: { name: true } },
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          verificationStatus: true,
          verificationExpiresAt: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      createdByCustomer: { select: { name: true, email: true } },
      quoteContactReason: true,
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          actor: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          staff: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) return null;

  const latestVerificationEvent = ticket.customer
    ? await db.verificationEvent.findFirst({
        where: { customerId: ticket.customer.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;

  const events: AdminTicketEventProjection[] = ticket.events.map((event) => ({
    id: event.id,
    type: event.type,
    actor: event.actor,
    staffName: event.staff?.name ?? null,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    note: event.note ?? null,
    createdAt: toISOString(event.createdAt),
  }));

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    contactEmail: ticket.contactEmail ?? null,
    quoteContactReason: ticket.quoteContactReason ?? null,
    createdAt: toISOString(ticket.createdAt),
    resolvedAt: ticket.resolvedAt ? toISOString(ticket.resolvedAt) : null,
    closedAt: ticket.closedAt ? toISOString(ticket.closedAt) : null,
    order: ticket.order
      ? {
          id: ticket.order.id,
          orderNumber: ticket.order.orderNumber,
          status: ticket.order.status,
          trackingNumber: ticket.order.trackingNumber ?? null,
          trackingUrl: ticket.order.trackingUrl ?? null,
        }
      : null,
    quoteRequest: ticket.quoteRequest
      ? {
          id: ticket.quoteRequest.id,
          quoteNumber: ticket.quoteRequest.quoteNumber,
          status: ticket.quoteRequest.status,
          convertedOrderId: ticket.quoteRequest.convertedOrderId ?? null,
        }
      : null,
    b2bAccount: ticket.b2bAccount
      ? {
          id: ticket.b2bAccount.id,
          companyNameEn: ticket.b2bAccount.companyNameEn,
          tradeLicenseNo: ticket.b2bAccount.tradeLicenseNo,
          derivedStatus: deriveB2BStatus(
            ticket.b2bAccount.status,
            ticket.b2bAccount.expiresAt,
          ),
        }
      : null,
    verificationEvent: ticket.verificationEvent
      ? {
          id: ticket.verificationEvent.id,
          status: ticket.verificationEvent.status,
          customerName: ticket.verificationEvent.customer.name,
        }
      : null,
    customer: ticket.customer
      ? {
          id: ticket.customer.id,
          name: ticket.customer.name,
          email: ticket.customer.email,
          verificationStatus: deriveVerificationStatus(
            ticket.customer
              .verificationStatus as VerificationStatusProjection["status"],
            ticket.customer.verificationExpiresAt,
          ),
          latestVerificationEventId: latestVerificationEvent?.id ?? null,
        }
      : null,
    assignedTo: ticket.assignedTo ?? null,
    createdByName: ticket.createdBy?.name ?? ticket.createdByCustomer?.name ?? "—",
    createdByEmail: ticket.createdBy?.email ?? ticket.createdByCustomer?.email ?? ticket.contactEmail ?? "",
    isStaffAuthored: ticket.createdBy !== null,
    events,
  };
}

export async function getTicketCustomerOtherTickets(
  ticketId: string,
  customerId: string,
): Promise<{
  total: number;
  items: {
    id: string;
    ticketNumber: string;
    status: TicketStatus;
    createdAt: string;
  }[];
}> {
  const where = { customerId, id: { not: ticketId } };

  const [total, tickets] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    total,
    items: tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      createdAt: toISOString(t.createdAt),
    })),
  };
}

// ─── Link lookup ──────────────────────────────────────────────────────────────

export interface TicketLinkOption {
  kind: TicketLinkKind;
  id: string;
  label: string;
  sublabel: string;
  customerId: string | null;
  customerEmail: string | null;
}

export async function searchTicketLinkTargets(
  kind: TicketLinkKind,
  query: string,
): Promise<TicketLinkOption[]> {
  const term = query.trim();
  if (!term) return [];

  switch (kind) {
    case "order": {
      const rows = await db.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: term, mode: "insensitive" } },
            { customer: { name: { contains: term, mode: "insensitive" } } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      return rows.map((row) => ({
        kind: "order" as const,
        id: row.id,
        label: row.orderNumber,
        sublabel: row.customer ? `${row.customer.name} · ${row.customer.email}` : "",
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      }));
    }
    case "quote": {
      const rows = await db.quoteRequest.findMany({
        where: {
          OR: [
            { quoteNumber: { contains: term, mode: "insensitive" } },
            { customer: { name: { contains: term, mode: "insensitive" } } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          quoteNumber: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      return rows.map((row) => ({
        kind: "quote" as const,
        id: row.id,
        label: row.quoteNumber,
        sublabel: row.customer ? `${row.customer.name} · ${row.customer.email}` : "",
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      }));
    }
    case "b2b": {
      const rows = await db.b2BAccount.findMany({
        where: {
          OR: [
            { companyNameEn: { contains: term, mode: "insensitive" } },
            { tradeLicenseNo: { contains: term, mode: "insensitive" } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          companyNameEn: true,
          tradeLicenseNo: true,
          customer: { select: { id: true, email: true } },
        },
      });
      return rows.map((row) => ({
        kind: "b2b" as const,
        id: row.id,
        label: row.companyNameEn,
        sublabel: row.customer
          ? `${row.tradeLicenseNo} · ${row.customer.email}`
          : row.tradeLicenseNo,
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      }));
    }
    case "verification": {
      const rows = await db.verificationEvent.findMany({
        where: {
          OR: [
            { customer: { name: { contains: term, mode: "insensitive" } } },
            { customer: { email: { contains: term, mode: "insensitive" } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          createdAt: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      return rows.map((row) => ({
        kind: "verification" as const,
        id: row.id,
        label: row.customer?.name ?? "",
        sublabel: row.customer
          ? `${row.customer.email} · ${row.status} · ${formatDisplayDate(toISOString(row.createdAt), "en")}`
          : `${row.status} · ${formatDisplayDate(toISOString(row.createdAt), "en")}`,
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      }));
    }
    case "customer": {
      const rows = await db.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, email: true },
      });
      return rows.map((row) => ({
        kind: "customer" as const,
        id: row.id,
        label: row.name,
        sublabel: row.email,
        customerId: row.id,
        customerEmail: row.email,
      }));
    }
  }
}

export async function getTicketLinkTarget(
  kind: TicketLinkKind,
  id: string,
): Promise<TicketLinkOption | null> {
  switch (kind) {
    case "order": {
      const row = await db.order.findUnique({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) return null;
      return {
        kind: "order",
        id: row.id,
        label: row.orderNumber,
        sublabel: row.customer ? `${row.customer.name} · ${row.customer.email}` : "",
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      };
    }
    case "quote": {
      const row = await db.quoteRequest.findUnique({
        where: { id },
        select: {
          id: true,
          quoteNumber: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) return null;
      return {
        kind: "quote",
        id: row.id,
        label: row.quoteNumber,
        sublabel: row.customer ? `${row.customer.name} · ${row.customer.email}` : "",
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      };
    }
    case "b2b": {
      const row = await db.b2BAccount.findUnique({
        where: { id },
        select: {
          id: true,
          companyNameEn: true,
          tradeLicenseNo: true,
          customer: { select: { id: true, email: true } },
        },
      });
      if (!row) return null;
      return {
        kind: "b2b",
        id: row.id,
        label: row.companyNameEn,
        sublabel: row.customer
          ? `${row.tradeLicenseNo} · ${row.customer.email}`
          : row.tradeLicenseNo,
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      };
    }
    case "verification": {
      const row = await db.verificationEvent.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) return null;
      return {
        kind: "verification",
        id: row.id,
        label: row.customer?.name ?? "",
        sublabel: row.customer
          ? `${row.customer.email} · ${row.status} · ${formatDisplayDate(toISOString(row.createdAt), "en")}`
          : `${row.status} · ${formatDisplayDate(toISOString(row.createdAt), "en")}`,
        customerId: row.customer?.id ?? null,
        customerEmail: row.customer?.email ?? null,
      };
    }
    case "customer": {
      const row = await db.customer.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, deletedAt: true },
      });
      if (!row || row.deletedAt) return null;
      return {
        kind: "customer",
        id: row.id,
        label: row.name,
        sublabel: row.email,
        customerId: row.id,
        customerEmail: row.email,
      };
    }
  }
}
