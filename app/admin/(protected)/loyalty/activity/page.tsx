import { requireStaff } from "@/lib/auth-staff";
import { getAdminLoyaltyActivity } from "@/lib/db/queries/loyalty";
import { LoyaltyActivityFiltersSchema } from "@/lib/validations/loyalty";
import { AdminPageHeader } from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import LoyaltyTabs from "@/components/admin/LoyaltyTabs";
import LoyaltyActivityFilterBar from "@/components/admin/LoyaltyActivityFilterBar";
import LoyaltyActivityTable from "@/components/admin/LoyaltyActivityTable";
import LoyaltyExportButton from "@/components/admin/LoyaltyExportButton";

interface Props {
  searchParams: Promise<{
    q?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminLoyaltyActivityPage({ searchParams }: Props) {
  await requireStaff("loyalty:manage");

  const { q, type, from, to, page: pageParam } = await searchParams;

  const filters = LoyaltyActivityFiltersSchema.parse({
    search: q,
    type,
    from,
    to,
  });
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const { rows, total, pageSize } = await getAdminLoyaltyActivity(filters, page);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <AdminPageHeader
        title="Loyalty program"
        subtitle="How customers earn points, and every point movement."
        actions={<LoyaltyExportButton filters={filters} />}
      />
      <LoyaltyTabs active="activity" />
      <LoyaltyActivityFilterBar filters={filters} />
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "#6b6b6b",
          marginBottom: "0.75rem",
        }}
      >
        {`${total.toLocaleString("en-US")} ${total === 1 ? "entry" : "entries"}`}
      </p>
      <LoyaltyActivityTable rows={rows} />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
