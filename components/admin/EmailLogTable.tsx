"use client";

import Link from "next/link";
import DataTable from "@/components/admin/DataTable";
import { formatDateTime } from "@/lib/utils/date";
import { EMAIL_DEFAULTS } from "@/lib/email/defaults";
import type { EmailLogListItem } from "@/lib/db/queries/email-log";
import type { EmailStatus } from "@/app/generated/prisma/enums";

interface Props {
  rows: EmailLogListItem[];
}

const STATUS_PILL: Record<EmailStatus, { bg: string; color: string; label: string }> = {
  SENT: {
    bg: "var(--color-status-success-bg)",
    color: "var(--color-status-success-text)",
    label: "Sent",
  },
  FAILED: {
    bg: "var(--color-status-danger-bg)",
    color: "var(--color-status-danger-text)",
    label: "Failed",
  },
  PENDING: {
    bg: "var(--color-status-warning-bg)",
    color: "var(--color-status-warning-text)",
    label: "Pending",
  },
};

const SIMULATED_PILL = { bg: "#f3f4f6", color: "#374151", label: "Simulated" };

export default function EmailLogTable({ rows }: Props) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="No emails logged yet."
      columns={[
        {
          key: "when",
          header: "When",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDateTime(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "template",
          header: "Template",
          render: (row) => {
            const label = EMAIL_DEFAULTS[row.templateKey]?.label ?? row.templateKey;
            return (
              <div>
                <p style={{ color: "#0b0b0b" }}>{label}</p>
                <p
                  dir="ltr"
                  style={{
                    fontFamily: "monospace",
                    fontSize: "var(--text-body-sm)",
                    color: "#9a9a9a",
                  }}
                >
                  {row.templateKey}
                </p>
                {row.orderId ? (
                  <Link
                    href={`/admin/orders/${row.orderId}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: "var(--text-body-sm)" }}
                  >
                    View order
                  </Link>
                ) : row.quoteRequestId ? (
                  <Link
                    href={`/admin/quotes/${row.quoteRequestId}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: "var(--text-body-sm)" }}
                  >
                    View quote
                  </Link>
                ) : null}
              </div>
            );
          },
        },
        {
          key: "recipient",
          header: "Recipient",
          render: (row) => (
            <span dir="ltr" style={{ color: "#0b0b0b" }}>
              {row.toEmail}
            </span>
          ),
        },
        {
          key: "subject",
          header: "Subject",
          render: (row) => (
            <div>
              <p style={{ color: "#0b0b0b" }}>{row.subject ?? "—"}</p>
              {row.status === "FAILED" && row.error && (
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {row.error}
                </p>
              )}
            </div>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => {
            const pill =
              row.status === "SENT" && row.providerEmailId === null
                ? SIMULATED_PILL
                : STATUS_PILL[row.status];
            return (
              <span
                dir="ltr"
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
      ]}
    />
  );
}
