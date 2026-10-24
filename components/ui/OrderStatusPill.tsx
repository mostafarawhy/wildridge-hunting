import type { OrderStatus } from "@/lib/db/queries/order";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";

const STATUS_STYLES: Record<
  OrderStatus,
  { backgroundColor: string; color: string }
> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  PAYMENT_PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  PAYMENT_FAILED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  PAID: { backgroundColor: "#dcfce7", color: "#166534" },
  CONFIRMED: { backgroundColor: "#dcfce7", color: "#166534" },
  PROCESSING: { backgroundColor: "#dbeafe", color: "#1e40af" },
  READY_TO_SHIP: { backgroundColor: "#dbeafe", color: "#1e40af" },
  SHIPPED: { backgroundColor: "#dbeafe", color: "#1e40af" },
  DELIVERED: { backgroundColor: "#dcfce7", color: "#166534" },
  CANCELLED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  REFUNDED: { backgroundColor: "#f3f4f6", color: "#374151" },
  PARTIALLY_REFUNDED: { backgroundColor: "#f3f4f6", color: "#374151" },
  AWAITING_SHIPPING_QUOTE: { backgroundColor: "#fef9c3", color: "#854d0e" },
  AWAITING_QUOTE_APPROVAL: { backgroundColor: "#fef9c3", color: "#854d0e" },
  AWAITING_MANUAL_PAYMENT: { backgroundColor: "#fef9c3", color: "#854d0e" },
  RETURNED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

export default function OrderStatusPill({ status }: { status: OrderStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
