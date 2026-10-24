import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminCouponDetail,
  getCouponRedemptions,
} from "@/lib/db/queries/coupon";
import { getAuditLogList } from "@/lib/db/queries/audit-log";
import { addCouponNoteAction } from "@/lib/actions/staff-notes";
import CouponForm from "@/components/admin/CouponForm";
import CouponRedemptionsList from "@/components/admin/CouponRedemptionsList";
import EntityEventThread from "@/components/admin/EntityEventThread";
import InternalNotesPanel from "@/components/admin/InternalNotesPanel";

interface Props {
  params: Promise<{ id: string }>;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

export default async function AdminCouponPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("coupon:manage");

  const [detail, redemptions, events] = await Promise.all([
    getAdminCouponDetail(id, new Date()),
    getCouponRedemptions(id),
    getAuditLogList({ entityType: "Coupon", entityId: id, pageSize: 100 }),
  ]);
  if (!detail) notFound();

  return (
    <CouponForm
      mode="edit"
      initial={detail}
      slots={{
        redemptions: (
          <CouponRedemptionsList
            redemptionCount={detail.redemptionCount}
            discountGiven={detail.discountGiven}
            rows={redemptions}
          />
        ),
        activity: (
          <>
            <InternalNotesPanel action={addCouponNoteAction} entityId={id} />
            <div style={cardStyle}>
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>
                  History{" "}
                  <span style={{ color: "var(--color-content-tertiary)" }}>
                    · {events.total}
                  </span>
                </p>
                {events.items.length < events.total && (
                  <p
                    style={{
                      marginTop: "0.25rem",
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                    }}
                  >
                    Showing the latest {events.items.length} of {events.total}.
                  </p>
                )}
              </div>
              <EntityEventThread items={events.items} />
            </div>
          </>
        ),
      }}
    />
  );
}
