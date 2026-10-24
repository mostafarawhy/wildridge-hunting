interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AdminPageHeader({ title, subtitle, actions }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "2rem",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#6b6b6b",
              marginTop: "0.25rem",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ flexShrink: 0, marginInlineStart: "auto" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
