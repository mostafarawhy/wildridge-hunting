import Link from "next/link";

interface Props {
  decision: number;
  waiting: number;
  responded: number;
  active: number;
  expiring30: number;
  expired: number;
  suspended: number;
  rejected: number;
}

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

export default function B2BSummaryTiles({
  decision,
  waiting,
  responded,
  active,
  expiring30,
  expired,
  suspended,
  rejected,
}: Props) {
  const tiles: Tile[] = [
    {
      key: "decision",
      label: "Needs a decision",
      value: decision,
      sub: `${responded} ${responded === 1 ? "customer" : "customers"} responded`,
      href: "/admin/b2b?review=DECISION",
    },
    {
      key: "waiting",
      label: "Waiting on customer",
      value: waiting,
      sub: "Open document or detail requests",
      href: "/admin/b2b?review=WAITING",
    },
    {
      key: "active",
      label: "Active",
      value: active,
      sub: `${expiring30} expire within 30 days`,
      href: "/admin/b2b?status=APPROVED",
    },
    {
      key: "expired",
      label: "Expired",
      value: expired,
      sub: "Renewal needed",
      href: "/admin/b2b?status=EXPIRED",
    },
    {
      key: "suspended",
      label: "Suspended",
      value: suspended,
      sub: `${rejected} rejected`,
      href: "/admin/b2b?status=SUSPENDED",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href={tile.href}
          style={{ ...tileStyle, display: "block", textDecoration: "none" }}
        >
          <p style={labelStyle}>{tile.label}</p>
          <p style={valueStyle}>{tile.value.toLocaleString("en-US")}</p>
          <p style={subStyle}>{tile.sub}</p>
        </Link>
      ))}
    </div>
  );
}
