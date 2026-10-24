"use client";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  mode?: "stepper" | "input";
}

export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
  mode = "stepper",
}: QuantitySelectorProps) {
  if (mode === "input") {
    return (
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={(e) => {
          let n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) n = min;
          n = Math.max(min, max !== undefined ? Math.min(max, n) : n);
          onChange(n);
        }}
        className="text-center text-body"
        style={{
          width: "72px",
          height: "36px",
          border: "1px solid var(--color-auth-input-border)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--color-auth-input-bg)",
          color: "var(--color-auth-label-text)",
          fontWeight: "var(--font-medium)",
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center"
      style={{
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-9 h-9 flex items-center justify-center cursor-pointer disabled:opacity-30"
        style={{
          border: "none",
          backgroundColor: "transparent",
          color: "var(--primitive-black)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line
            x1="2"
            y1="6"
            x2="10"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span
        className="w-9 text-center text-body"
        style={{
          color: "var(--primitive-black)",
          fontWeight: "var(--font-medium)",
        }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() =>
          onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)
        }
        disabled={max !== undefined && value >= max}
        className="w-9 h-9 flex items-center justify-center cursor-pointer disabled:opacity-30"
        style={{
          border: "none",
          backgroundColor: "transparent",
          color: "var(--primitive-black)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line
            x1="6"
            y1="2"
            x2="6"
            y2="10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="6"
            x2="10"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
