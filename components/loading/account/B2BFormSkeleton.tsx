import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  AcknowledgmentSkeleton,
  BUTTON_LG_HEIGHT,
  LabelledInputSkeleton,
  MessageBoxSkeleton,
  NoteSkeleton,
} from "@/components/loading/account/parts";

export default function B2BFormSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <NoteSkeleton />
        <MessageBoxSkeleton />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {["9rem", "11rem", "8rem", "7rem", "7rem", "8rem"].map((width, i) => (
            <LabelledInputSkeleton key={i} labelWidth={width} />
          ))}
        </div>

        <AcknowledgmentSkeleton />
        <Skeleton.Block height={BUTTON_LG_HEIGHT} />
      </div>
    </LoadingRegion>
  );
}
