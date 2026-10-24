import type { QuoteStatus } from "@/lib/db/queries/quote";
import { getQuoteStatusTone, type StatusTone } from "@/lib/utils/quote-status";

interface Props {
  status: QuoteStatus;
  label: string;
}

const TONE_TOKENS: Record<StatusTone, { border: string; text: string }> = {
  success: {
    border: "var(--primitive-green)",
    text: "var(--primitive-green)",
  },
  info: {
    border: "var(--primitive-blue)",
    text: "var(--primitive-blue)",
  },
  warning: {
    border: "var(--primitive-amber)",
    text: "var(--primitive-amber)",
  },
  danger: {
    border: "var(--color-action-primary)",
    text: "var(--color-action-primary)",
  },
  neutral: {
    border: "var(--primitive-muted-gray)",
    text: "var(--primitive-muted-gray)",
  },
};

export default function QuoteStatusBadge({ status, label }: Props) {
  const tone = getQuoteStatusTone(status);
  const tokens = TONE_TOKENS[tone];

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1875rem 0.5rem",
        fontSize: "var(--text-eyebrow)",
        fontWeight: "var(--font-black)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        borderRadius: "var(--radius-none)",
        border: `1px solid ${tokens.border}`,
        color: tokens.text,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
