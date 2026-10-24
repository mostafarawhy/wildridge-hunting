import Link from "next/link";

interface Props {
  newQuotes: number;
  openTickets: number;
  pendingB2B: number;
  staleShipped: number;
  staleShippedDays: number;
  ordersAwaitingAction: number;
  refundsOwed: number;
}

type Tone = "danger" | "warning" | "info" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  danger: "#991b1b",
  warning: "#854d0e",
  info: "#1e40af",
  neutral: "#6b6b6b",
};

interface QueueItem {
  label: string;
  context: string;
  href: string;
  tone: Tone;
  count: number;
}

export default function DashboardActionList({
  newQuotes,
  openTickets,
  pendingB2B,
  staleShipped,
  staleShippedDays,
  ordersAwaitingAction,
  refundsOwed,
}: Props) {
  const items: QueueItem[] = [
    {
      label: "Refunds to issue",
      context: "Money still owed to customers",
      href: "/admin/orders?refund=OWED",
      tone: "danger",
      count: refundsOwed,
    },
    {
      label: "Open tickets",
      context: "Need resolution",
      href: "/admin/tickets",
      tone: "danger",
      count: openTickets,
    },
    {
      label: "New quotes",
      context: "Awaiting pricing",
      href: "/admin/quotes?status=NEW",
      tone: "warning",
      count: newQuotes,
    },
    {
      label: "Awaiting action",
      context: "Orders need processing",
      href: "/admin/orders?view=FULFIL",
      tone: "info",
      count: ordersAwaitingAction,
    },
    {
      label: "Awaiting delivery confirmation",
      context: `Shipped more than ${staleShippedDays} ${staleShippedDays === 1 ? "day" : "days"} ago`,
      href: "/admin/orders?stale=1",
      tone: "warning",
      count: staleShipped,
    },
    {
      label: "Pending B2B",
      context: "Applications awaiting approval",
      href: "/admin/b2b",
      tone: "info",
      count: pendingB2B,
    },
  ];

  const sorted = [
    ...items.filter((i) => i.count > 0),
    ...items.filter((i) => i.count === 0),
  ];

  const activeCount = items.filter((i) => i.count > 0).length;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-semibold)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            color: "#6b6b6b",
          }}
        >
          Needs attention
        </p>
        {activeCount > 0 && (
          <span
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              color: "#991b1b",
              backgroundColor: "#fee2e2",
              paddingInline: "0.5rem",
              paddingBlock: "0.125rem",
            }}
          >
            {activeCount} active
          </span>
        )}
      </div>
      <div>
        {sorted.map((item, idx) => {
          const muted = item.count === 0;
          const tone: Tone = muted ? "neutral" : item.tone;
          const dotColor = TONE_COLOR[tone];

          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.875rem 1.25rem",
                borderBottom:
                  idx < sorted.length - 1
                    ? "1px solid var(--color-shop-divider)"
                    : "none",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: dotColor,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    color: muted ? "#6b6b6b" : "#0b0b0b",
                    fontWeight: muted
                      ? "var(--font-normal)"
                      : "var(--font-medium)",
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    marginTop: "0.125rem",
                  }}
                >
                  {item.context}
                </p>
              </div>
              {muted ? (
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    flexShrink: 0,
                  }}
                >
                  ✓ clear
                </span>
              ) : (
                <span
                  dir="ltr"
                  style={{
                    fontSize: "var(--text-heading)",
                    fontWeight: "var(--font-bold)",
                    color: dotColor,
                    lineHeight: "var(--leading-tight)",
                    flexShrink: 0,
                  }}
                >
                  {item.count}
                </span>
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ flexShrink: 0, color: "#6b6b6b" }}
              >
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
