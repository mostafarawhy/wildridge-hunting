import Link from "next/link";
import type { AdminQuotesSummary } from "@/lib/db/queries/quote";

interface Tile {
  key: string;
  label: string;
  value: number;
  sub: string;
  href: string;
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

const chipStyle: React.CSSProperties = {
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
};

const chipValueStyle: React.CSSProperties = {
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
};

export default function QuoteSummaryTiles({
  all,
  pricing,
  awaiting,
  accepted,
  converted,
  closed,
}: AdminQuotesSummary) {
  const tiles: Tile[] = [
    {
      key: "all",
      label: "All quotes",
      value: all,
      sub: "",
      href: "/admin/quotes",
    },
    {
      key: "pricing",
      label: "Needs pricing",
      value: pricing,
      sub: "New and contacted",
      href: "/admin/quotes?view=PRICING",
    },
    {
      key: "awaiting",
      label: "Awaiting customer",
      value: awaiting,
      sub: "Quoted, not yet accepted",
      href: "/admin/quotes?view=AWAITING",
    },
    {
      key: "accepted",
      label: "Accepted, not placed",
      value: accepted,
      sub: "",
      href: "/admin/quotes?view=ACCEPTED",
    },
    {
      key: "converted",
      label: "Converted to orders",
      value: converted,
      sub: "",
      href: "/admin/quotes?view=CONVERTED",
    },
    {
      key: "closed",
      label: "Closed",
      value: closed,
      sub: "Closed and cancelled",
      href: "/admin/quotes?view=CLOSED",
    },
  ];

  return (
    <>
    <nav
      aria-label="Quote views"
      className="flex lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        gap: "0.5rem",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        scrollSnapType: "x proximity",
        marginBottom: "1rem",
      }}
    >
      {tiles.map((tile) => (
        <Link key={tile.key} href={tile.href} style={chipStyle}>
          {tile.label}
          <span style={chipValueStyle}>
            {tile.value.toLocaleString("en-US")}
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
          {tile.sub && <p style={subStyle}>{tile.sub}</p>}
        </div>
      ))}
    </div>
    </>
  );
}
