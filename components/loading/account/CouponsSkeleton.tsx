import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";

export default function CouponsSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-auth-form-border)",
              borderRadius: "var(--radius-none)",
            }}
          >
            <div
              style={{
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <Skeleton.Text width="5rem" className="mb-1" />
                  <Skeleton.Block height="1rem" width="7rem" />
                </div>
                <Skeleton.Block height="1.25rem" width="4rem" />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--color-auth-form-border)",
                }}
              >
                <div>
                  <Skeleton.Text width="9rem" />
                  <Skeleton.Text width="7rem" className="mt-0.5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
