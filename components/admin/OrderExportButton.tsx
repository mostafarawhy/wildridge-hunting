"use client";

import { BRAND } from "@/lib/config/brand";
import { useState, useTransition } from "react";
import { exportOrdersAction } from "@/lib/actions/order-export";
import type {
  OrderExportLine,
  OrderExportRow,
} from "@/lib/actions/order-export";
import { dubaiDay } from "@/lib/utils/date";
import type { AdminOrderFilters } from "@/lib/db/queries/order";

interface Props {
  canExport: boolean;
  count: number;
  filters?: AdminOrderFilters;
  orderIds?: string[];
  label?: string;
}

type Cell = string | number | Date | null;

interface Column<T> {
  header: string;
  width: number;
  kind: "text" | "money" | "date" | "number";
  get: (row: T) => Cell;
}

const COLUMNS: Column<OrderExportRow>[] = [
  { header: "Order", width: 16, kind: "text", get: (r) => r.orderNumber },
  { header: "Placed", width: 12, kind: "date", get: (r) => r.placed },
  { header: "Status", width: 20, kind: "text", get: (r) => r.status },
  { header: "Payment", width: 10, kind: "text", get: (r) => r.payment },
  { header: "Source", width: 10, kind: "text", get: (r) => r.source },
  { header: "Customer", width: 24, kind: "text", get: (r) => r.customer },
  { header: "Email", width: 30, kind: "text", get: (r) => r.email },
  { header: "Units", width: 8, kind: "number", get: (r) => r.units },
  { header: "Subtotal", width: 12, kind: "money", get: (r) => r.subtotal },
  { header: "Shipping", width: 12, kind: "money", get: (r) => r.shipping },
  { header: "Discount", width: 12, kind: "money", get: (r) => r.discount },
  {
    header: "Points discount",
    width: 15,
    kind: "money",
    get: (r) => r.pointsDiscount,
  },
  { header: "VAT", width: 12, kind: "money", get: (r) => r.vat },
  { header: "Total", width: 12, kind: "money", get: (r) => r.total },
  { header: "Received", width: 12, kind: "money", get: (r) => r.received },
  { header: "Refund due", width: 12, kind: "money", get: (r) => r.refundDue },
  { header: "Refunded", width: 12, kind: "money", get: (r) => r.refunded },
  { header: "Owed", width: 12, kind: "money", get: (r) => r.owed },
  { header: "Refund state", width: 16, kind: "text", get: (r) => r.refundState },
  { header: "Coupon", width: 14, kind: "text", get: (r) => r.coupon },
  { header: "Carrier", width: 16, kind: "text", get: (r) => r.carrier },
  { header: "Tracking", width: 22, kind: "text", get: (r) => r.tracking },
  { header: "Shipped on", width: 12, kind: "date", get: (r) => r.shippedOn },
  { header: "Delivered on", width: 12, kind: "date", get: (r) => r.deliveredOn },
];

const LINE_COLUMNS: Column<OrderExportLine>[] = [
  { header: "Order", width: 16, kind: "text", get: (r) => r.orderNumber },
  { header: "Placed", width: 12, kind: "date", get: (r) => r.placed },
  { header: "Status", width: 20, kind: "text", get: (r) => r.status },
  { header: "Type", width: 10, kind: "text", get: (r) => r.type },
  { header: "Item", width: 44, kind: "text", get: (r) => r.item },
  { header: "Qty", width: 8, kind: "number", get: (r) => r.quantity },
  { header: "Unit price", width: 12, kind: "money", get: (r) => r.unitPrice },
  { header: "Line total", width: 12, kind: "money", get: (r) => r.lineTotal },
  { header: "Serials", width: 40, kind: "text", get: (r) => r.serials },
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

export default function OrderExportButton({
  canExport,
  count,
  filters,
  orderIds,
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
      const result = await exportOrdersAction(
        orderIds ? { orderIds } : { filters: filters ?? {} },
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
        "Orders",
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
      a.download = `${BRAND.slug}-orders-${dubaiDay(new Date())}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (result.truncated) {
        setNotice(
          `The file holds the first ${result.rows.length.toLocaleString("en-US")} orders. Narrow the filters to export the rest.`,
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
        disabled={pending || (orderIds === undefined && count === 0)}
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
