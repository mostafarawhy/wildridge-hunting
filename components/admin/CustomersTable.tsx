"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { AdminCustomerListItemProjection } from "@/lib/db/queries/customer";

interface Props {
  rows: AdminCustomerListItemProjection[];
  hasFilters: boolean;
}

const pillBase: React.CSSProperties = {
  paddingInline: "0.5rem",
  paddingBlock: "0.125rem",
  fontSize: "var(--text-label)",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const PENDING_PILL = { backgroundColor: "#fef9c3", color: "#854d0e" };
const APPROVED_PILL = { backgroundColor: "#dcfce7", color: "#166534" };
const REJECTED_PILL = { backgroundColor: "#fee2e2", color: "#991b1b" };
const NEUTRAL_PILL = { backgroundColor: "#f3f4f6", color: "#374151" };

const VERIFICATION_PILLS: Record<
  AdminCustomerListItemProjection["verificationDisplay"],
  { label: string; backgroundColor: string; color: string }
> = {
  NOT_REQUIRED: { label: "Not required", ...NEUTRAL_PILL },
  PENDING: { label: "Pending", ...PENDING_PILL },
  APPROVED: { label: "Approved", ...APPROVED_PILL },
  REJECTED: { label: "Rejected", ...REJECTED_PILL },
  EXPIRED: { label: "Expired", ...NEUTRAL_PILL },
};

const B2B_PILLS: Record<
  NonNullable<AdminCustomerListItemProjection["b2bStatus"]>,
  { label: string; backgroundColor: string; color: string }
> = {
  PENDING: { label: "Pending", ...PENDING_PILL },
  APPROVED: { label: "Approved", ...APPROVED_PILL },
  EXPIRED: { label: "Expired", ...NEUTRAL_PILL },
  REJECTED: { label: "Rejected", ...REJECTED_PILL },
  SUSPENDED: { label: "Suspended", ...NEUTRAL_PILL },
};

export default function CustomersTable({ rows, hasFilters }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/customers/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage={
        hasFilters ? "No customers match these filters." : "No customers yet."
      }
      columns={[
        {
          key: "customer",
          header: "Customer",
          render: (row) => (
            <div>
              <p style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}>
                {row.name}
              </p>
              <p
                dir="ltr"
                style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
              >
                {row.email}
              </p>
            </div>
          ),
        },
        {
          key: "role",
          header: "Type",
          render: (row) => (
            <span
              style={{
                backgroundColor: row.role === "B2B" ? "#dbeafe" : "#f3f4f6",
                color: row.role === "B2B" ? "#1e40af" : "#374151",
                paddingInline: "0.5rem",
                paddingBlock: "0.125rem",
                fontSize: "var(--text-label)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {row.role}
            </span>
          ),
        },
        {
          key: "status",
          header: "Account",
          render: (row) => (
            <span
              style={{
                backgroundColor: row.isActive ? "#dcfce7" : "#fee2e2",
                color: row.isActive ? "#166534" : "#991b1b",
                paddingInline: "0.5rem",
                paddingBlock: "0.125rem",
                fontSize: "var(--text-label)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {row.isActive ? "Active" : "Suspended"}
            </span>
          ),
        },
        {
          key: "verification",
          header: "ID verification",
          render: (row) => {
            const pill = VERIFICATION_PILLS[row.verificationDisplay];
            return (
              <span
                style={{
                  ...pillBase,
                  backgroundColor: pill.backgroundColor,
                  color: pill.color,
                }}
              >
                {pill.label}
              </span>
            );
          },
        },
        {
          key: "business",
          header: "Business",
          render: (row) => {
            if (!row.b2bStatus) {
              return <span style={{ color: "#6b6b6b" }}>—</span>;
            }
            const pill = B2B_PILLS[row.b2bStatus];
            return (
              <span
                style={{
                  ...pillBase,
                  backgroundColor: pill.backgroundColor,
                  color: pill.color,
                }}
              >
                {pill.label}
              </span>
            );
          },
        },
        {
          key: "orders",
          header: "Orders",
          align: "end",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>{row.ordersCount}</span>
          ),
        },
        {
          key: "spend",
          header: "Lifetime Spend",
          align: "end",
          render: (row) => (
            <span style={{ color: "#0b0b0b" }}>
              {formatAED(row.lifetimeSpendAed, "en")}
            </span>
          ),
        },
        {
          key: "points",
          header: "Points",
          align: "end",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {row.loyaltyPoints.toLocaleString("en-US")}
            </span>
          ),
        },
        {
          key: "joined",
          header: "Joined",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
      ]}
    />
  );
}
