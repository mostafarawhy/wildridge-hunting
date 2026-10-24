"use client";

import QuoteExportButton from "@/components/admin/QuoteExportButton";

interface Props {
  selectedIds: string[];
  canExport: boolean;
  onClear: () => void;
}

export default function QuoteBulkBar({
  selectedIds,
  canExport,
  onClear,
}: Props) {
  const count = selectedIds.length;

  if (count === 0) return null;

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-semibold)",
            color: "#0b0b0b",
            marginInlineEnd: "0.5rem",
          }}
        >
          {count} selected
        </p>

        <QuoteExportButton
          canExport={canExport}
          count={count}
          quoteIds={selectedIds}
          label="Export selected"
        />

        <button
          type="button"
          onClick={onClear}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2.5rem",
            paddingInline: 0,
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            border: "none",
            borderRadius: "0",
            backgroundColor: "transparent",
            color: "#0b0b0b",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
