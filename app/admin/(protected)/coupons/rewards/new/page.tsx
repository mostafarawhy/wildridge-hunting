import { requireStaff } from "@/lib/auth-staff";
import RewardRuleForm from "@/components/admin/RewardRuleForm";

export default async function AdminNewRewardRulePage() {
  await requireStaff("coupon:manage");
  return <RewardRuleForm mode="create" />;
}
