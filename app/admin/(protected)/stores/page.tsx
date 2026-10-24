import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminStoreList } from "@/lib/db/queries/stores";
import { DataTable } from "@/components/admin";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import type { AdminStoreListItem } from "@/lib/db/queries/stores";

const ctaBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  textDecoration: "none",
};

const columns = [
  {
    key: "name",
    header: "Name",
    render: (s: AdminStoreListItem) => (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
      >
        {s.nameEn}
        {s.isPrimary && (
          <span
            style={{
              display: "inline-block",
              padding: "0.125rem 0.5rem",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              borderRadius: 0,
              color: "#166534",
              backgroundColor: "#dcfce7",
            }}
          >
            Main
          </span>
        )}
      </span>
    ),
  },
  {
    key: "address",
    header: "Address",
    render: (s: AdminStoreListItem) => s.addressEn,
  },
  {
    key: "order",
    header: "Order",
    align: "end" as const,
    render: (s: AdminStoreListItem) => s.displayOrder,
  },
  {
    key: "status",
    header: "Status",
    render: (s: AdminStoreListItem) => (
      <span
        style={{
          display: "inline-block",
          padding: "0.125rem 0.5rem",
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          borderRadius: 0,
          color: s.isActive ? "#166534" : "#6b6b6b",
          backgroundColor: s.isActive ? "#dcfce7" : "#f3f4f6",
        }}
      >
        {s.isActive ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    key: "manage",
    header: "Manage",
    align: "end" as const,
    render: (s: AdminStoreListItem) => (
      <Link
        href={`/admin/stores/${s.id}`}
        style={{
          fontSize: "var(--text-body)",
          color: "#0b0b0b",
          textDecoration: "none",
        }}
      >
        Manage
      </Link>
    ),
  },
];

export default async function AdminStoresPage() {
  await requireStaff("content:manage");
  const stores = await getAdminStoreList();

  return (
    <ContentPageFrame
      backHref="/admin/pages"
      backLabel="Back to Store Pages"
      title="Store Locations"
      purpose="Your showrooms. The main one appears on Contact and About; every shown one appears on Our Stores. The address in Store Profile is separate: it is the registered business address."
      sketch="showroom"
    >
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div />
          <Link href="/admin/stores/new" style={ctaBtn}>
            + New Store
          </Link>
        </div>
        <DataTable
          columns={columns}
          rows={stores}
          getRowKey={(s) => s.id}
          emptyMessage="No stores yet."
        />
      </section>
    </ContentPageFrame>
  );
}
