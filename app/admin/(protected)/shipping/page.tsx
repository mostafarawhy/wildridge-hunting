import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminShippingMethodList, getAdminShippingZoneList } from "@/lib/db/queries/shipping";
import { AdminPageHeader, DataTable, ShippingMethodsManager } from "@/components/admin";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";
import type { AdminShippingZoneListItem } from "@/lib/db/queries/shipping";

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
    key: "code",
    header: "Code",
    render: (z: AdminShippingZoneListItem) => (
      <span dir="ltr">{z.code}</span>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (z: AdminShippingZoneListItem) => z.nameEn,
  },
  {
    key: "countries",
    header: "Countries",
    align: "end" as const,
    render: (z: AdminShippingZoneListItem) => z.countryCount,
  },
  {
    key: "rates",
    header: "Rates",
    align: "end" as const,
    render: (z: AdminShippingZoneListItem) => z.rateCount,
  },
  {
    key: "status",
    header: "Status",
    render: (z: AdminShippingZoneListItem) => (
      <span
        style={{
          display: "inline-block",
          padding: "0.125rem 0.5rem",
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          borderRadius: 0,
          color: z.isActive ? "#166534" : "#6b6b6b",
          backgroundColor: z.isActive ? "#dcfce7" : "#f3f4f6",
        }}
      >
        {z.isActive ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    key: "manage",
    header: "Manage",
    align: "end" as const,
    render: (z: AdminShippingZoneListItem) => (
      <Link
        href={`/admin/shipping/${z.id}`}
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

export default async function AdminShippingPage() {
  await requireStaff("shipping:manage");
  const [methods, zones] = await Promise.all([
    getAdminShippingMethodList(),
    getAdminShippingZoneList(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Shipping"
        subtitle="Delivery methods and zones"
      />
      <DemoViewOnlyNote permission="shipping:manage" />
      <ShippingMethodsManager methods={methods} />
      <section style={{ marginTop: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-body-lg)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
              margin: 0,
            }}
          >
            Shipping Zones
          </h2>
          <Link href="/admin/shipping/new" style={ctaBtn}>
            + New Zone
          </Link>
        </div>
        <DataTable
          columns={columns}
          rows={zones}
          getRowKey={(z) => z.id}
          emptyMessage="No shipping zones yet."
        />
      </section>
    </>
  );
}
