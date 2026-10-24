import { formatDateTime } from "@/lib/utils/date";

interface Row {
  label: string;
  value: string;
}

interface Props {
  status: string;
  statusStyle: React.CSSProperties;
  summary: string;
  rows: Row[];
  latestNote: { actorName: string; createdAt: string; text: string } | null;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  padding: "0.875rem 0",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  paddingInline: "0.625rem",
  paddingBlock: "0.25rem",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  borderRadius: "0",
};

export default function ReviewStatusCard({
  status,
  statusStyle,
  summary,
  rows,
  latestNote,
}: Props) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p style={labelStyle}>Where this review stands</p>
      </div>
      <div style={{ padding: "0 1.25rem" }}>
        <div style={rowStyle}>
          <p style={{ ...labelStyle, flexShrink: 0 }}>Status</p>
          <p
            style={{
              ...valueStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: "0.5rem",
              textAlign: "end",
            }}
          >
            <span style={{ ...pillStyle, ...statusStyle }}>{status}</span>
            <span>{summary}</span>
          </p>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              ...rowStyle,
              borderTop: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
            <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
          </div>
        ))}
        {latestNote && (
          <div
            style={{
              padding: "0.875rem 0",
              borderTop: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={labelStyle}>
              Latest note · {latestNote.actorName} ·{" "}
              {formatDateTime(latestNote.createdAt, "en")}
            </p>
            <blockquote
              style={{
                margin: 0,
                marginTop: "0.5rem",
                borderInlineStart: "3px solid #fde68a",
                paddingInlineStart: "0.75rem",
                fontSize: "var(--text-body-sm)",
                color: "#78350f",
                fontStyle: "italic",
                whiteSpace: "pre-line",
              }}
            >
              {latestNote.text}
            </blockquote>
          </div>
        )}
      </div>
    </div>
  );
}
