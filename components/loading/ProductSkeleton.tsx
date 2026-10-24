import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

export default function ProductSkeleton() {
  return (
    <LoadingRegion
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      <div
        className="px-6 lg:px-10 py-3"
        style={{ borderBottom: "1px solid var(--color-shop-divider)" }}
      >
        <div className="flex items-center gap-2 text-body-sm flex-wrap">
          <Skeleton.Text width="3rem" />
          <Skeleton.Text width="6rem" />
          <Skeleton.Text width="7rem" />
          <Skeleton.Text width="10rem" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div
          className="lg:w-[55%] flex-shrink-0"
          style={{
            backgroundColor: "var(--color-shop-bg)",
            borderInlineEnd: "1px solid var(--color-shop-divider)",
          }}
        >
          <div className="sticky top-0 pt-2">
            <div className="flex flex-col gap-3 p-6 lg:p-8">
              <div
                className="w-full"
                style={{
                  aspectRatio: "4 / 3",
                  backgroundColor: "var(--primitive-white)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                }}
              >
                <Skeleton.Block height="100%" />
              </div>

              <div className="flex flex-row gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0"
                    style={{
                      width: "72px",
                      height: "72px",
                      border: "2px solid var(--color-shop-divider)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--primitive-white)",
                      padding: "4px",
                    }}
                  >
                    <Skeleton.Block height="100%" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col gap-5 px-6 lg:px-10 py-8"
          style={{ backgroundColor: "var(--color-auth-input-bg)" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton.Text width="5rem" />
            <Skeleton.Text width="8rem" />
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton.Block height="2.5rem" width="85%" />
            <Skeleton.Block height="2.5rem" width="55%" />
          </div>

          <Skeleton.Block
            height="calc(var(--text-eyebrow) * 1.5 + 0.5rem + 2px)"
            width="5rem"
          />

          <div className="flex flex-col gap-2">
            <Skeleton.Block
              height="calc(var(--text-display-sm) * 1.5)"
              width="30%"
            />
            <div className="flex items-center justify-between gap-3">
              <Skeleton.Text width="6rem" />
              <Skeleton.Text width="5rem" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {["100%", "96%", "70%"].map((width) => (
              <Skeleton.Text key={width} width={width} />
            ))}
          </div>

          <Skeleton.Block height="3.5rem" width="100%" />

          <div
            style={{
              height: "1px",
              backgroundColor: "var(--color-shop-divider)",
            }}
          />

          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0"
              style={{
                width: "calc(6.75rem + 2px)",
                height: "calc(2.25rem + 2px)",
                border: "1px solid var(--color-shop-divider)",
                borderRadius: "var(--radius-sm)",
              }}
            />
            <Skeleton.Block height="3rem" className="flex-1" />
          </div>

          <div className="grid grid-cols-3" style={{ gap: "0.5rem" }}>
            {[0, 1, 2].map((i) => (
              <Skeleton.Block key={i} height="3.5rem" />
            ))}
          </div>

          <div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  borderTop: "1px solid var(--color-shop-divider)",
                  padding: "1rem 0",
                }}
              >
                <Skeleton.Text width="8rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
