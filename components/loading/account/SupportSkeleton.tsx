import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  BADGE_HEIGHT,
  BUTTON_MD_HEIGHT,
  InputFieldSkeleton,
  sectionCard,
} from "@/components/loading/account/parts";

export default function SupportSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Skeleton.Text width="5rem" className="mb-1" />
        <AccountHeaderSkeleton help={false} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              border: "1px solid var(--color-shop-divider)",
              backgroundColor: "var(--color-auth-input-bg)",
              flex: "1 1 220px",
              minWidth: "220px",
            }}
          >
            <span
              style={{
                width: "2.5rem",
                height: "2.5rem",
                flexShrink: 0,
                backgroundColor: "var(--color-auth-form-bg)",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1 }}>
              <Skeleton.Text width="5rem" />
              <Skeleton.Text width="7rem" />
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
        <Skeleton.Text width="3rem" />
        <Skeleton.Text width="5rem" />
      </div>

      <div style={sectionCard}>
        <Skeleton.Block height="1.25rem" width="10rem" />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <Skeleton.Text width="6rem" className="mb-2" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {["4.5rem", "5.5rem", "5rem", "4rem"].map((width) => (
                <div
                  key={width}
                  style={{
                    height: "calc(var(--text-body-sm) * 1.5 + 1rem + 2px)",
                    width,
                    border: "1px solid var(--color-auth-input-border)",
                    borderRadius: "var(--radius-none)",
                  }}
                />
              ))}
            </div>
          </div>

          <InputFieldSkeleton labelWidth="5rem" />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Skeleton.Text width="5rem" />
            <div
              style={{
                width: "100%",
                height: "calc(var(--text-body) * 7.5 + 1.25rem + 3px)",
                backgroundColor: "var(--color-auth-input-bg)",
                border: "1.5px solid var(--color-auth-input-border)",
                borderRadius: "var(--radius-none)",
              }}
            />
          </div>

          <div
            style={{
              borderInlineStart: "3px solid var(--color-shop-divider)",
              paddingInlineStart: "0.75rem",
            }}
          >
            <Skeleton.Text width="80%" />
          </div>

          <div>
            <Skeleton.Block height={BUTTON_MD_HEIGHT} width="8rem" />
          </div>
        </div>
      </div>

      <div style={sectionCard}>
        <Skeleton.Block height="1.25rem" width="10rem" />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--color-shop-divider)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <Skeleton.Block height="1rem" width="50%" />
                <Skeleton.Block height={BADGE_HEIGHT} width="5rem" />
              </div>
              <Skeleton.Text width="60%" />
              <Skeleton.Text width="6rem" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
