import type { TicketStatus, TicketPriority, TicketCategory, QuoteContactReason, TicketEventType } from "@/app/generated/prisma/client";
import type { StatusTone } from "@/lib/utils/order-status";

export type { StatusTone };

const STATUS_TONE_MAP: Record<TicketStatus, StatusTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING_ON_CUSTOMER: "neutral",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export function getTicketStatusTone(status: TicketStatus): StatusTone {
  return STATUS_TONE_MAP[status];
}

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"],
  WAITING_ON_CUSTOMER: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

export function isTerminalTicketStatus(status: TicketStatus): boolean {
  return status === "CLOSED";
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_ON_CUSTOMER: "Waiting on Customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_TONE_MAP: Record<TicketPriority, StatusTone> = {
  URGENT: "danger",
  HIGH: "warning",
  NORMAL: "info",
  LOW: "neutral",
};

export function getTicketPriorityTone(p: TicketPriority): StatusTone {
  return PRIORITY_TONE_MAP[p];
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  REFUND: "Refund",
  RETURN: "Return",
  ORDER_ISSUE: "Order Issue",
  QUOTE_ISSUE: "Quote Issue",
  PAYMENT: "Payment",
  SHIPPING: "Shipping",
  GENERAL: "General",
  B2B: "B2B Account",
  VERIFICATION: "ID Verification",
};

export const TICKET_CONTACT_REASON_LABELS: Record<QuoteContactReason, string> = {
  PRICING: "Pricing",
  SHIPPING: "Shipping",
  QUANTITIES: "Quantities",
  PAYMENT_TERMS: "Payment terms",
  OTHER: "Something else",
};

export const TICKET_EVENT_LABELS: Record<TicketEventType, string> = {
  STATUS_CHANGE: "Status Change",
  ASSIGNMENT: "Assignment",
  COMMENT: "Comment",
};

export type TicketLinkKind = "order" | "quote" | "b2b" | "verification" | "customer";
export const TICKET_LINK_KIND: Record<TicketCategory, TicketLinkKind> = { REFUND: "order", RETURN: "order", ORDER_ISSUE: "order", QUOTE_ISSUE: "quote", PAYMENT: "order", SHIPPING: "order", GENERAL: "customer", B2B: "b2b", VERIFICATION: "verification" };
export const TICKET_LINK_KIND_LABELS: Record<TicketLinkKind, string> = { order: "Order", quote: "Quote", b2b: "B2B Account", verification: "Verification Case", customer: "Customer" };

export interface TicketQuickViewParams {
  sort?: "priority" | "newest" | "oldest" | "updated";
  assignee?: "unassigned" | "me";
  priority?: TicketPriority;
  status?: TicketStatus;
  source?: "customer" | "staff";
}

export interface TicketQuickView {
  key: "active" | "latest" | "unassigned" | "mine" | "urgent" | "waiting" | "customer";
  label: string;
  params: TicketQuickViewParams;
}

export const TICKET_QUICK_VIEWS: TicketQuickView[] = [
  { key: "active", label: "Active", params: {} },
  { key: "latest", label: "Latest", params: { sort: "newest" } },
  { key: "unassigned", label: "Unassigned", params: { assignee: "unassigned" } },
  { key: "mine", label: "Mine", params: { assignee: "me" } },
  { key: "urgent", label: "Urgent", params: { priority: "URGENT" } },
  { key: "waiting", label: "Waiting on customer", params: { status: "WAITING_ON_CUSTOMER" } },
  { key: "customer", label: "Customer requests", params: { source: "customer" } },
];
