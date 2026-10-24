import type { PipelineEntry } from "@/lib/db/queries/admin-dashboard";

interface Props {
  pipeline: PipelineEntry[];
}

export default function OrderPipelineCard({ pipeline }: Props) {
  const maxCount = Math.max(...pipeline.map((p) => p.count), 1);

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
          Order pipeline
        </p>
      </div>
      <div style={{ padding: "0.5rem 1.25rem" }}>
        {pipeline.map((entry, idx) => {
          const barPct = (entry.count / maxCount) * 100;
          const isDelivered = entry.status === "DELIVERED";

          return (
            <div
              key={entry.status}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 0",
                borderBottom:
                  idx < pipeline.length - 1
                    ? "1px solid var(--color-shop-divider)"
                    : "none",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  width: "7rem",
                  flexShrink: 0,
                }}
              >
                {entry.label}
              </p>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: "#f5f5f5",
                }}
              >
                <div
                  style={{
                    width: `${barPct}%`,
                    height: "100%",
                    backgroundColor: isDelivered ? "#166534" : "#1e40af",
                    transition: "width 0.2s",
                  }}
                />
              </div>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-semibold)",
                  color: "#0b0b0b",
                  width: "2rem",
                  textAlign: "end",
                  flexShrink: 0,
                }}
              >
                {entry.count}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
