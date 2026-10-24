"use client";

import { BRAND } from "@/lib/config/brand";
import { useState, useTransition } from "react";
import { exportQuotesAction } from "@/lib/actions/quote-export";
import type {
  QuoteExportLine,
  QuoteExportRow,
} from "@/lib/actions/quote-export";
import { dubaiDay } from "@/lib/utils/date";
import type { AdminQuoteFilters } from "@/lib/db/queries/quote";

interface Props {
  canExport: boolean;
  count: number;
  filters?: AdminQuoteFilters;
  quoteIds?: string[];
  label?: string;
}

type Cell = string | number | Date | null;

interface Column<T> {
  header: string;
  width: number;
  kind: "text" | "money" | "date" | "number";
  get: (row: T) => Cell;
}

const COLUMNS: Column<QuoteExportRow>[] = [
  { header: "Quote", width: 16, kind: "text", get: (r) => r.quoteNumber },
  { header: "Submitted", width: 12, kind: "date", get: (r) => r.submitted },
  { header: "Status", width: 14, kind: "text", get: (r) => r.status },
  { header: "Order", width: 16, kind: "text", get: (r) => r.order },
  { header: "Company", width: 30, kind: "text", get: (r) => r.company },
  { header: "Customer", width: 24, kind: "text", get: (r) => r.customer },
  { header: "Email", width: 30, kind: "text", get: (r) => r.email },
  { header: "Trade licence", width: 20, kind: "text", get: (r) => r.tradeLicence },
  { header: "VAT no.", width: 20, kind: "text", get: (r) => r.vatNumber },
  { header: "Lines", width: 8, kind: "number", get: (r) => r.lines },
  {
    header: "Units requested",
    width: 16,
    kind: "number",
    get: (r) => r.unitsRequested,
  },
  { header: "Units quoted", width: 14, kind: "number", get: (r) => r.unitsQuoted },
  { header: "Items total", width: 12, kind: "money", get: (r) => r.itemsTotal },
  { header: "Shipping", width: 12, kind: "money", get: (r) => r.shipping },
  { header: "Quoted total", width: 13, kind: "money", get: (r) => r.quotedTotal },
  {
    header: "Shipping method",
    width: 22,
    kind: "text",
    get: (r) => r.shippingMethod,
  },
  { header: "Quoted on", width: 12, kind: "date", get: (r) => r.quotedOn },
  { header: "Quoted by", width: 20, kind: "text", get: (r) => r.quotedBy },
];

const LINE_COLUMNS: Column<QuoteExportLine>[] = [
  { header: "Quote", width: 16, kind: "text", get: (r) => r.quoteNumber },
  { header: "Status", width: 14, kind: "text", get: (r) => r.status },
  { header: "Type", width: 10, kind: "text", get: (r) => r.type },
  { header: "SKU", width: 20, kind: "text", get: (r) => r.sku },
  { header: "Item", width: 44, kind: "text", get: (r) => r.item },
  {
    header: "Requested qty",
    width: 14,
    kind: "number",
    get: (r) => r.requestedQty,
  },
  { header: "Quoted qty", width: 12, kind: "number", get: (r) => r.quotedQty },
  { header: "Unit price", width: 12, kind: "money", get: (r) => r.unitPrice },
  { header: "Line total", width: 12, kind: "money", get: (r) => r.lineTotal },
];

function textCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function dayToDate(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function buildSheet<T>(
  XLSX: typeof import("xlsx"),
  columns: Column<T>[],
  rows: T[],
) {
  const header = columns.map((c) => c.header);
  const body: Cell[][] = rows.map((row) =>
    columns.map((c) => {
      const value = c.get(row);
      if (c.kind === "date") {
        return typeof value === "string" && value !== ""
          ? dayToDate(value)
          : null;
      }
      if (typeof value === "string") return textCell(value);
      return value;
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true });

  columns.forEach((c, colIdx) => {
    if (c.kind === "text" || c.kind === "number") return;
    for (let rowIdx = 1; rowIdx <= body.length; rowIdx++) {
      const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })];
      if (cell) cell.z = c.kind === "money" ? "0.00" : "yyyy-mm-dd";
    }
  });

  ws["!cols"] = columns.map((c) => ({ wch: c.width }));
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(body.length, 1), c: columns.length - 1 },
    }),
  };

  return ws;
}

export default function QuoteExportButton({
  canExport,
  count,
  filters,
  quoteIds,
  label,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canExport) return null;

  function handleExport() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await exportQuotesAction(
        quoteIds ? { quoteIds } : { filters: filters ?? {} },
      );
      if (!result.success) {
        setError(result.error);
        return;
      }

      const XLSX = await import("xlsx");

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        buildSheet(XLSX, COLUMNS, result.rows),
        "Quotes",
      );
      XLSX.utils.book_append_sheet(
        wb,
        buildSheet(XLSX, LINE_COLUMNS, result.lines),
        "Lines",
      );
      const bytes = XLSX.write(wb, {
        type: "array",
        bookType: "xlsx",
        cellDates: true,
      }) as ArrayBuffer;

      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${BRAND.slug}-quotes-${dubaiDay(new Date())}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (result.truncated) {
        setNotice(
          `The file holds the first ${result.rows.length.toLocaleString("en-US")} quotes. Narrow the filters to export the rest.`,
        );
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "0.5rem",
      }}
    >
      <button
        type="button"
        onClick={handleExport}
        disabled={pending || (quoteIds === undefined && count === 0)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: "2.5rem",
          paddingInline: "1.25rem",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
          border: "none",
          borderRadius: "0",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending
          ? "Exporting…"
          : (label ?? `Export ${count.toLocaleString("en-US")}`)}
      </button>
      {error && (
        <p
          role="alert"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#991b1b",
            maxWidth: "20rem",
            textAlign: "end",
          }}
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            maxWidth: "20rem",
            textAlign: "end",
          }}
        >
          {notice}
        </p>
      )}
    </div>
  );
}
