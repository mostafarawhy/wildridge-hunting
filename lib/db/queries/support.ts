import "server-only";

import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";
import type { TicketStatus } from "@/app/generated/prisma/client";

export interface CustomerSupportRequest {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status: TicketStatus;
  linked: {
    kind: "order" | "quote" | "b2b" | "verification";
    number: string | null;
  } | null;
  systemSubject: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getCustomerSupportRequests(
  customerId: string,
): Promise<CustomerSupportRequest[]> {
  const rows = await db.ticket.findMany({
    where: { createdByCustomerId: customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      order: { select: { orderNumber: true } },
      quoteRequest: { select: { quoteNumber: true } },
      b2bAccountId: true,
      verificationEventId: true,
    },
  });

  return rows.map((row) => {
    const linked = row.order
      ? { kind: "order" as const, number: row.order.orderNumber }
      : row.quoteRequest
        ? { kind: "quote" as const, number: row.quoteRequest.quoteNumber }
        : row.b2bAccountId
          ? { kind: "b2b" as const, number: null }
          : row.verificationEventId
            ? { kind: "verification" as const, number: null }
            : null;

    const systemSubject =
      (row.order !== null &&
        row.subject.startsWith(`Order ${row.order.orderNumber} — `)) ||
      (row.quoteRequest !== null &&
        row.subject.startsWith(`Quote ${row.quoteRequest.quoteNumber} — `));

    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      subject: row.subject,
      message: row.description,
      status: row.status,
      linked,
      systemSubject,
      createdAt: toISOString(row.createdAt),
      updatedAt: toISOString(row.updatedAt),
    };
  });
}

export interface SupportFormData {
  orders: { id: string; orderNumber: string; createdAt: string }[];
  quotes: { id: string; quoteNumber: string; createdAt: string }[];
  canQuote: boolean;
  hasBusinessAccount: boolean;
}

export async function getSupportFormData(
  customerId: string,
  prefill: { orderId?: string; quoteId?: string },
): Promise<SupportFormData> {
  const [customer, orderRows, quoteRows, b2bAccount] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: { role: true },
    }),
    db.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, orderNumber: true, createdAt: true },
    }),
    db.quoteRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, quoteNumber: true, createdAt: true },
    }),
    db.b2BAccount.findFirst({
      where: { customerId },
      select: { id: true },
    }),
  ]);

  let orders = orderRows;
  if (prefill.orderId && !orders.some((o) => o.id === prefill.orderId)) {
    const extra = await db.order.findFirst({
      where: { id: prefill.orderId, customerId },
      select: { id: true, orderNumber: true, createdAt: true },
    });
    if (extra) orders = [extra, ...orders];
  }

  let quotes = quoteRows;
  if (prefill.quoteId && !quotes.some((q) => q.id === prefill.quoteId)) {
    const extra = await db.quoteRequest.findFirst({
      where: { id: prefill.quoteId, customerId },
      select: { id: true, quoteNumber: true, createdAt: true },
    });
    if (extra) quotes = [extra, ...quotes];
  }

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: toISOString(o.createdAt),
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      createdAt: toISOString(q.createdAt),
    })),
    canQuote: customer?.role === "B2B" && quotes.length > 0,
    hasBusinessAccount: b2bAccount !== null,
  };
}
