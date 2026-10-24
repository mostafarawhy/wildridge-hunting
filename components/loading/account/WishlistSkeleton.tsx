import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import AccountHeaderSkeleton from "@/components/loading/account/AccountHeaderSkeleton";

export default function WishlistSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <AccountHeaderSkeleton />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="group relative flex flex-col"
            style={{
              backgroundColor: "var(--primitive-white)",
              borderRadius: "var(--radius-card)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div
              className="relative w-full"
              style={{
                aspectRatio: "3 / 2",
                backgroundColor: "var(--primitive-white)",
              }}
            >
              <Skeleton.Block height="100%" />
            </div>

            <div className="flex flex-col gap-1 px-5 pt-4 pb-5">
              <Skeleton.Text width="80%" />
              <Skeleton.Text width="40%" className="mt-1" />
              <div className="flex items-center gap-3 mt-1">
                <Skeleton.Text width="30%" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
