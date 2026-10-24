import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  AcknowledgmentSkeleton,
  BUTTON_LG_HEIGHT,
  BUTTON_MD_HEIGHT,
  NoteSkeleton,
} from "@/components/loading/account/parts";

const boxStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
} as const;

const bandStyle = {
  padding: "0.625rem 0.875rem",
  borderBottom: "1px solid var(--color-shop-divider)",
} as const;

function ChecklistGroup({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Skeleton.Text width="6rem" />
      {items.map((width, i) => (
        <div key={i} style={{ paddingInlineStart: "1rem" }}>
          <Skeleton.Text width={width} />
        </div>
      ))}
    </div>
  );
}

export default function B2BRenewSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          className="flex flex-col gap-3 p-5"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            borderRadius: "var(--radius-none)",
          }}
        >
          <Skeleton.Text width="7rem" />
          <Skeleton.Text width="90%" />
          <Skeleton.Text width="70%" />
        </div>

        <div style={boxStyle}>
          <div style={bandStyle}>
            <Skeleton.Text width="7rem" />
          </div>
          <div
            style={{
              padding: "1.25rem 0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <ChecklistGroup items={["40%", "35%", "45%"]} />
            <ChecklistGroup items={["30%", "40%"]} />
            <Skeleton.Text width="70%" />
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            padding: "1rem 1.25rem",
          }}
        >
          <Skeleton.Text width="6rem" />
          <Skeleton.Block height="1rem" width="30%" className="mt-1.5" />
          <Skeleton.Text width="50%" className="mt-2" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {[0, 1].map((i) => (
            <div key={i} style={boxStyle}>
              <div
                style={{
                  ...bandStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Skeleton.Text width="10rem" />
                <Skeleton.Text width="4rem" />
              </div>
              <div
                style={{
                  padding: "0.875rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <NoteSkeleton widths={["80%"]} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <Skeleton.Text width="6rem" />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      padding: "1.5rem 1rem",
                      backgroundColor: "var(--color-auth-input-bg)",
                      border: "1.5px dashed var(--color-auth-input-border)",
                    }}
                  >
                    <Skeleton.Block height="1.5rem" width="1.5rem" />
                    <Skeleton.Text width="40%" />
                    <Skeleton.Text width="30%" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              height: BUTTON_MD_HEIGHT,
              width: "9rem",
              border: "1px solid var(--color-action-secondary-border)",
            }}
          />
          <Skeleton.Text width="5rem" />
        </div>

        <AcknowledgmentSkeleton />
        <Skeleton.Block height={BUTTON_LG_HEIGHT} />
      </div>
    </LoadingRegion>
  );
}
