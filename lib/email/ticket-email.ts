import "server-only";

import { db } from "@/lib/db/client";
import { emailDate } from "@/lib/email/order-email";
import { adminUrl } from "@/lib/email/links";
import {
  STAFF_SUPPORT_NOTE,
  type EmailChromeBadge,
  type EmailChromeBadgeTone,
  type EmailChromeOptions,
  type EmailInfoRow,
} from "@/lib/email/chrome";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  getTicketPriorityTone,
  getTicketStatusTone,
} from "@/lib/utils/ticket-status";

export interface TicketEmailData {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  categoryLabel: string;
  priorityLabel: string;
  priorityTone: EmailChromeBadgeTone;
  statusLabel: string;
  statusTone: EmailChromeBadgeTone;
  openedDate: string;
  assigneeName: string | null;
  customerLabel: string | null;
  linkedLabel: string | null;
  adminUrl: string;
}

export async function loadTicketEmailData(
  ticketId: string,
): Promise<TicketEmailData | null> {
  try {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        contactEmail: true,
        assignedTo: { select: { name: true, email: true } },
        customer: { select: { name: true, email: true } },
        order: { select: { orderNumber: true } },
        quoteRequest: { select: { quoteNumber: true } },
        b2bAccount: { select: { companyNameEn: true } },
        verificationEventId: true,
      },
    });

    if (!ticket) return null;

    const customerLabel = ticket.customer
      ? ticket.customer.name
        ? `${ticket.customer.name} · ${ticket.customer.email}`
        : ticket.customer.email
      : (ticket.contactEmail ?? null);

    const linkedLabel = ticket.order
      ? `Order ${ticket.order.orderNumber}`
      : ticket.quoteRequest
        ? `Quote ${ticket.quoteRequest.quoteNumber}`
        : ticket.b2bAccount
          ? `B2B account ${ticket.b2bAccount.companyNameEn}`
          : ticket.verificationEventId
            ? "Verification case"
            : null;

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      categoryLabel: TICKET_CATEGORY_LABELS[ticket.category],
      priorityLabel: TICKET_PRIORITY_LABELS[ticket.priority],
      priorityTone: getTicketPriorityTone(ticket.priority),
      statusLabel: TICKET_STATUS_LABELS[ticket.status],
      statusTone: getTicketStatusTone(ticket.status),
      openedDate: emailDate(ticket.createdAt),
      assigneeName: ticket.assignedTo?.name ?? null,
      customerLabel,
      linkedLabel,
      adminUrl: adminUrl(`/tickets/${ticket.id}`),
    };
  } catch (err) {
    console.error("[loadTicketEmailData]", ticketId, err);
    return null;
  }
}

export function staffTicketChrome(
  data: TicketEmailData,
  opts: {
    badges?: EmailChromeBadge[];
    extraRows?: EmailInfoRow[];
    excerpt?: { label: string; text: string };
    recipientName?: string;
    transparencyNote?: string;
  } = {},
): EmailChromeOptions {
  return {
    recipientName: opts.recipientName,
    badges: opts.badges ?? [
      { text: data.priorityLabel, tone: data.priorityTone },
      { text: data.categoryLabel, tone: "neutral" },
    ],
    infoRows: [
      { label: "Ticket", value: data.ticketNumber },
      { label: "Subject", value: data.subject },
      ...(data.linkedLabel ? [{ label: "Linked", value: data.linkedLabel }] : []),
      ...(data.customerLabel
        ? [{ label: "Customer", value: data.customerLabel }]
        : []),
      { label: "Assigned to", value: data.assigneeName ?? "Unassigned" },
      { label: "Opened", value: data.openedDate },
      ...(opts.extraRows ?? []),
    ],
    ctaUrl: data.adminUrl || undefined,
    messageExcerpt: opts.excerpt,
    transparencyNote: opts.transparencyNote ?? STAFF_SUPPORT_NOTE,
  };
}

export function customerTicketChrome(
  data: TicketEmailData,
  opts: {
    recipientName?: string;
    excerpt?: { label: string; text: string };
    transparencyNote?: string;
  } = {},
): EmailChromeOptions {
  return {
    recipientName: opts.recipientName,
    badges: [
      { text: data.statusLabel, tone: data.statusTone },
      { text: data.categoryLabel, tone: "neutral" },
    ],
    infoRows: [
      { label: "Ticket", value: data.ticketNumber },
      { label: "Subject", value: data.subject },
      ...(data.linkedLabel ? [{ label: "Regarding", value: data.linkedLabel }] : []),
      { label: "Opened", value: data.openedDate },
    ],
    messageExcerpt: opts.excerpt,
    showSupport: true,
    transparencyNote: opts.transparencyNote,
  };
}
