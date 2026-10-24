import { requireStaff } from "@/lib/auth-staff";
import { getAdminCouponDetail } from "@/lib/db/queries/coupon";
import CouponForm from "@/components/admin/CouponForm";

interface Props {
  searchParams: Promise<{ from?: string }>;
}

export default async function AdminNewCouponPage({ searchParams }: Props) {
  await requireStaff("coupon:manage");

  const { from } = await searchParams;
  const source = from ? await getAdminCouponDetail(from, new Date()) : null;
  const template = source && source.customer == null ? source : undefined;

  return <CouponForm mode="create" template={template} />;
}
