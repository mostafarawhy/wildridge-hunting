"use client";

import Link from "next/link";
import DataTable from "@/components/admin/DataTable";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  LOYALTY_TYPE_LABELS,
  LOYALTY_TYPE_PILL,
} from "@/lib/utils/loyalty-labels";
import type { AdminLoyaltyActivityRow } from "@/lib/db/queries/loyalty";

interface Props {
  rows: AdminLoyaltyActivityRow[];
}

function signedPoints(delta: number): string {
  if (delta === 0) return "0";
  const abs = Math.abs(delta).toLocaleString("en-US");
  return delta > 0 ? `+${abs}` : `−${abs}`;
}

export default function LoyaltyActivityTable({ rows }: Props) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="No loyalty activity yet."
      columns={[
        {
          key: "date",
          header: "Date",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "customer",
          header: "Customer",
          render: (row) => (
            <Link
              href={`/admin/customers/${row.customerId}`}
              dir="ltr"
              style={{
                fontWeight: "var(--font-medium)",
                color: "#0b0b0b",
                textDecoration: "none",
              }}
            >
              {row.customerEmail}
            </Link>
          ),
        },
        {
          key: "type",
          header: "Type",
          render: (row) => {
            const pill = LOYALTY_TYPE_PILL[row.type];
            return (
              <span
                style={{
                  backgroundColor: pill.bg,
                  color: pill.text,
                  paddingInline: "0.5rem",
                  paddingBlock: "0.125rem",
                  fontSize: "var(--text-label)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {LOYALTY_TYPE_LABELS[row.type]}
              </span>
            );
          },
        },
        {
          key: "points",
          header: "Points",
          align: "end",
          render: (row) => (
            <span
              dir="ltr"
              style={{
                color:
                  row.delta > 0
                    ? "#166534"
                    : row.delta < 0
                      ? "#991b1b"
                      : "#0b0b0b",
              }}
            >
              {signedPoints(row.delta)}
            </span>
          ),
        },
        {
          key: "balance",
          header: "Balance",
          align: "end",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {row.balanceAfter.toLocaleString("en-US")}
            </span>
          ),
        },
        {
          key: "details",
          header: "Details",
          render: (row) => {
            if (row.orderNumber && row.orderId) {
              return (
                <Link
                  href={`/admin/orders/${row.orderId}`}
                  dir="ltr"
                  style={{
                    fontFamily: "monospace",
                    color: "var(--color-action-primary)",
                    textDecoration: "none",
                  }}
                >
                  {row.orderNumber}
                </Link>
              );
            }
            if (row.reason) {
              return (
                <span style={{ color: "#6b6b6b" }}>
                  {row.adjustedBy ? `${row.reason} · ${row.adjustedBy}` : row.reason}
                </span>
              );
            }
            return <span style={{ color: "#6b6b6b" }}>—</span>;
          },
        },
      ]}
    />
  );
}
