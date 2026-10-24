interface Props {
  label: string;
  value: string | number;
  hint?: string;
}

export default function StatsCard({ label, value, hint }: Props) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1.25rem 1.5rem",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: "#6b6b6b",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "var(--text-heading)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {value}
      </p>
      {hint && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginTop: "0.375rem",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
