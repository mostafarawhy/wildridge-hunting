"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import { formatDisplayDate } from "@/lib/utils/date";
import type { VerificationEventListItem } from "@/lib/db/queries/verification";

type VerificationStatus = VerificationEventListItem["status"];

const STATUS_STYLES: Record<
  VerificationStatus,
  { backgroundColor: string; color: string }
> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#166534" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
  NOT_REQUIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const PROVIDER_LABELS: Record<VerificationEventListItem["provider"], string> = {
  SUMSUB: "Automated check",
  UAE_PASS: "UAE PASS",
  MANUAL_REVIEW: "Manual Review",
};

function StatusPill({ status }: { status: VerificationStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        borderRadius: "0",
        ...style,
      }}
    >
      {status}
    </span>
  );
}

interface Props {
  rows: VerificationEventListItem[];
}

export default function VerificationEventsTable({ rows }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/verification/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage="No verification submissions found."
      columns={[
        {
          key: "customer",
          header: "Customer",
          render: (row) => (
            <div>
              <div
                style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}
              >
                {row.customerName}
              </div>
              <div style={{ fontSize: "var(--text-label)", color: "#6b6b6b" }}>
                {row.customerEmail}
              </div>
            </div>
          ),
        },
        {
          key: "provider",
          header: "Provider",
          render: (row) => (
            <span style={{ color: "#0b0b0b" }}>
              {PROVIDER_LABELS[row.provider]}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <div>
              <StatusPill status={row.displayStatus} />
              {row.displayStatus !== row.status && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "var(--text-label)",
                    color: "#6b6b6b",
                  }}
                >
                  Approved
                  {row.reviewedAt
                    ? ` ${formatDisplayDate(row.reviewedAt, "en")}`
                    : ""}
                </div>
              )}
              {row.awaitingCustomer && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "var(--text-label)",
                    color: "#6b6b6b",
                  }}
                >
                  Waiting on customer
                </div>
              )}
              {row.customerResponded && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    color: "#1e40af",
                  }}
                >
                  Customer responded
                </div>
              )}
            </div>
          ),
        },
        {
          key: "docs",
          header: "Docs",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>{row.documentCount}</span>
          ),
          align: "end",
        },
        {
          key: "submitted",
          header: "Submitted",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
          align: "end",
        },
        {
          key: "reviewedBy",
          header: "Reviewed By",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {row.reviewedByName ?? "—"}
            </span>
          ),
          align: "end",
        },
      ]}
    />
  );
}
