import Link from "next/link";

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const commitButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  transition: "opacity 150ms",
  backgroundColor: "var(--color-action-primary)",
  color: "#ffffff",
};

export default function AdminNotFound() {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "1.5rem",
        maxWidth: "36rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0b0b0b" }}>
        Page not found
      </h1>
      <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "#374151" }}>
        This page doesn&apos;t exist, or the record was removed. Check the link, or go
        back to the dashboard.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <Link href="/admin" style={{ ...commitButtonStyle, textDecoration: "none" }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
