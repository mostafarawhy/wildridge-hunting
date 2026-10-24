import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminB2BAccounts,
  type AdminB2BFilters,
} from "@/lib/db/queries/b2b";
import { AdminPageHeader } from "@/components/admin";
import B2BApplicationsTable from "@/components/admin/B2BApplicationsTable";
import B2BFilterBar from "@/components/admin/B2BFilterBar";
import B2BSummaryTiles from "@/components/admin/B2BSummaryTiles";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_STATUSES = [
  "PENDING",
  "APPROVED",
  "EXPIRED",
  "SUSPENDED",
  "REJECTED",
] as const;
const VALID_REVIEWS = ["DECISION", "WAITING", "RESPONDED"] as const;
const VALID_RENEWALS = ["D30", "D90"] as const;
const VALID_QUOTES = ["HAS", "NONE"] as const;
const VALID_SORTS = ["newest", "oldest", "expiry", "company"] as const;
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
    review?: string;
    renewal?: string;
    quotes?: string;
    sort?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminB2BPage({ searchParams }: Props) {
  await requireStaff("b2b:read");

  const {
    q,
    status: statusParam,
    review: reviewParam,
    renewal: renewalParam,
    quotes: quotesParam,
    sort: sortParam,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  const status = pick(VALID_STATUSES, statusParam);
  const search = q?.trim() || undefined;

  const filters: AdminB2BFilters = {
    search,
    status,
    review: pick(VALID_REVIEWS, reviewParam),
    renewal: pick(VALID_RENEWALS, renewalParam),
    quotes: pick(VALID_QUOTES, quotesParam),
    sort: pick(VALID_SORTS, sortParam),
    from: from?.trim() || undefined,
    to: to?.trim() || undefined,
  };

  const pageNumber = Number(pageParam);
  const page =
    Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  const result = await getAdminB2BAccounts({
    ...filters,
    page,
    pageSize: PAGE_SIZE,
  });

  const hasFilters =
    filters.search !== undefined ||
    filters.status !== undefined ||
    filters.review !== undefined ||
    filters.renewal !== undefined ||
    filters.quotes !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  return (
    <>
      <AdminPageHeader
        title="Business accounts"
        subtitle={`Applications, renewals and account reviews · ${result.summary.total} accounts`}
      />
      <B2BSummaryTiles {...result.summary} />
      <B2BFilterBar filters={filters} />
      <B2BApplicationsTable rows={result.rows} filtered={hasFilters} />
      <AdminPaginationBar totalPages={result.totalPages} />
    </>
  );
}
