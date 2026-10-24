"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import type { AdminStorePageRow } from "@/lib/db/queries/admin-pages";

interface Props {
  rows: AdminStorePageRow[];
}

const LOCALE_ORDER: Array<"en" | "ar" | "ru"> = ["en", "ar", "ru"];

const PAGE_PURPOSE: Record<string, string> = {
  terms: "Your terms of sale, as text",
  privacy: "How customer data is collected and used, as text",
  returns: "Return and exchange rules, as text",
  shipping: "Delivery terms, times and costs, as text",
  faq: "Questions and answers, grouped into categories",
  about: "Story, figures, mission, team and photos",
  contact: "Text under the header; channels come from Store Profile",
  stores: "Text under the header; showrooms come from Store Locations",
};

function formatLastEdited(updatedAt: string | null, lastEditorName: string | null): string {
  if (!updatedAt) return "Never edited";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(updatedAt));
  return `${date} · ${lastEditorName ?? "Unknown"}`;
}

export default function StorePagesTable({ rows }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.key}
      onRowClick={(row) => {
        const href = `/admin/pages/${row.key}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage="No store pages found."
      columns={[
        {
          key: "page",
          header: "Page",
          render: (row) => (
            <div>
              <div style={{ color: "#0b0b0b", fontWeight: "var(--font-semibold)", fontSize: "16px" }}>
                {row.label}
              </div>
              {PAGE_PURPOSE[row.key] && (
                <div style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                  {PAGE_PURPOSE[row.key]}
                </div>
              )}
              <div
                dir="ltr"
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-body-sm)",
                  color: "#9a9a9a",
                }}
              >
                /{row.key}
              </div>
            </div>
          ),
        },
        {
          key: "languages",
          header: "Languages",
          render: (row) => (
            <div style={{ display: "flex", gap: "0.375rem" }}>
              {LOCALE_ORDER.map((locale) => (
                <span
                  key={locale}
                  style={{
                    display: "inline-block",
                    paddingInline: "0.5rem",
                    paddingBlock: "0.125rem",
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                    backgroundColor: row.authored[locale] ? "#dbeafe" : "#f3f4f6",
                    color: row.authored[locale] ? "#1e40af" : "#9a9a9a",
                  }}
                >
                  {locale}
                </span>
              ))}
            </div>
          ),
        },
        {
          key: "lastEdited",
          header: "Last edited",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatLastEdited(row.updatedAt, row.lastEditorName)}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <span
              style={{
                display: "inline-block",
                paddingInline: "0.5rem",
                paddingBlock: "0.125rem",
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-semibold)",
                backgroundColor: row.published ? "#dcfce7" : "#f3f4f6",
                color: row.published ? "#166534" : "#374151",
              }}
            >
              {row.published ? "Published" : "Draft"}
            </span>
          ),
        },
        {
          key: "view",
          header: "View",
          align: "end",
          render: (row) =>
            row.published ? (
              <a
                href={`/en/${row.key}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#0b0b0b", fontWeight: "var(--font-medium)" }}
              >
                Open ↗
              </a>
            ) : (
              <span style={{ color: "#9a9a9a" }}>Not live</span>
            ),
        },
      ]}
    />
  );
}
