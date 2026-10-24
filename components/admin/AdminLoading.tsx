import { BRAND } from "@/lib/config/brand";
export default function AdminLoading() {
  return (
    <div
      className="admin-loading"
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        width: "100%",
        minHeight: "calc(100dvh - 4rem)",
      }}
    >
      <span className="admin-loading-ring" aria-hidden="true" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.625rem",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "0.875rem", color: "var(--color-action-primary)" }}>
          {BRAND.name}
        </span>
        <span
          className="admin-loading-label"
          style={{ fontSize: "0.75rem", color: "var(--color-content-tertiary)" }}
        >
          Loading
        </span>
      </div>
    </div>
  );
}
