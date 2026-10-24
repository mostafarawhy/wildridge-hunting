import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminShippingZoneForEdit, getAssignedCountryCodes, getZoneRates, getAssignableMethodsForZone } from "@/lib/db/queries/shipping";
import { AdminPageHeader, ShippingZoneCountriesManager, ShippingZoneRatesManager } from "@/components/admin";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";
import ShippingZoneForm from "@/components/admin/ShippingZoneForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditShippingZonePage({ params }: Props) {
  const { id } = await params;
  await requireStaff("shipping:manage");

  const [zone, assignedCodes, rates, assignableMethods] = await Promise.all([
    getAdminShippingZoneForEdit(id),
    getAssignedCountryCodes(),
    getZoneRates(id),
    getAssignableMethodsForZone(id),
  ]);
  if (!zone) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/shipping"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            textDecoration: "none",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Shipping Zones
        </Link>
        <AdminPageHeader
          title={zone.nameEn}
          subtitle={`Code: ${zone.code}`}
        />
        <DemoViewOnlyNote permission="shipping:manage" />
      </div>
      <ShippingZoneForm mode="edit" initial={zone} />
      <ShippingZoneRatesManager
        zoneId={zone.id}
        rates={rates}
        assignableMethods={assignableMethods}
      />
      <ShippingZoneCountriesManager
        zoneId={zone.id}
        memberCodes={zone.countryCodes}
        assignedCodes={assignedCodes}
      />
    </div>
  );
}
