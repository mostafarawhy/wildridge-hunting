import type { CSSProperties, ReactNode } from "react";
import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

const cardStyle: CSSProperties = {
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
};

function Section({ children }: { children: ReactNode }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-auth-form-border)",
        }}
      >
        <Skeleton.Text width="30%" />
      </div>
      <div
        style={{
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
};

export default function AccountDetailSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Skeleton.Text width="5rem" className="mb-5" />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              flex: 1,
            }}
          >
            <Skeleton.Block height="1.75rem" width="40%" />
            <Skeleton.Block height="1.25rem" width="5rem" />
          </div>

          <div
            style={{
              height: "2rem",
              width: "7rem",
              border: "1px solid var(--color-auth-form-border)",
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      <Section>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton.Text width="40%" />
              <Skeleton.Block height="1rem" width="70%" />
            </div>
          ))}
        </div>
      </Section>

      <Section>
        {[0, 1].map((i) => (
          <div key={i} style={rowStyle}>
            <Skeleton.Block height="3.5rem" width="3.5rem" className="flex-shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton.Text width="65%" />
              <Skeleton.Text width="30%" />
            </div>
            <Skeleton.Text width="4rem" className="flex-shrink-0" />
          </div>
        ))}
      </Section>

      <Section>
        {[0, 1, 2].map((i) => (
          <div key={i} style={rowStyle}>
            <Skeleton.Text width="30%" />
            <Skeleton.Text width="20%" />
          </div>
        ))}
        <div style={rowStyle}>
          <Skeleton.Block height="1.25rem" width="25%" />
          <Skeleton.Block height="1.25rem" width="30%" />
        </div>
      </Section>
    </LoadingRegion>
  );
}
