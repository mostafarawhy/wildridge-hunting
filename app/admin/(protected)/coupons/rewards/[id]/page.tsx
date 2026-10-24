import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminRewardRuleDetail,
  getRuleIssuedCoupons,
} from "@/lib/db/queries/coupon";
import RewardRuleForm from "@/components/admin/RewardRuleForm";
import RewardRuleCodesList from "@/components/admin/RewardRuleCodesList";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminRewardRulePage({ params }: Props) {
  const { id } = await params;
  await requireStaff("coupon:manage");

  const [initial, issued] = await Promise.all([
    getAdminRewardRuleDetail(id),
    getRuleIssuedCoupons(id, new Date()),
  ]);
  if (!initial) notFound();

  return (
    <RewardRuleForm
      mode="edit"
      initial={initial}
      slots={{
        codes: <RewardRuleCodesList rows={issued.rows} total={issued.total} />,
      }}
    />
  );
}
