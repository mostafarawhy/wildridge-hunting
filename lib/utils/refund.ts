import type { RefundMethod } from "@/app/generated/prisma/client";
import { roundMoney } from "@/lib/utils/currency";

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  ORIGINAL_PAYMENT: "Original payment",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD_TERMINAL: "Card terminal",
  OTHER: "Other",
};

export type RefundState = "NONE" | "OWED" | "PARTIAL" | "REFUNDED";

export function refundStateOf(refundDue: number, refunded: number): RefundState {
  const due = roundMoney(refundDue);
  const paidBack = roundMoney(refunded);
  if (due === 0) return "NONE";
  if (paidBack >= due) return "REFUNDED";
  if (paidBack > 0) return "PARTIAL";
  return "OWED";
}

export const REFUND_STATE_LABELS: Record<Exclude<RefundState, "NONE">, string> = {
  OWED: "Owed",
  PARTIAL: "Partly refunded",
  REFUNDED: "Refunded",
};
