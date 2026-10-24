import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

export default function CartSkeleton() {
  return (
    <LoadingRegion className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-16">
        <div
          className="flex flex-col w-full max-w-[580px]"
          style={{ backgroundColor: "var(--color-auth-form-bg)" }}
        >
          <div
            className="flex items-baseline gap-3"
            style={{ padding: "1.25rem 1.5rem" }}
          >
            <Skeleton.Block height="2rem" width="30%" />
            <Skeleton.Text width="5rem" />
          </div>

          <ul className="flex flex-col">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                style={{
                  padding: "1.25rem 1.5rem",
                  borderBottom: "1px solid var(--color-auth-divider)",
                }}
              >
                <div className="flex gap-4">
                  <div
                    className="shrink-0 relative"
                    style={{
                      width: 80,
                      height: 80,
                      backgroundColor: "var(--color-auth-input-bg)",
                      border: "1px solid var(--color-auth-input-border)",
                      borderRadius: "var(--radius-none)",
                      overflow: "hidden",
                    }}
                  >
                    <Skeleton.Block height="100%" />
                  </div>

                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <Skeleton.Block height="1rem" width="70%" />
                    <Skeleton.Text width="35%" />
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <div
                        className="shrink-0"
                        style={{
                          width: "calc(6.75rem + 2px)",
                          height: "calc(2.25rem + 2px)",
                          border: "1px solid var(--color-shop-divider)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                      <Skeleton.Text width="5rem" />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 lg:mt-0">
          <div className="lg:sticky lg:top-24">
            <div
              className="shrink-0 flex flex-col gap-4 px-6 py-5"
              style={{
                borderTop: "1px solid var(--color-auth-divider)",
                backgroundColor: "var(--color-auth-form-bg)",
              }}
            >
              <div className="flex items-baseline justify-between">
                <Skeleton.Text width="6rem" />
                <Skeleton.Block height="1.25rem" width="7rem" />
              </div>
              <Skeleton.Block height="3rem" />
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
