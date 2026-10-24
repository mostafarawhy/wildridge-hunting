"use client";

import { BRAND } from "@/lib/config/brand";
import { useState, useTransition } from "react";
import { exportLoyaltyActivityAction } from "@/lib/actions/loyalty-admin";
import type { LoyaltyActivityExportRow } from "@/lib/actions/loyalty-admin";
import { dubaiDay, formatDateTime } from "@/lib/utils/date";
import { LOYALTY_TYPE_LABELS } from "@/lib/utils/loyalty-labels";
import type { LoyaltyActivityFilters } from "@/lib/validations/loyalty";

interface Props {
  filters: LoyaltyActivityFilters;
}

function csvCell(value: string | null): string {
  let s = value == null ? "" : value;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: LoyaltyActivityExportRow[]): string {
  const lines = [
    "Date,Customer,Type,Points,Balance after,Order,Reason,Adjusted by",
    ...rows.map((r) =>
      [
        formatDateTime(r.createdAt, "en"),
        r.customerEmail,
        LOYALTY_TYPE_LABELS[r.type],
        String(r.delta),
        String(r.balanceAfter),
        r.orderNumber ?? "",
        r.reason ?? "",
        r.adjustedBy ?? "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export default function LoyaltyExportButton({ filters }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportLoyaltyActivityAction(filters);
      if (!result.success) {
        setError(result.error);
        return;
      }

      const blob = new Blob([rowsToCsv(result.rows)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${BRAND.slug}-loyalty-${dubaiDay(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={handleExport}
        disabled={pending}
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
        {pending ? "Exporting…" : "Export CSV"}
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
    </div>
  );
}
