import type { TicketStatus } from "@/lib/db/queries/ticket";
import { TICKET_STATUS_LABELS } from "@/lib/utils/ticket-status";

const STATUS_STYLES: Record<
  TicketStatus,
  { backgroundColor: string; color: string }
> = {
  OPEN: { backgroundColor: "#fef9c3", color: "#854d0e" },
  IN_PROGRESS: { backgroundColor: "#dbeafe", color: "#1e40af" },
  WAITING_ON_CUSTOMER: { backgroundColor: "#f3f4f6", color: "#374151" },
  RESOLVED: { backgroundColor: "#dcfce7", color: "#166534" },
  CLOSED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

export default function TicketStatusPill({ status }: { status: TicketStatus }) {
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
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}
