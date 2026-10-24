import LoadingRegion from "@/components/loading/LoadingRegion";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import {
  CredentialCardSkeleton,
  DetailRowsSkeleton,
  DocumentStripSkeleton,
  ReviewHistorySkeleton,
} from "@/components/loading/account/parts";

export default function VerificationSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6 max-w-2xl">
      <AccountHeaderSkeleton />
      <div>
        <CredentialCardSkeleton />
      </div>
      <DetailRowsSkeleton rows={4} />
      <DocumentStripSkeleton tiles={4} />
      <ReviewHistorySkeleton entries={3} />
    </LoadingRegion>
  );
}
