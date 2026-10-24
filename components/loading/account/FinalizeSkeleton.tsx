import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import {
  BUTTON_LG_HEIGHT,
  DetailCardHeader,
  detailCardStyle,
} from "@/components/loading/account/parts";

const ITEMS = 4;

export default function FinalizeSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Skeleton.Text width="5rem" className="mb-5" />
        <Skeleton.Block height="1.75rem" width="40%" />
        <Skeleton.Text width="50%" className="mt-1.5" />
      </div>

      <div style={detailCardStyle}>
        <DetailCardHeader />
        <div
          style={{
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <Skeleton.Block height="1rem" width="40%" />
          <Skeleton.Text width="30%" />
          <Skeleton.Text width="70%" />
          <Skeleton.Text width="55%" />
          <Skeleton.Text width="30%" />
          <Skeleton.Text width="60%" className="mt-2" />
        </div>
      </div>

      <div style={detailCardStyle}>
        <DetailCardHeader />
        <div style={{ padding: "0 1.25rem" }}>
          {Array.from({ length: ITEMS }).map((_, idx) => (
            <div
              key={idx}
              style={{
                padding: "1rem 0",
                borderBottom:
                  idx === ITEMS - 1 ? "none" : "1px solid var(--color-auth-form-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton.Text width="55%" />
                  <Skeleton.Text width="25%" className="mt-1.5" />
                </div>
                <Skeleton.Text width="5rem" className="flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={detailCardStyle}>
        <DetailCardHeader />
        <div
          style={{
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <Skeleton.Text width="30%" />
              <Skeleton.Text width="20%" />
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: "0.625rem",
              borderTop: "1px solid var(--color-auth-form-border)",
              marginTop: "0.25rem",
              marginBottom: "0.5rem",
            }}
          >
            <Skeleton.Text width="15%" />
            <Skeleton.Block height="1.75rem" width="30%" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Skeleton.Block height={BUTTON_LG_HEIGHT} />
              <Skeleton.Text width="70%" />
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
