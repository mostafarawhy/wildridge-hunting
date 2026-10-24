import { requireStaff } from "@/lib/auth-staff";
import { getAdminStaff } from "@/lib/db/queries/staff";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import type { StaffRole } from "@/app/generated/prisma/client";
import StaffManager from "@/components/admin/StaffManager";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";

const VALID_ROLES = Object.keys(STAFF_ROLE_LABELS) as StaffRole[];
const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;
type StaffStatusFilter = (typeof VALID_STATUSES)[number];

interface Props {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
  }>;
}

export default async function AdminStaffPage({ searchParams }: Props) {
  const acting = await requireStaff("staff:manage");

  const { q, role: roleParam, status: statusParam } = await searchParams;

  const role =
    roleParam && VALID_ROLES.includes(roleParam as StaffRole)
      ? (roleParam as StaffRole)
      : undefined;

  const activeRole: "ALL" | StaffRole = role ?? "ALL";

  const status =
    statusParam && VALID_STATUSES.includes(statusParam as StaffStatusFilter)
      ? (statusParam as StaffStatusFilter)
      : undefined;

  const activeStatus: "ALL" | StaffStatusFilter = status ?? "ALL";

  const search = q?.trim() || undefined;

  const rows = await getAdminStaff({ search, role, status });

  return (
    <>
      <DemoViewOnlyNote permission="staff:manage" />
      <StaffManager
        rows={rows}
        actingId={acting.id}
        actingRole={acting.staffRole}
        activeRole={activeRole}
        activeStatus={activeStatus}
        query={search ?? ""}
      />
    </>
  );
}
