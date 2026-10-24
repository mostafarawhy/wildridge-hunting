import Image from "next/image";
import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

export default function B2BLandingSkeleton() {
  return (
    <LoadingRegion className="lg:min-h-[calc(100dvh-var(--spacing-header))]">
      <div className="lg:grid lg:grid-cols-[45%_55%] lg:min-h-[calc(100dvh-var(--spacing-header))]">
        <section className="relative bg-neutral-900 h-[55vh] lg:h-auto overflow-hidden">
          <Image
            src="/images/b2b/hero.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.75) 100%)",
            }}
          />
          <div className="relative h-full flex flex-col justify-end gap-6 p-8 lg:p-10 xl:p-14 text-white">
            <div className="flex flex-col gap-3 max-w-sm">
              <Skeleton.Text tone="dark" width="30%" />
              <Skeleton.Block tone="dark" height="2.75rem" width="85%" />
              <Skeleton.Block tone="dark" height="2.75rem" width="60%" />
              <Skeleton.Text tone="dark" width="80%" />
              <Skeleton.Text tone="dark" width="60%" />
            </div>
            <Skeleton.Text tone="dark" width="50%" />
          </div>
        </section>

        <section className="bg-white flex flex-col px-8 py-10 sm:px-12 sm:py-12 lg:px-14 xl:px-20 lg:py-12 xl:py-16">
          <div className="flex flex-col justify-between h-full gap-8">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-1.5">
                <Skeleton.Text width="6rem" />
                <Skeleton.Block height="2rem" width="70%" />
              </div>

              <div className="flex flex-col gap-3">
                {["70%", "60%", "65%"].map((width) => (
                  <div key={width} className="flex items-start gap-4">
                    <div className="shrink-0" style={{ minWidth: "2rem" }}>
                      <Skeleton.Text width="1.25rem" />
                    </div>
                    <Skeleton.Text width={width} />
                  </div>
                ))}
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="grid grid-cols-2 gap-8">
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-2.5">
                    <Skeleton.Text width="50%" />
                    <div className="flex flex-col gap-2">
                      <Skeleton.Text width="80%" />
                      <Skeleton.Text width="65%" />
                      <Skeleton.Text width="70%" />
                    </div>
                  </div>
                ))}
              </div>

              <Skeleton.Text width="40%" />
            </div>

            <div className="flex flex-col gap-3">
              <Skeleton.Block height="3rem" />
            </div>
          </div>
        </section>
      </div>
    </LoadingRegion>
  );
}
