import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  BADGE_HEIGHT,
  BUTTON_MD_HEIGHT,
  InputFieldSkeleton,
  sectionCard,
} from "@/components/loading/account/parts";

function SectionTitle() {
  return (
    <div>
      <Skeleton.Block height="1.25rem" width="10rem" />
      <Skeleton.Text width="60%" className="mt-1.5" />
    </div>
  );
}

export default function SettingsSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={sectionCard}>
          <SectionTitle />
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <InputFieldSkeleton labelWidth="4rem" />
            <InputFieldSkeleton labelWidth="6rem" />
            <InputFieldSkeleton labelWidth="4rem" hint />
            <InputFieldSkeleton labelWidth="6rem" hint />
            <div>
              <Skeleton.Block height={BUTTON_MD_HEIGHT} width="9rem" />
            </div>
          </div>
        </div>

        <div style={sectionCard}>
          <SectionTitle />
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <InputFieldSkeleton labelWidth="8rem" />
            <InputFieldSkeleton labelWidth="7rem" />
            <InputFieldSkeleton labelWidth="9rem" />
            <div>
              <Skeleton.Block height={BUTTON_MD_HEIGHT} width="10rem" />
            </div>
          </div>
        </div>
      </div>

      <div style={sectionCard}>
        <SectionTitle />
        <div
          style={{
            border: "1px solid var(--color-shop-divider)",
            borderRadius: "var(--radius-none)",
            padding: "1.25rem",
            backgroundColor: "#fff",
            textAlign: "start",
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <Skeleton.Text width="8rem" />
            <Skeleton.Text width="60%" className="mt-1.5" />
          </div>
          <Skeleton.Block height={BADGE_HEIGHT} width="4rem" className="flex-shrink-0" />
        </div>
      </div>
    </LoadingRegion>
  );
}
