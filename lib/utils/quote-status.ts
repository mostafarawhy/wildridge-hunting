import type { QuoteStatus } from "@/app/generated/prisma/client";
import type { StatusTone } from "@/lib/utils/order-status";

export type { StatusTone };

const STATUS_TONE_MAP: Record<QuoteStatus, StatusTone> = {
  NEW: "warning",
  CONTACTED: "info",
  QUOTED: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
  ACCEPTED: "success",
};

export function getQuoteStatusTone(status: QuoteStatus): StatusTone {
  return STATUS_TONE_MAP[status];
}

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  NEW: ["CONTACTED", "QUOTED", "CANCELLED"],
  CONTACTED: ["QUOTED", "CANCELLED"],
  QUOTED: ["ACCEPTED", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
  ACCEPTED: [],
};

export function isTerminalQuoteStatus(status: QuoteStatus): boolean {
  return status === "CLOSED" || status === "CANCELLED" || status === "ACCEPTED";
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  ACCEPTED: "Accepted",
};

export const CONVERTED_QUOTE_LABEL = "Converted";
