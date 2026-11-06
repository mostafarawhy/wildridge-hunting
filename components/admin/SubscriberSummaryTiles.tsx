import StatsCard from "@/components/admin/StatsCard";
import { isDemoMode } from "@/lib/config/demo";

interface Props {
  subscribed: number;
  unsubscribed: number;
  waiting: number;
  failed: number;
  klaviyoConfigured: boolean;
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

export default function SubscriberSummaryTiles({
  subscribed,
  unsubscribed,
  waiting,
  failed,
  klaviyoConfigured,
}: Props) {
  const chips: { key: string; label: string; value: number }[] = [
    { key: "subscribed", label: "Subscribed", value: subscribed },
    { key: "unsubscribed", label: "Unsubscribed", value: unsubscribed },
    { key: "waiting", label: "Waiting for Klaviyo", value: waiting },
    { key: "failed", label: "Failed", value: failed },
  ];

  return (
    <>
    <nav
      aria-label="Subscriber views"
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
            {chip.value.toLocaleString("en-US")}
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
        label="Subscribed"
        value={subscribed}
        hint="On the list now"
      />
      <StatsCard
        label="Unsubscribed"
        value={unsubscribed}
        hint="Kept as a consent record"
      />
      <StatsCard
        label="Waiting for Klaviyo"
        value={waiting}
        hint={
          klaviyoConfigured
            ? "Not sent to Klaviyo yet"
            : isDemoMode()
              ? "Klaviyo sync is off in this demo"
              : "Klaviyo isn't connected"
        }
      />
      <StatsCard
        label="Failed"
        value={failed}
        hint="Klaviyo refused them; hover the Klaviyo cell for the reason"
      />
    </div>
    </>
  );
}
