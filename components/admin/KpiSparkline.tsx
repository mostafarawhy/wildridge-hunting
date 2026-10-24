"use client";

import { LineChart, Line } from "recharts";

interface Props {
  data: number[];
}

export default function KpiSparkline({ data }: Props) {
  if (data.length === 0) return null;
  const chartData = data.map((value, i) => ({ i, value }));
  return (
    <LineChart
      width={56}
      height={20}
      data={chartData}
      margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
    >
      <Line
        type="monotone"
        dataKey="value"
        stroke="#1e40af"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
