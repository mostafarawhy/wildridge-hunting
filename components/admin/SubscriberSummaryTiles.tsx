import StatsCard from "@/components/admin/StatsCard";

interface Props {
  subscribed: number;
  unsubscribed: number;
  waiting: number;
  failed: number;
  klaviyoConfigured: boolean;
}

export default function SubscriberSummaryTiles({
  subscribed,
  unsubscribed,
  waiting,
  failed,
  klaviyoConfigured,
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
            : "Klaviyo isn't connected"
        }
      />
      <StatsCard
        label="Failed"
        value={failed}
        hint="Klaviyo refused them; hover the Klaviyo cell for the reason"
      />
    </div>
  );
}
