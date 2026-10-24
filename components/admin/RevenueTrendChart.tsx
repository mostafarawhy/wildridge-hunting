"use client";

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatAED } from "@/lib/utils/currency";
import type { DailyBucket } from "@/lib/db/queries/admin-dashboard";

interface Props {
  current: DailyBucket[];
  previous: DailyBucket[];
}

export default function RevenueTrendChart({ current, previous }: Props) {
  if (current.length === 0) {
    return (
      <div style={{ height: 120, backgroundColor: "#f5f5f5" }} />
    );
  }

  const data = current.map((d, i) => ({
    date: d.date,
    current: d.value,
    previous: previous[i]?.value ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revCurrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#dbeafe" stopOpacity={0.7} />
            <stop offset="95%" stopColor="#dbeafe" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const curr = (payload.find((p) => p.dataKey === "current")?.value ??
              0) as number;
            const prev = (payload.find((p) => p.dataKey === "previous")
              ?.value ?? 0) as number;
            return (
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-shop-divider)",
                  padding: "0.5rem 0.75rem",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                <p style={{ color: "#6b6b6b", marginBottom: "0.25rem" }}>
                  {label}
                </p>
                <p style={{ color: "#1e40af" }}>{formatAED(curr, "en")}</p>
                <p style={{ color: "#6b6b6b" }}>
                  Prev: {formatAED(prev, "en")}
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="previous"
          stroke="#d1d5db"
          strokeWidth={1}
          strokeDasharray="4 2"
          fillOpacity={0}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="current"
          stroke="#1e40af"
          strokeWidth={1.5}
          fill="url(#revCurrFill)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
