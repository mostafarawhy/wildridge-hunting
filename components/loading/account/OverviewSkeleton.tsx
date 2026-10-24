import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import { BADGE_HEIGHT } from "@/components/loading/account/parts";

const cardStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "var(--radius-none)",
  overflow: "hidden",
} as const;

function StatRowSkeleton({ ruled }: { ruled: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.875rem 1.25rem",
        borderBottom: ruled ? "1px solid var(--color-shop-divider)" : undefined,
      }}
    >
      <div
        style={{
          width: "2rem",
          height: "2rem",
          backgroundColor: "#f0f0f0",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Skeleton.Text width="35%" />
        <Skeleton.Text width="55%" className="mt-1" />
      </div>
      <Skeleton.Block height="1rem" width="1.5rem" className="flex-shrink-0" />
    </div>
  );
}

export default function OverviewSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderSkeleton subtitle={false} titleWidth="14rem" />

      <div style={cardStyle}>
        <div
          style={{
            height: "3px",
            backgroundColor: "var(--color-action-primary)",
          }}
        />
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <Skeleton.Text width="7rem" className="mb-3" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.75rem 0",
                borderBottom: "1px solid var(--color-shop-divider)",
              }}
            >
              <Skeleton.Text width="30%" />
              <Skeleton.Block height={BADGE_HEIGHT} width="5rem" className="flex-shrink-0" />
            </div>
          ))}
          <div style={{ paddingTop: "0.875rem" }}>
            <Skeleton.Text width="55%" />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <Skeleton.Text width="5rem" />
        </div>
        <StatRowSkeleton ruled />
        <StatRowSkeleton ruled />
        <StatRowSkeleton ruled={false} />
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <Skeleton.Text width="7rem" />
          <Skeleton.Text width="5rem" />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem 1.25rem",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton.Block height="1rem" width="30%" />
            <Skeleton.Text width="25%" className="mt-1.5" />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.375rem",
              flexShrink: 0,
            }}
          >
            <Skeleton.Block height={BADGE_HEIGHT} width="5rem" />
            <Skeleton.Text width="4rem" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
