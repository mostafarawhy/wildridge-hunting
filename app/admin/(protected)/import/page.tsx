import { requireStaff } from "@/lib/auth-staff";
import {
  getImportHistory,
  getImportStaffOptions,
} from "@/lib/db/queries/import-history";
/* Template download temporarily disabled on purpose (2026-10-09). */
/* import {
  CATALOG_TEMPLATE_DOWNLOAD_NAME,
  CATALOG_TEMPLATE_PATH,
} from "@/lib/utils/catalog-import"; */
import {
  AdminPageHeader,
  CatalogImportGuide,
  CatalogImportPanel,
} from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";
import ImportHistoryFilterBar from "@/components/admin/ImportHistoryFilterBar";
import ImportHistoryTable from "@/components/admin/ImportHistoryTable";

export const maxDuration = 60;

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{
    staff?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminImportPage({ searchParams }: Props) {
  await requireStaff("catalog:import");

  const {
    staff,
    status: statusParam,
    from,
    to,
    page: pageParam,
  } = await searchParams;

  const status =
    statusParam === "COMPLETED" || statusParam === "FAILED" ? statusParam : undefined;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);

  const [{ items: history, total }, staffOptions] = await Promise.all([
    getImportHistory({
      page,
      pageSize: PAGE_SIZE,
      staffId: staff || undefined,
      status,
      from: from || undefined,
      to: to || undefined,
    }),
    getImportStaffOptions(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const anyFilter = Boolean(staff || status || from || to);

  return (
    <>
      <AdminPageHeader
        title="Catalog import"
        subtitle="Create and update products, specs, images and accessories from the import template."
        /* Template download temporarily disabled on purpose (2026-10-09). */
        /* actions={
          <a
            href={CATALOG_TEMPLATE_PATH}
            download={CATALOG_TEMPLATE_DOWNLOAD_NAME}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              height: "2.5rem",
              paddingInline: "1.25rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
              border: "none",
              borderRadius: "0",
              textDecoration: "none",
            }}
          >
            Download the import template
          </a>
        } */
      />
      <DemoViewOnlyNote permission="catalog:import" />
      <CatalogImportGuide />
      <CatalogImportPanel />
      <p
        style={{
          marginTop: "2.5rem",
          marginBottom: "0.75rem",
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "var(--color-action-primary)",
        }}
      >
        Import history
      </p>
      <ImportHistoryFilterBar
        staff={staff || "ALL"}
        status={status ?? "ALL"}
        from={from ?? ""}
        to={to ?? ""}
        staffOptions={staffOptions}
      />
      <ImportHistoryTable
        rows={history}
        emptyMessage={anyFilter ? "No imports match these filters." : "No imports yet."}
      />
      <AdminPaginationBar totalPages={totalPages} />
    </>
  );
}
