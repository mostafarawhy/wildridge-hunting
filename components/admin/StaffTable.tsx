"use client";

import DataTable from "@/components/admin/DataTable";
import StaffManageActions from "@/components/admin/StaffManageActions";
import { formatDisplayDate } from "@/lib/utils/date";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import type { StaffRole } from "@/app/generated/prisma/client";
import type { AdminStaffListItemProjection } from "@/lib/db/queries/staff";

interface Props {
  rows: AdminStaffListItemProjection[];
  actingId: string;
  actingRole: StaffRole;
}

export default function StaffTable({ rows, actingId, actingRole }: Props) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="No staff members found."
      columns={[
        {
          key: "staff",
          header: "Staff",
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
          header: "Role",
          render: (row) => (
            <span
              style={{
                backgroundColor:
                  row.role === "SUPER_ADMIN" || row.role === "STAFF_ADMIN"
                    ? "#dbeafe"
                    : "#f3f4f6",
                color:
                  row.role === "SUPER_ADMIN" || row.role === "STAFF_ADMIN"
                    ? "#1e40af"
                    : "#374151",
                paddingInline: "0.5rem",
                paddingBlock: "0.125rem",
                fontSize: "var(--text-label)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {STAFF_ROLE_LABELS[row.role]}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
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
              {row.isActive ? "Active" : "Deactivated"}
            </span>
          ),
        },
        {
          key: "lastLogin",
          header: "Last Login",
          render: (row) =>
            row.lastLoginAt ? (
              <span dir="ltr" style={{ color: "#6b6b6b" }}>
                {formatDisplayDate(row.lastLoginAt, "en")}
              </span>
            ) : (
              <span style={{ color: "#6b6b6b" }}>Never</span>
            ),
        },
        {
          key: "added",
          header: "Added",
          render: (row) => (
            <span dir="ltr" style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "actions",
          header: "Actions",
          align: "end",
          render: (row) => (
            <StaffManageActions
              staffId={row.id}
              staffName={row.name}
              currentRole={row.role}
              isActive={row.isActive}
              actingId={actingId}
              actingRole={actingRole}
            />
          ),
        },
      ]}
    />
  );
}
