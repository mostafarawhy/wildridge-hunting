"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  B2BApplicationRowProjection,
  B2BDerivedStatus,
} from "@/lib/db/queries/b2b";

const STATUS_STYLES: Record<
  B2BDerivedStatus,
  { backgroundColor: string; color: string }
> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#166534" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  SUSPENDED: { backgroundColor: "#f3f4f6", color: "#374151" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

function StatusPill({ status }: { status: B2BDerivedStatus }) {
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
  rows: B2BApplicationRowProjection[];
  filtered: boolean;
}

function dayCount(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

export default function B2BApplicationsTable({ rows, filtered }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/b2b/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage={
        filtered
          ? "No business accounts match these filters."
          : "No business accounts yet."
      }
      columns={[
        {
          key: "company",
          header: "Company",
          render: (row) => (
            <div>
              <div
                style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}
              >
                {row.companyNameEn}
              </div>
              <div
                dir="ltr"
                style={{
                  fontSize: "var(--text-label)",
                  color: "#6b6b6b",
                  fontFamily: "monospace",
                }}
              >
                {row.tradeLicenseNo}
              </div>
            </div>
          ),
        },
        {
          key: "contact",
          header: "Contact",
          render: (row) => (
            <div>
              <div style={{ color: "#0b0b0b" }}>{row.contactName}</div>
              <div style={{ fontSize: "var(--text-label)", color: "#6b6b6b" }}>
                {row.customerEmail}
              </div>
            </div>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <div>
              <StatusPill status={row.derivedStatus} />
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
          key: "expires",
          header: "Expires",
          render: (row) => (
            <div>
              <span style={{ color: "#6b6b6b" }}>
                {row.expiresAt ? formatDisplayDate(row.expiresAt, "en") : "—"}
              </span>
              {row.derivedStatus === "APPROVED" &&
                row.expiryDays !== null &&
                row.expiryDays <= 30 && (
                  <div
                    style={{
                      marginTop: "0.25rem",
                      fontSize: "var(--text-label)",
                      color: "#92400e",
                    }}
                  >
                    {row.expiryDays === 0
                      ? "Today"
                      : `In ${dayCount(row.expiryDays)}`}
                  </div>
                )}
              {row.derivedStatus === "EXPIRED" && row.expiryDays !== null && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "var(--text-label)",
                    color: "#991b1b",
                  }}
                >
                  {Math.abs(row.expiryDays) === 0
                    ? "Expired today"
                    : `${dayCount(Math.abs(row.expiryDays))} ago`}
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
          key: "quotes",
          header: "Quotes",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>{row.quoteCount}</span>
          ),
          align: "end",
        },
        {
          key: "submitted",
          header: "Applied",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
          align: "end",
        },
      ]}
    />
  );
}
