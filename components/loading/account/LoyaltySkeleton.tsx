import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";

export default function LoyaltySkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-auth-form-border)",
            borderRadius: "var(--radius-none)",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <Skeleton.Text width="30%" />
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <Skeleton.Block height="var(--text-display-sm)" width="6rem" />
            <Skeleton.Text width="3rem" />
          </div>
          <Skeleton.Text width="60%" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-auth-form-border)",
                borderRadius: "var(--radius-none)",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                  flex: 1,
                }}
              >
                <Skeleton.Text width="35%" />
                <Skeleton.Text width="45%" />
                <Skeleton.Text width="25%" />
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
                <Skeleton.Block height="1.25rem" width="3rem" />
                <Skeleton.Text width="6rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
