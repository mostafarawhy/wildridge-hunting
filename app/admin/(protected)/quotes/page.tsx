import { requireStaff } from "@/lib/auth-staff";
import {
  ADMIN_QUOTE_VIEWS,
  getAdminQuotes,
  type AdminQuoteFilters,
  type AdminQuoteView,
} from "@/lib/db/queries/quote";
import type { QuoteStatus } from "@/lib/db/queries/quote";
import { QUOTE_STATUS_LABELS } from "@/lib/utils/quote-status";
import { can } from "@/lib/utils/staff-permissions";
import { AdminPageHeader } from "@/components/admin";
import QuoteRequestsTable from "@/components/admin/QuoteRequestsTable";
import QuoteFilterBar from "@/components/admin/QuoteFilterBar";
import QuoteExportButton from "@/components/admin/QuoteExportButton";
import QuoteSummaryTiles from "@/components/admin/QuoteSummaryTiles";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_STATUSES = Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[];
const VALID_PRICED = ["YES", "NO"] as const;
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
    priced?: string;
    sort?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminQuotesPage({ searchParams }: Props) {
  const { staffRole } = await requireStaff("quote:read");

  const {
    q,
    status: statusParam,
    view: viewParam,
    priced: pricedParam,
    sort: sortParam,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  let view: AdminQuoteView | undefined = pick<AdminQuoteView>(
    ADMIN_QUOTE_VIEWS,
    viewParam,
  );
  if (statusParam === "CONVERTED") view = "CONVERTED";

  const filters: AdminQuoteFilters = {
    search: q?.trim() || undefined,
    status: pick(VALID_STATUSES, statusParam),
    view,
    priced: pick(VALID_PRICED, pricedParam),
    sort: pick(VALID_SORTS, sortParam),
    from: from?.trim() || undefined,
    to: to?.trim() || undefined,
  };

  const pageNumber = Number(pageParam);
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  const result = await getAdminQuotes({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters =
    filters.search !== undefined ||
    filters.status !== undefined ||
    filters.view !== undefined ||
    filters.priced !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  const canExport = can(staffRole, "quote:manage");

  return (
    <>
      <AdminPageHeader
        title="Quote Requests"
        subtitle={`Manage B2B quote requests · ${result.summary.all} quotes`}
        actions={
          <QuoteExportButton
            canExport={canExport}
            count={result.total}
            filters={filters}
          />
        }
      />
      <QuoteSummaryTiles {...result.summary} />
      <QuoteFilterBar filters={filters} />
      <QuoteRequestsTable
        rows={result.rows}
        filtered={hasFilters}
        canViewOrders={can(staffRole, "order:read")}
        canViewCustomer={can(staffRole, "customer:read")}
        canCreateTicket={can(staffRole, "ticket:manage")}
        canExport={canExport}
      />
      <AdminPaginationBar totalPages={result.totalPages} />
    </>
  );
}
