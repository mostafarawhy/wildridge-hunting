import { formatAED } from "@/lib/utils/currency";
import KpiSparkline from "./KpiSparkline";

interface Props {
  label: string;
  value: number;
  deltaPct?: number | null;
  newInPeriod?: number;
  sparkline: number[];
  format?: "currency" | "number";
}

export default function KpiCard({
  label,
  value,
  deltaPct,
  newInPeriod,
  sparkline,
  format = "number",
}: Props) {
  const displayValue =
    format === "currency"
      ? formatAED(value, "en")
      : value.toLocaleString("en-AE");

  let deltaNode: React.ReactNode = null;
  if (newInPeriod !== undefined) {
    const color = newInPeriod > 0 ? "#166534" : "#6b6b6b";
    deltaNode = (
      <span style={{ fontSize: "var(--text-body-sm)", color }}>
        {newInPeriod > 0 ? `+${newInPeriod} new` : "No new"}
      </span>
    );
  } else if (deltaPct !== undefined) {
    if (deltaPct === null) {
      deltaNode = (
        <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          —
        </span>
      );
    } else if (deltaPct > 0) {
      deltaNode = (
        <span style={{ fontSize: "var(--text-body-sm)", color: "#166534" }}>
          ↑ {deltaPct}%
        </span>
      );
    } else {
      deltaNode = (
        <span style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          ↓ {Math.abs(deltaPct)}%
        </span>
      );
    }
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
          {label}
        </p>
        <KpiSparkline data={sparkline} />
      </div>
      <p
        dir="ltr"
        style={{
          fontSize: "var(--text-heading)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
          lineHeight: "var(--leading-tight)",
        }}
      >
        {displayValue}
      </p>
      {deltaNode && <div>{deltaNode}</div>}
    </div>
  );
}
