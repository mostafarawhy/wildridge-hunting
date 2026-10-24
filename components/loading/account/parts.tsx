import type { CSSProperties } from "react";
import BrandMark from "@/components/ui/BrandMark";
import Skeleton from "@/components/ui/Skeleton";

export const BADGE_HEIGHT = "calc(var(--text-eyebrow) * 1.4 + 0.375rem + 2px)";
export const INPUT_HEIGHT = "calc(1.25rem + var(--text-body) * 1.5 + 3px)";
export const BUTTON_MD_HEIGHT = "2.5rem";
export const BUTTON_LG_HEIGHT = "3rem";

export const inputBox: CSSProperties = {
  width: "100%",
  height: INPUT_HEIGHT,
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1.5px solid var(--color-auth-input-border)",
  borderRadius: "var(--radius-none)",
};

export function InputFieldSkeleton({
  labelWidth = "7rem",
  hint = false,
}: {
  labelWidth?: string;
  hint?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <Skeleton.Text width={labelWidth} />
      <div style={inputBox} />
      {hint && <Skeleton.Text width="45%" />}
    </div>
  );
}

export function LabelledInputSkeleton({ labelWidth = "8rem" }: { labelWidth?: string }) {
  return (
    <div>
      <Skeleton.Text width={labelWidth} className="mb-1.5" />
      <div style={inputBox} />
    </div>
  );
}

export function ListCardSkeleton() {
  return (
    <div
      style={{
        display: "block",
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
          <div style={{ flex: 1 }}>
            <Skeleton.Text width="40%" className="mb-1" />
            <Skeleton.Block height="1rem" width="75%" />
          </div>
          <Skeleton.Block height={BADGE_HEIGHT} width="4.5rem" className="flex-shrink-0" />
        </div>

        <Skeleton.Text width="70%" />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--color-auth-form-border)",
          }}
        >
          <div style={{ width: "40%" }}>
            <Skeleton.Text width="80%" />
            <Skeleton.Text width="50%" className="mt-0.5" />
          </div>
          <Skeleton.Block height="1.25rem" width="30%" />
        </div>
      </div>
    </div>
  );
}

function CredentialField({ valueWidth, valueHeight = "0.75rem" }: { valueWidth: string; valueHeight?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", textAlign: "start" }}>
      <Skeleton.Text width="4.5rem" />
      <Skeleton.Block height={valueHeight} width={valueWidth} />
    </div>
  );
}

function CredentialRule() {
  return (
    <div
      style={{
        height: "1px",
        backgroundColor: "var(--color-shop-divider)",
        margin: "1rem 0",
      }}
    />
  );
}

export function CredentialCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "3px",
          backgroundColor: "var(--color-action-primary)",
        }}
      />
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BrandMark size={44} />
            <Skeleton.Text width="7rem" />
          </div>
          <Skeleton.Text width="4.5rem" />
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <Skeleton.Block height="110px" width="88px" className="flex-shrink-0" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              minWidth: 0,
              flex: 1,
            }}
          >
            <CredentialField valueWidth="70%" valueHeight="1rem" />
            <CredentialField valueWidth="50%" />
          </div>
        </div>

        <CredentialRule />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <CredentialField valueWidth="60%" />
          <CredentialField valueWidth="60%" />
        </div>

        <CredentialRule />
        <CredentialField valueWidth="80%" />
      </div>
    </div>
  );
}

export function DetailRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      <Skeleton.Text width="8rem" className="mb-3" />
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          padding: "0 1.25rem",
        }}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            style={{
              padding: "0.875rem 0",
              borderBottom:
                index < rows - 1 ? "1px solid var(--color-shop-divider)" : "none",
              textAlign: "start",
            }}
          >
            <Skeleton.Text width="6rem" />
            <Skeleton.Text width="40%" className="mt-1.5" />
          </div>
        ))}
      </div>
      <Skeleton.Text width="70%" className="mt-2" />
    </div>
  );
}

export function DocumentStripSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div>
      <Skeleton.Text width="8rem" className="mb-3" />
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.5rem",
        }}
      >
        {Array.from({ length: tiles }).map((_, i) => (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "96px" }}
          >
            <Skeleton.Block height="96px" width="96px" />
            <Skeleton.Text width="70%" />
          </div>
        ))}
      </div>
      <Skeleton.Text width="50%" />
    </div>
  );
}

export function ReviewHistorySkeleton({ entries = 3 }: { entries?: number }) {
  return (
    <div>
      <Skeleton.Text width="6rem" className="mb-3" />
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          padding: "0 1.25rem",
        }}
      >
        {Array.from({ length: entries }).map((_, index) => (
          <div
            key={index}
            style={{
              padding: "0.875rem 0",
              borderBottom:
                index < entries - 1 ? "1px solid var(--color-shop-divider)" : "none",
            }}
          >
            <Skeleton.Text width="40%" />
            <Skeleton.Text width="25%" className="mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageBoxSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1rem 1.25rem",
      }}
    >
      <Skeleton.Text width="6rem" />
      <Skeleton.Text width="85%" className="mt-2" />
      <Skeleton.Text width="60%" className="mt-1.5" />
    </div>
  );
}

export function AcknowledgmentSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        padding: "1rem",
      }}
    >
      <Skeleton.Text width="9rem" />
      <div style={{ marginTop: "0.375rem" }} className="flex flex-col gap-1.5">
        <Skeleton.Text width="95%" />
        <Skeleton.Text width="70%" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          marginTop: "0.75rem",
        }}
      >
        <Skeleton.Block height="0.875rem" width="0.875rem" className="flex-shrink-0" />
        <Skeleton.Text width="60%" />
      </div>
    </div>
  );
}

export function NoteSkeleton({ widths = ["90%", "60%"] }: { widths?: string[] }) {
  return (
    <div
      style={{
        borderInlineStart: "3px solid var(--color-shop-divider)",
        paddingInlineStart: "0.75rem",
      }}
      className="flex flex-col gap-1.5"
    >
      {widths.map((width, i) => (
        <Skeleton.Text key={i} width={width} />
      ))}
    </div>
  );
}

export const sectionCard: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

export const detailCardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
};

export function DetailCardHeader() {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderBottom: "1px solid var(--color-auth-form-border)",
      }}
    >
      <Skeleton.Text width="30%" />
    </div>
  );
}
