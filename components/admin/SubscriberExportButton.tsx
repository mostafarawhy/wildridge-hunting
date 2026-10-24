"use client";

import { BRAND } from "@/lib/config/brand";
import { useState, useTransition } from "react";
import { exportSubscribersAction } from "@/lib/actions/newsletter-admin";
import type { SubscriberExportRow } from "@/lib/actions/newsletter-admin";
import { dubaiDay, formatDateTime } from "@/lib/utils/date";
import { KLAVIYO_STATUS_LABELS } from "@/lib/utils/subscriber-status";
import type { SubscriberFilters } from "@/lib/validations/newsletter";

interface Props {
  filters: SubscriberFilters;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const SOURCE_LABELS: Record<SubscriberExportRow["source"], string> = {
  HOME: "Homepage",
  POPUP: "Popup",
};

function csvCell(value: string | null): string {
  let s = value == null ? "" : value;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: SubscriberExportRow[]): string {
  const lines = [
    "Email,Language,Source,Signed up,Consent given,Unsubscribed,Klaviyo",
    ...rows.map((r) =>
      [
        r.email,
        LANGUAGE_LABELS[r.locale] ?? r.locale,
        SOURCE_LABELS[r.source],
        formatDateTime(r.createdAt, "en"),
        formatDateTime(r.consentAt, "en"),
        r.unsubscribedAt ? formatDateTime(r.unsubscribedAt, "en") : "",
        r.klaviyo ? KLAVIYO_STATUS_LABELS[r.klaviyo] : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export default function SubscriberExportButton({ filters }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportSubscribersAction(filters);
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
      a.download = `${BRAND.slug}-subscribers-${dubaiDay(new Date())}.csv`;
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
