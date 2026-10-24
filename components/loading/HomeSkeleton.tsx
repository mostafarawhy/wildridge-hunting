import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

const VISIBLE = 4;

function HeroSkeleton() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        height: "calc(100svh - 112px)",
        minHeight: "560px",
        backgroundColor: "var(--color-surface-sunken)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--primitive-black)" }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.15) 100%)",
          zIndex: 1,
        }}
      />

      <div
        className="absolute bottom-0 start-0 end-0 px-6 pb-12 lg:px-16 lg:pb-16"
        style={{ zIndex: 2 }}
      >
        <div className="mx-auto max-w-[1440px]">
          <Skeleton.Text tone="dark" width="10rem" className="mb-3" />

          <div className="mb-8 flex flex-col gap-3">
            <Skeleton.Block tone="dark" height="var(--text-display)" width="55%" />
            <Skeleton.Block tone="dark" height="var(--text-display)" width="40%" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Skeleton.Block tone="dark" height="2.75rem" width="10rem" />
            <div
              style={{
                height: "2.75rem",
                width: "10rem",
                border: "1px solid var(--color-content-primary)",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedSkeleton() {
  return (
    <section
      className="w-full py-10 lg:py-14"
      style={{ backgroundColor: "var(--color-surface-inverse)" }}
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <Skeleton.Text width="6rem" className="mb-2" />
            <Skeleton.Block height="2rem" width="16rem" />
          </div>
          <Skeleton.Text width="4rem" className="hidden lg:block" />
        </div>

        <div className="relative overflow-hidden">
          <div className="flex gap-6 lg:gap-8">
            {Array.from({ length: VISIBLE }).map((_, i) => (
              <div
                key={i}
                className="group flex flex-col flex-shrink-0"
                style={{
                  width: `calc((100% - ${(VISIBLE - 1) * 32}px) / ${VISIBLE})`,
                }}
              >
                <div
                  className="relative w-full overflow-hidden mb-3"
                  style={{
                    aspectRatio: "1/1",
                    backgroundColor: "var(--color-surface-raised)",
                  }}
                >
                  <Skeleton.Block tone="dark" height="100%" />
                </div>

                <Skeleton.Text width="35%" className="mb-2" />
                <Skeleton.Text width="80%" className="mb-2" />
                <Skeleton.Text width="30%" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-center lg:hidden">
          <Skeleton.Text width="4rem" />
        </div>
      </div>
    </section>
  );
}

function CollectionTilesSkeleton() {
  return (
    <section
      className="w-full"
      style={{ backgroundColor: "var(--color-surface-base)" }}
    >
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ minHeight: "520px" }}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="group relative overflow-hidden"
            style={{ minHeight: "420px" }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: "var(--primitive-black)" }}
            />

            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.3) 100%)",
              }}
            />

            {index < 3 && (
              <div
                className="absolute top-0 end-0 bottom-0 w-px hidden lg:block"
                style={{
                  backgroundColor: "var(--color-border-default)",
                }}
              />
            )}

            <div className="absolute bottom-0 start-0 end-0 p-8 lg:p-10">
              <Skeleton.Text tone="dark" width="6rem" className="mb-2" />
              <Skeleton.Block tone="dark" height="2rem" width="55%" className="mb-5" />
              <div
                style={{
                  height: "2.5rem",
                  width: "8rem",
                  border: "1px solid var(--color-content-primary)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DesertBannerSkeleton() {
  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "650px" }}>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-surface-sunken)", zIndex: 0 }}
      />

      <div
        className="absolute top-0 left-0 right-0 h-[60px]"
        style={{ backgroundColor: "rgba(0,0,0,0.90)", zIndex: 2 }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-[60px]"
        style={{ backgroundColor: "rgba(0,0,0,0.90)", zIndex: 2 }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.5) 100%)",
          zIndex: 2,
        }}
      />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
        style={{ zIndex: 3 }}
      >
        <Skeleton.Block tone="dark" height="var(--text-display)" width="50%" />
      </div>
    </section>
  );
}

function NewsletterSkeleton() {
  return (
    <section className="w-full">
      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{ minHeight: "560px" }}
      >
        <div
          className="relative flex flex-col items-start justify-end p-10 lg:p-16"
          style={{
            backgroundColor: "var(--primitive-black)",
            minHeight: "360px",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.4) 100%)",
            }}
          />

          <div className="relative flex flex-col gap-6 w-full" style={{ zIndex: 1 }}>
            <div className="flex flex-col gap-3">
              <Skeleton.Block tone="dark" height="2rem" width="60%" />
              <Skeleton.Block tone="dark" height="2rem" width="45%" />
            </div>

            <div className="flex items-center gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton.Block key={i} tone="dark" height="18px" width="18px" />
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex flex-col justify-center px-10 py-14 lg:px-16"
          style={{ backgroundColor: "var(--color-surface-sunken)" }}
        >
          <div className="mb-6 flex flex-col gap-2 max-w-[380px]">
            <Skeleton.Text tone="dark" width="100%" />
            <Skeleton.Text tone="dark" width="75%" />
          </div>

          <div className="flex flex-col gap-4 max-w-[420px]">
            <div className="flex">
              <div
                className="flex-1 h-12 min-w-0"
                style={{
                  border: "1px solid var(--color-border-default)",
                  borderInlineEnd: "none",
                }}
              />
              <Skeleton.Block tone="dark" height="3rem" width="7rem" className="shrink-0" />
            </div>

            <Skeleton.Text tone="dark" width="80%" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseSkeleton() {
  return (
    <section
      className="w-full"
      style={{ backgroundColor: "var(--color-surface-inverse)" }}
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-20 py-16 lg:py-24">
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <Skeleton.Block height="100%" />
          </div>

          <div className="flex flex-col items-start">
            <Skeleton.Text width="7rem" className="mb-4" />

            <div className="mb-6 flex w-full flex-col gap-3">
              <Skeleton.Block height="var(--text-display-sm)" width="70%" />
              <Skeleton.Block height="var(--text-display-sm)" width="50%" />
            </div>

            <div className="mb-10 flex w-full max-w-[420px] flex-col gap-2">
              <Skeleton.Text width="100%" />
              <Skeleton.Text width="90%" />
              <Skeleton.Text width="60%" />
            </div>

            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    height: "2.75rem",
                    width: "12rem",
                    border: "1px solid var(--color-content-inverse)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandStorySkeleton() {
  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: "550px" }}>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-surface-sunken)", zIndex: 0 }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.65) 100%)",
          zIndex: 2,
        }}
      />

      <div
        className="absolute bottom-0 start-0 end-0 px-8 pb-20 lg:px-16 lg:pb-24"
        style={{ zIndex: 3 }}
      >
        <div className="mx-auto max-w-[1440px] flex flex-col items-start gap-5 lg:max-w-[560px] lg:mx-0">
          <Skeleton.Text tone="dark" width="7rem" />

          <div className="flex w-full flex-col gap-3">
            <Skeleton.Block tone="dark" height="2rem" width="80%" />
            <Skeleton.Block tone="dark" height="2rem" width="55%" />
          </div>

          <div className="flex w-full max-w-[420px] flex-col gap-2">
            <Skeleton.Text tone="dark" width="100%" />
            <Skeleton.Text tone="dark" width="70%" />
          </div>

          <Skeleton.Block tone="dark" height="2.5rem" width="9rem" className="mt-2" />
        </div>
      </div>
    </section>
  );
}

export default function HomeSkeleton() {
  return (
    <LoadingRegion>
      <HeroSkeleton />
      <FeaturedSkeleton />
      <CollectionTilesSkeleton />
      <DesertBannerSkeleton />
      <NewsletterSkeleton />
      <ShowcaseSkeleton />
      <BrandStorySkeleton />
    </LoadingRegion>
  );
}
