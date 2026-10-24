import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  AcknowledgmentSkeleton,
  BUTTON_LG_HEIGHT,
  LabelledInputSkeleton,
  MessageBoxSkeleton,
} from "@/components/loading/account/parts";

export default function VerificationDetailsSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderSkeleton />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <MessageBoxSkeleton />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <LabelledInputSkeleton labelWidth="9rem" />
          <LabelledInputSkeleton labelWidth="7rem" />
        </div>

        <AcknowledgmentSkeleton />
        <Skeleton.Block height={BUTTON_LG_HEIGHT} />
      </div>
    </LoadingRegion>
  );
}
