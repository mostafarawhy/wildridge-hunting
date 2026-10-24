import { requireStaff } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import { getLoyaltyOverview } from "@/lib/db/queries/loyalty";
import { AdminPageHeader } from "@/components/admin";
import StatsCard from "@/components/admin/StatsCard";
import LoyaltyTabs from "@/components/admin/LoyaltyTabs";
import LoyaltyProgramForm from "@/components/admin/LoyaltyProgramForm";
import { formatAED } from "@/lib/utils/currency";
import { pointsToAed, redeemRuleOf } from "@/lib/utils/loyalty-points";

function signed(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(n).toLocaleString("en-US");
  return n > 0 ? `+${abs}` : `−${abs}`;
}

export default async function AdminLoyaltyPage() {
  await requireStaff("loyalty:manage");

  const [program, overview, tax] = await Promise.all([
    getSetting("loyalty_program"),
    getLoyaltyOverview(),
    getSetting("tax_config"),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Loyalty program"
        subtitle="How customers earn and spend points, and every point movement."
      />
      <LoyaltyTabs active="program" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatsCard
          label="Points outstanding"
          value={overview.pointsOutstanding.toLocaleString("en-US")}
          hint={`Worth ${formatAED(pointsToAed(overview.pointsOutstanding, redeemRuleOf(program)), "en")} at today's spending rate`}
        />
        <StatsCard
          label="Customers with points"
          value={overview.customersWithPoints.toLocaleString("en-US")}
          hint="Balance above zero"
        />
        <StatsCard
          label="Earned, last 30 days"
          value={overview.earnedLast30Days.toLocaleString("en-US")}
          hint="From delivered orders"
        />
        <StatsCard
          label="Adjusted, last 30 days"
          value={signed(overview.adjustedLast30Days)}
          hint="Net of staff additions and removals"
        />
        <StatsCard
          label="Spent, last 30 days"
          value={overview.spentLast30Days.toLocaleString("en-US")}
          hint={
            overview.returnedLast30Days > 0
              ? `Net of ${overview.returnedLast30Days.toLocaleString("en-US")} returned after failed payments`
              : "Spent at checkout, net of returns"
          }
        />
      </div>
      <LoyaltyProgramForm
        initial={{
          enabled: program.enabled,
          earnRate: program.earnRate,
          redeemPointsPerAed: program.redeemPointsPerAed,
          redeemMinPoints: program.redeemMinPoints,
          redeemMaxSharePercent: program.redeemMaxSharePercent,
        }}
        vatRate={tax.vatRate}
      />
    </>
  );
}
