import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import { BADGE_HEIGHT } from "@/components/loading/account/parts";

export default function AddressesSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <Skeleton.Block height="1.75rem" width="12rem" />
          <Skeleton.Text width="18rem" className="mt-1" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div
            style={{
              height: "2rem",
              width: "7rem",
              border: "1px solid var(--color-auth-form-border)",
              flexShrink: 0,
            }}
          />
          <Skeleton.Block height="2rem" width="8rem" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "1rem" }}>
        {[true, false].map((isDefault, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#ffffff",
              border: `1px solid ${isDefault ? "var(--color-action-primary)" : "var(--color-auth-form-border)"}`,
              borderRadius: "var(--radius-none)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                <Skeleton.Text width="25%" />
                <Skeleton.Block height="1rem" width="55%" />
              </div>
              {isDefault && (
                <Skeleton.Block height={BADGE_HEIGHT} width="4rem" className="flex-shrink-0" />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <Skeleton.Text width="80%" />
              <Skeleton.Text width="60%" />
              <Skeleton.Text width="40%" />
              <Skeleton.Text width="35%" />
            </div>

            <Skeleton.Text width="45%" />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--color-auth-form-border)",
              }}
            >
              <Skeleton.Text width="2rem" />
              <Skeleton.Text width="3rem" />
              {!isDefault && (
                <div style={{ marginInlineStart: "auto" }}>
                  <Skeleton.Text width="5rem" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
