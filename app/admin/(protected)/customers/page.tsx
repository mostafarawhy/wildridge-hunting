import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminCustomers,
  type AdminCustomerFilters,
} from "@/lib/db/queries/customer";
import { can } from "@/lib/utils/staff-permissions";
import type { CustomerRole } from "@/app/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin";
import CustomersTable from "@/components/admin/CustomersTable";
import CustomerFilterBar from "@/components/admin/CustomerFilterBar";
import CustomerSummaryTiles from "@/components/admin/CustomerSummaryTiles";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_ROLES: CustomerRole[] = ["B2C", "B2B"];
const VALID_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
type CustomerStatusFilter = (typeof VALID_STATUSES)[number];
const VALID_VERIFICATIONS = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;
const VALID_B2B = [
  "NONE",
  "PENDING",
  "APPROVED",
  "EXPIRED",
  "REJECTED",
  "SUSPENDED",
] as const;
const VALID_PRESENCE = ["HAS", "NONE"] as const;
const VALID_SORTS = ["newest", "oldest", "name"] as const;
const PAGE_SIZE = 25;

function pick<T extends string>(
  allowed: readonly T[],
  value: string | undefined,
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

interface Props {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    verification?: string;
    b2b?: string;
    orders?: string;
    points?: string;
    sort?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const { staffRole } = await requireStaff("customer:read");

  const {
    q,
    role: roleParam,
    status: statusParam,
    verification: verificationParam,
    b2b: b2bParam,
    orders: ordersParam,
    points: pointsParam,
    sort: sortParam,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  const role =
    roleParam && VALID_ROLES.includes(roleParam as CustomerRole)
      ? (roleParam as CustomerRole)
      : undefined;

  const status =
    statusParam && VALID_STATUSES.includes(statusParam as CustomerStatusFilter)
      ? (statusParam as CustomerStatusFilter)
      : undefined;

  const search = q?.trim() || undefined;

  const verification = pick(VALID_VERIFICATIONS, verificationParam);
  const b2b = pick(VALID_B2B, b2bParam);
  const orders = pick(VALID_PRESENCE, ordersParam);
  const points = pick(VALID_PRESENCE, pointsParam);
  const sort = pick(VALID_SORTS, sortParam);

  const pageNumber = Number(pageParam);
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  const filters: AdminCustomerFilters = {
    search,
    role,
    status,
    verification,
    b2b,
    orders,
    points,
    sort,
    from: from?.trim() || undefined,
    to: to?.trim() || undefined,
  };

  const result = await getAdminCustomers({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters =
    search !== undefined ||
    role !== undefined ||
    status !== undefined ||
    verification !== undefined ||
    b2b !== undefined ||
    orders !== undefined ||
    points !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  const first = (result.page - 1) * PAGE_SIZE + 1;
  const last = first + result.rows.length - 1;

  return (
    <>
      <AdminPageHeader
        title="Customers"
        subtitle="Manage customer accounts"
      />
      <CustomerSummaryTiles
        {...result.summary}
        canReviewVerification={can(staffRole, "verification:review")}
      />
      <CustomerFilterBar filters={filters} />
      <CustomersTable rows={result.rows} hasFilters={hasFilters} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {result.total > 0 ? (
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            Showing {first.toLocaleString("en-US")}–
            {last.toLocaleString("en-US")} of{" "}
            {result.total.toLocaleString("en-US")}
          </p>
        ) : (
          <span />
        )}
        <AdminPaginationBar totalPages={result.totalPages} />
      </div>
    </>
  );
}
