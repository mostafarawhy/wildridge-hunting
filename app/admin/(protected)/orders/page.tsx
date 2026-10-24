import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminOrders,
  type AdminOrderFilters,
  type OrderStatus,
} from "@/lib/db/queries/order";
import { getSetting } from "@/lib/db/queries/settings";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { can } from "@/lib/utils/staff-permissions";
import { AdminPageHeader } from "@/components/admin";
import OrderExportButton from "@/components/admin/OrderExportButton";
import OrdersTable from "@/components/admin/OrdersTable";
import OrderFilterBar from "@/components/admin/OrderFilterBar";
import OrderSummaryTiles from "@/components/admin/OrderSummaryTiles";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
const VALID_VIEWS = [
  "FULFIL",
  "QUOTE",
  "AWAITING",
  "SHIPPED",
  "DELIVERED",
  "CLOSED",
] as const;
const VALID_PAYMENTS = ["ONLINE", "OFFLINE"] as const;
const VALID_SOURCES = ["CHECKOUT", "QUOTE"] as const;
const VALID_REFUNDS = ["OWED", "PARTIAL", "REFUNDED", "NONE"] as const;
const VALID_SORTS = ["newest", "oldest", "total_desc", "total_asc"] as const;
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
    status?: string;
    view?: string;
    payment?: string;
    source?: string;
    refund?: string;
    sort?: string;
    from?: string;
    to?: string;
    stale?: string;
    page?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { staffRole } = await requireStaff("order:read");

  const {
    q,
    status: statusParam,
    view: viewParam,
    payment: paymentParam,
    source: sourceParam,
    refund: refundParam,
    sort: sortParam,
    from,
    to,
    stale,
    page: pageParam,
  } = await searchParams;

  const filters: AdminOrderFilters = {
    search: q?.trim() || undefined,
    status: pick(VALID_STATUSES, statusParam),
    view: pick(VALID_VIEWS, viewParam),
    payment: pick(VALID_PAYMENTS, paymentParam),
    source: pick(VALID_SOURCES, sourceParam),
    refund: pick(VALID_REFUNDS, refundParam),
    sort: pick(VALID_SORTS, sortParam),
    stale: stale === "1" ? true : undefined,
    from: from?.trim() || undefined,
    to: to?.trim() || undefined,
  };

  const pageNumber = Number(pageParam);
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  const { staleShippedDays } = await getSetting("delivery_config");

  const result = await getAdminOrders({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters =
    filters.search !== undefined ||
    filters.status !== undefined ||
    filters.view !== undefined ||
    filters.payment !== undefined ||
    filters.source !== undefined ||
    filters.refund !== undefined ||
    filters.stale !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  return (
    <>
      <AdminPageHeader
        title="Orders"
        subtitle={`Manage customer orders · ${result.summary.all} orders`}
        actions={
          <OrderExportButton
            canExport={
              can(staffRole, "order:update") || can(staffRole, "order:mark_paid")
            }
            count={result.total}
            filters={filters}
          />
        }
      />
      <OrderSummaryTiles {...result.summary} />
      <OrderFilterBar filters={filters} />
      <OrdersTable
        rows={result.rows}
        staleShippedDays={staleShippedDays}
        filtered={hasFilters}
        canManage={can(staffRole, "order:update")}
        canMarkPaid={can(staffRole, "order:mark_paid")}
        canViewCustomer={can(staffRole, "customer:read")}
        canCreateTicket={can(staffRole, "ticket:manage")}
      />
      <AdminPaginationBar totalPages={result.totalPages} />
    </>
  );
}
