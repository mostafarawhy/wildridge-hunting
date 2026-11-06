import StatsCard from "@/components/admin/StatsCard";
import { formatAED } from "@/lib/utils/currency";

interface Props {
  activeCount: number;
  redemptionCount: number;
  discountGiven: number;
  rewardCodesIssued: number;
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  flexShrink: 0,
  height: "36px",
  paddingInline: "0.875rem",
  whiteSpace: "nowrap",
  scrollSnapAlign: "start",
  textDecoration: "none",
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const chipValueStyle: React.CSSProperties = {
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
};

export default function CouponSummaryTiles({
  activeCount,
  redemptionCount,
  discountGiven,
  rewardCodesIssued,
}: Props) {
  const chips: { key: string; label: string; value: string | number }[] = [
    { key: "active", label: "Active codes", value: activeCount },
    { key: "redemptions", label: "Redemptions · 30 days", value: redemptionCount },
    { key: "discount", label: "Discount given · 30 days", value: formatAED(discountGiven) },
    { key: "rewards", label: "Reward codes issued · 30 days", value: rewardCodesIssued },
  ];

  return (
    <>
    <nav
      aria-label="Coupon views"
      className="flex lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        gap: "0.5rem",
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        scrollSnapType: "x proximity",
        marginBottom: "1rem",
      }}
    >
      {chips.map((chip) => (
        <span key={chip.key} style={chipStyle}>
          {chip.label}
          <span style={chipValueStyle}>
            {typeof chip.value === "number"
              ? chip.value.toLocaleString("en-US")
              : chip.value}
          </span>
        </span>
      ))}
    </nav>
    <div
      className="hidden lg:grid"
      style={{
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
    </>
  );
}
