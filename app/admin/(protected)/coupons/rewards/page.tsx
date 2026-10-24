import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminRewardRuleList,
  getAdminRewardRuleStats,
} from "@/lib/db/queries/coupon";
import { AdminPageHeader, RewardRulesManager } from "@/components/admin";

export default async function AdminRewardRulesPage() {
  await requireStaff("coupon:manage");
  const [rules, stats] = await Promise.all([
    getAdminRewardRuleList(),
    getAdminRewardRuleStats(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Reward Rules"
        subtitle="Automatic coupons issued when a delivered order reaches a spend threshold"
        actions={
          <Link
            href="/admin/coupons/rewards/new"
            style={{
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
              textDecoration: "none",
              borderRadius: "0",
            }}
          >
            + New rule
          </Link>
        }
      />
      <RewardRulesManager rules={rules} stats={stats} />
    </>
  );
}
