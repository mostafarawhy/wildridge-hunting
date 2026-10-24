import type { QuoteStatus } from "@/lib/db/queries/quote";
import { QUOTE_STATUS_LABELS } from "@/lib/utils/quote-status";

const STATUS_STYLES: Record<
  QuoteStatus,
  { backgroundColor: string; color: string }
> = {
  NEW: { backgroundColor: "#fef9c3", color: "#854d0e" },
  CONTACTED: { backgroundColor: "#dbeafe", color: "#1e40af" },
  QUOTED: { backgroundColor: "#dcfce7", color: "#166534" },
  CLOSED: { backgroundColor: "#f3f4f6", color: "#374151" },
  CANCELLED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  ACCEPTED: { backgroundColor: "#bbf7d0", color: "#14532d" },
};

export default function QuoteStatusPill({
  status,
  label,
}: {
  status: QuoteStatus;
  label?: string;
}) {
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
      {label ?? QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
