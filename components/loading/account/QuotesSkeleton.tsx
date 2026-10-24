import LoadingRegion from "@/components/loading/LoadingRegion";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";
import { ListCardSkeleton } from "@/components/loading/account/parts";

export default function QuotesSkeleton() {
  return (
    <LoadingRegion style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <AccountHeaderSkeleton />

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "1rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <ListCardSkeleton key={i} />
        ))}
      </div>
    </LoadingRegion>
  );
}
