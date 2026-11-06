import Link from "next/link";
import type { AdminOrdersSummary } from "@/lib/db/queries/order";

interface Tile {
  key: string;
  label: string;
  value: number;
  sub: string;
  href: string;
  subHref?: string;
}

const tileStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  padding: "1.25rem 1.5rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
  marginBottom: "0.5rem",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-heading)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  lineHeight: "var(--leading-tight)",
};

const subStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  marginTop: "0.375rem",
};

export default function OrderSummaryTiles({
  all,
  fulfil,
  quote,
  awaiting,
  shipped,
  staleShipped,
  delivered,
  refundsOwed,
  closed,
}: AdminOrdersSummary) {
  const tiles: Tile[] = [
    {
      key: "all",
      label: "All orders",
      value: all,
      sub: "Every status",
      href: "/admin/orders",
    },
    {
      key: "fulfil",
      label: "To fulfil",
      value: fulfil,
      sub: "Paid, confirmed, processing or ready",
      href: "/admin/orders?view=FULFIL",
    },
    {
      key: "quote",
      label: "Needs shipping quote",
      value: quote,
      sub: "Waiting on a quote from you",
      href: "/admin/orders?view=QUOTE",
    },
    {
      key: "awaiting",
      label: "Awaiting customer",
      value: awaiting,
      sub: "Quote approval or payment",
      href: "/admin/orders?view=AWAITING",
    },
    {
      key: "shipped",
      label: "Shipped",
      value: shipped,
      sub: `${staleShipped} awaiting confirmation`,
      href: "/admin/orders?view=SHIPPED",
      subHref: "/admin/orders?stale=1",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: delivered,
      sub: "Completed orders",
      href: "/admin/orders?view=DELIVERED",
    },
    {
      key: "refunds",
      label: "Refunds owed",
      value: refundsOwed,
      sub: "Money still to send back",
      href: "/admin/orders?refund=OWED",
    },
    {
      key: "closed",
      label: "Cancelled or returned",
      value: closed,
      sub: "Closed without delivery",
      href: "/admin/orders?view=CLOSED",
    },
  ];

  const chips = tiles.flatMap((tile) =>
    tile.subHref
      ? [
          { key: tile.key, label: tile.label, value: tile.value, href: tile.href },
          {
            key: `${tile.key}-stale`,
            label: "Awaiting confirmation",
            value: staleShipped,
            href: tile.subHref,
          },
        ]
      : [{ key: tile.key, label: tile.label, value: tile.value, href: tile.href }],
  );

  return (
    <>
    <nav
      aria-label="Order views"
      className="flex lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        gap: "0.5rem",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        scrollSnapType: "x proximity",
        marginBottom: "1rem",
      }}
    >
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            flexShrink: 0,
            height: "36px",
            paddingInline: "0.875rem",
            whiteSpace: "nowrap",
            scrollSnapAlign: "start",
            textDecoration: "none",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
          }}
        >
          {chip.label}
          <span style={{ fontWeight: "var(--font-bold)", color: "#0b0b0b" }}>
            {chip.value.toLocaleString("en-US")}
          </span>
        </Link>
      ))}
    </nav>
    <div
      className="hidden lg:grid"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {tiles.map((tile) => (
        <div key={tile.key} style={tileStyle}>
          <Link
            href={tile.href}
            style={{ display: "block", textDecoration: "none" }}
          >
            <p style={labelStyle}>{tile.label}</p>
            <p style={valueStyle}>{tile.value.toLocaleString("en-US")}</p>
          </Link>
          {tile.subHref ? (
            <Link
              href={tile.subHref}
              style={{
                ...subStyle,
                display: "inline-block",
                color: "#0b0b0b",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {tile.sub}
            </Link>
          ) : (
            <p style={subStyle}>{tile.sub}</p>
          )}
        </div>
      ))}
    </div>
    </>
  );
}
