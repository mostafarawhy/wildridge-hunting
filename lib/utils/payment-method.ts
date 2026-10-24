import type { PaymentMethod } from "@/app/generated/prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD_TERMINAL: "Card Terminal",
  OTHER: "Other",
};

export function paymentMethodLabel(method: string): string {
  return method in PAYMENT_METHOD_LABELS
    ? PAYMENT_METHOD_LABELS[method as PaymentMethod]
    : method;
}
