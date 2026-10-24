import type { OrderStatus } from "@/app/generated/prisma/client";

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";

const STATUS_TONE_MAP: Record<OrderStatus, StatusTone> = {
  DELIVERED: "success",
  PAID: "success",
  CONFIRMED: "success",
  PROCESSING: "info",
  READY_TO_SHIP: "info",
  SHIPPED: "info",
  PENDING: "warning",
  PAYMENT_PENDING: "warning",
  PAYMENT_FAILED: "danger",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
  AWAITING_SHIPPING_QUOTE: "warning",
  AWAITING_QUOTE_APPROVAL: "warning",
  AWAITING_MANUAL_PAYMENT: "warning",
  RETURNED: "neutral",
};

export function getOrderStatusTone(status: OrderStatus): StatusTone {
  return STATUS_TONE_MAP[status];
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  PAYMENT_PENDING: [],
  PAYMENT_FAILED: [],
  PAID: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["READY_TO_SHIP"],
  READY_TO_SHIP: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: [],
  AWAITING_SHIPPING_QUOTE: ["AWAITING_QUOTE_APPROVAL"],
  AWAITING_QUOTE_APPROVAL: ["PAYMENT_PENDING"],
  AWAITING_MANUAL_PAYMENT: [],
  RETURNED: [],
};

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  "AWAITING_SHIPPING_QUOTE",
  "AWAITING_QUOTE_APPROVAL",
  "AWAITING_MANUAL_PAYMENT",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
];

export const RETURNABLE_STATUSES: OrderStatus[] = ["SHIPPED", "DELIVERED"];

export const HELD_STOCK_STATUSES: OrderStatus[] = [
  "AWAITING_SHIPPING_QUOTE",
  "AWAITING_QUOTE_APPROVAL",
  "PAYMENT_PENDING",
];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (
    status === "DELIVERED" ||
    status === "CANCELLED" ||
    status === "REFUNDED" ||
    status === "PARTIALLY_REFUNDED" ||
    status === "RETURNED"
  );
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_FAILED: "Payment Failed",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  AWAITING_SHIPPING_QUOTE: "Awaiting Shipping Quote",
  AWAITING_QUOTE_APPROVAL: "Awaiting Quote Approval",
  AWAITING_MANUAL_PAYMENT: "Awaiting Offline Payment",
  RETURNED: "Returned",
};

export const ORDER_FORWARD_CHAIN: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
];

export function getForwardJumpTargets(status: OrderStatus): OrderStatus[] {
  const idx = ORDER_FORWARD_CHAIN.indexOf(status);
  if (idx === -1) return [];
  if (status === "SHIPPED") return ["DELIVERED"];
  const shippedIdx = ORDER_FORWARD_CHAIN.indexOf("SHIPPED");
  if (idx >= shippedIdx) return [];
  return ORDER_FORWARD_CHAIN.slice(idx + 1, shippedIdx + 1);
}

export function getForwardPath(
  from: OrderStatus,
  to: OrderStatus,
): OrderStatus[] {
  if (!getForwardJumpTargets(from).includes(to)) return [];
  const fromIdx = ORDER_FORWARD_CHAIN.indexOf(from);
  const toIdx = ORDER_FORWARD_CHAIN.indexOf(to);
  return ORDER_FORWARD_CHAIN.slice(fromIdx + 1, toIdx + 1);
}

export const REVENUE_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_REFUNDED",
];
