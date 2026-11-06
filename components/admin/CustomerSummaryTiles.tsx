import Link from "next/link";

interface Props {
  total: number;
  b2b: number;
  b2c: number;
  verified: number;
  expired: number;
  rejected: number;
  pending: number;
  suspended: number;
  canReviewVerification: boolean;
}

interface Tile {
  key: string;
  label: string;
  value: number;
  sub: string;
  href?: string;
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

export default function CustomerSummaryTiles({
  total,
  b2b,
  b2c,
  verified,
  expired,
  rejected,
  pending,
  suspended,
  canReviewVerification,
}: Props) {
  const tiles: Tile[] = [
    {
      key: "total",
      label: "Customers",
      value: total,
      sub: "All accounts",
    },
    {
      key: "b2b",
      label: "Business (B2B)",
      value: b2b,
      sub: `${b2c} retail (B2C)`,
      href: "/admin/customers?role=B2B",
    },
    {
      key: "verified",
      label: "ID verified",
      value: verified,
      sub: `${expired} expired · ${rejected} rejected`,
      href: "/admin/customers?verification=APPROVED",
    },
    {
      key: "pending",
      label: "Awaiting ID review",
      value: pending,
      sub: canReviewVerification
        ? "Open the queue"
        : "In the verification queue",
      href: canReviewVerification
        ? "/admin/verification?status=PENDING"
        : undefined,
    },
    {
      key: "suspended",
      label: "Suspended",
      value: suspended,
      sub: "Can't sign in",
      href: "/admin/customers?status=SUSPENDED",
    },
  ];

  return (
    <>
    <nav
      aria-label="Customer views"
      className="flex lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        gap: "0.5rem",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        scrollSnapType: "x proximity",
        marginBottom: "1rem",
      }}
    >
      {tiles.map((tile) => {
        const chipContent = (
          <>
            {tile.label}
            <span style={chipValueStyle}>
              {tile.value.toLocaleString("en-US")}
            </span>
          </>
        );
        return tile.href ? (
          <Link key={tile.key} href={tile.href} style={chipStyle}>
            {chipContent}
          </Link>
        ) : (
          <span key={tile.key} style={chipStyle}>
            {chipContent}
          </span>
        );
      })}
    </nav>
    <div
      className="hidden lg:grid"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {tiles.map((tile) => {
        const content = (
          <>
            <p style={labelStyle}>{tile.label}</p>
            <p style={valueStyle}>{tile.value.toLocaleString("en-US")}</p>
            <p style={subStyle}>{tile.sub}</p>
          </>
        );
        return tile.href ? (
          <Link
            key={tile.key}
            href={tile.href}
            style={{ ...tileStyle, display: "block", textDecoration: "none" }}
          >
            {content}
          </Link>
        ) : (
          <div key={tile.key} style={tileStyle}>
            {content}
          </div>
        );
      })}
    </div>
    </>
  );
}
