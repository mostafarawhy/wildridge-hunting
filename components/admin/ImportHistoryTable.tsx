"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import ImportFileDownloadButton from "@/components/admin/ImportFileDownloadButton";
import { formatDateTime } from "@/lib/utils/date";
import type { ImportHistoryItem } from "@/lib/db/queries/import-history";

interface Props {
  rows: ImportHistoryItem[];
  emptyMessage: string;
}

const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: "Imported", color: "#166534", bg: "#dcfce7" },
  COMPLETED_WITH_ERRORS: {
    label: "Completed with errors",
    color: "#854d0e",
    bg: "#fef9c3",
  },
  FAILED: { label: "Not imported", color: "#991b1b", bg: "#fee2e2" },
  PENDING: { label: "Pending", color: "#374151", bg: "#f3f4f6" },
  PROCESSING: { label: "Processing", color: "#374151", bg: "#f3f4f6" },
};

function resultText(row: ImportHistoryItem): string {
  if (row.status === "COMPLETED") {
    if (
      row.createdCount === null &&
      row.updatedCount === null &&
      row.unchangedCount === null &&
      row.addonsCreated === null &&
      row.addonsUpdated === null &&
      row.accessoryLists === null
    ) {
      return "—";
    }
    const parts = [
      row.createdCount ? `${row.createdCount} new` : null,
      row.updatedCount ? `${row.updatedCount} updated` : null,
      row.unchangedCount ? `${row.unchangedCount} unchanged` : null,
      row.addonsCreated ? `${row.addonsCreated} add-ons new` : null,
      row.addonsUpdated ? `${row.addonsUpdated} add-ons updated` : null,
      row.accessoryLists
        ? `${row.accessoryLists} accessory ${row.accessoryLists === 1 ? "list" : "lists"}`
        : null,
    ].filter((x): x is string => x !== null);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (row.status === "FAILED") {
    return row.problemCount === 0
      ? "Nothing imported"
      : `${row.problemCount} ${row.problemCount === 1 ? "problem" : "problems"}`;
  }
  return "—";
}

export default function ImportHistoryTable({ rows, emptyMessage }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/import/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage={emptyMessage}
      columns={[
        {
          key: "date",
          header: "Date",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDateTime(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "file",
          header: "File",
          render: (row) => (
            <Link
              href={`/admin/import/${row.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: "var(--color-action-primary)", textDecoration: "none" }}
            >
              {row.filename}
            </Link>
          ),
        },
        {
          key: "by",
          header: "Uploaded by",
          render: (row) => row.uploadedByName ?? "—",
        },
        { key: "result", header: "Result", render: (row) => resultText(row) },
        {
          key: "status",
          header: "Status",
          render: (row) => {
            const pill = STATUS_PILL[row.status] ?? STATUS_PILL.PENDING;
            return (
              <span
                style={{
                  display: "inline-block",
                  padding: "0.125rem 0.5rem",
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-semibold)",
                  color: pill.color,
                  backgroundColor: pill.bg,
                }}
              >
                {pill.label}
              </span>
            );
          },
        },
        {
          key: "original",
          header: "Original",
          render: (row) =>
            row.hasFile ? (
              <ImportFileDownloadButton
                batchId={row.id}
                filename={row.filename}
                variant="compact"
              />
            ) : (
              <span style={{ color: "#6b6b6b" }}>Not stored</span>
            ),
        },
        {
          key: "open",
          header: "",
          align: "end",
          render: () => (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                color: "#0b0b0b",
                fontWeight: "var(--font-semibold)",
                fontSize: "var(--text-body-sm)",
              }}
            >
              View
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ transform: "scaleX(-1)" }}
              >
                <path
                  d="M19 12H5M12 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ),
        },
      ]}
    />
  );
}
