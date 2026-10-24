import { requireStaff } from "@/lib/auth-staff";
import { getVerificationEvents } from "@/lib/db/queries/verification";
import { AdminPageHeader } from "@/components/admin";
import VerificationFilterBar from "@/components/admin/VerificationFilterBar";
import { isUaePassEnabled } from "@/lib/env.client";
import VerificationEventsTable from "@/components/admin/VerificationEventsTable";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "NOT_REQUIRED",
] as const;
type VerificationStatus = (typeof VALID_STATUSES)[number];

const VALID_PROVIDERS = ["MANUAL_REVIEW", "UAE_PASS"] as const;
type VerificationProvider = (typeof VALID_PROVIDERS)[number];

interface Props {
  searchParams: Promise<{
    status?: string;
    provider?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminVerificationPage({ searchParams }: Props) {
  await requireStaff("verification:review");

  const {
    status: statusParam,
    provider: providerParam,
    q,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  const status: VerificationStatus | undefined =
    statusParam === undefined
      ? "PENDING"
      : statusParam === "ALL"
        ? undefined
        : VALID_STATUSES.includes(statusParam as VerificationStatus)
          ? (statusParam as VerificationStatus)
          : "PENDING";

  const provider =
    providerParam &&
    VALID_PROVIDERS.includes(providerParam as VerificationProvider) &&
    (providerParam !== "UAE_PASS" || isUaePassEnabled())
      ? (providerParam as VerificationProvider)
      : undefined;

  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const { items, total, pageSize } = await getVerificationEvents({
    status,
    provider,
    search: q,
    from,
    to,
    page,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <AdminPageHeader
        title="Verification Review"
        subtitle="Review pending identity verification submissions"
      />
      <VerificationFilterBar
        status={status ?? "ALL"}
        provider={provider ?? "ALL"}
        search={q ?? ""}
        from={from ?? ""}
        to={to ?? ""}
      />
      <VerificationEventsTable rows={items} />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
