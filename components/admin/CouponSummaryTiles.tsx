import StatsCard from "@/components/admin/StatsCard";
import { formatAED } from "@/lib/utils/currency";

interface Props {
  activeCount: number;
  redemptionCount: number;
  discountGiven: number;
  rewardCodesIssued: number;
}

export default function CouponSummaryTiles({
  activeCount,
  redemptionCount,
  discountGiven,
  rewardCodesIssued,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <StatsCard
        label="Active codes"
        value={activeCount}
        hint="Live right now"
      />
      <StatsCard
        label="Redemptions · 30 days"
        value={redemptionCount}
        hint="Paid orders, last 30 days"
      />
      <StatsCard
        label="Discount given · 30 days"
        value={formatAED(discountGiven)}
        hint="Paid orders, last 30 days. Includes shipping waived by free-shipping codes."
      />
      <StatsCard
        label="Reward codes issued · 30 days"
        value={rewardCodesIssued}
        hint="Issued by reward rules"
      />
    </div>
  );
}
