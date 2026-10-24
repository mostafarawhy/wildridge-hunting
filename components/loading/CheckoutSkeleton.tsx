import { BRAND } from "@/lib/config/brand";
import BrandMark from "@/components/ui/BrandMark";
import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";

const inputBox = "h-14 w-full bg-white border border-neutral-300 rounded-none";

function SectionHeadingSkeleton() {
  return (
    <div className="mb-7">
      <Skeleton.Block height="2rem" width="30%" />
    </div>
  );
}

export default function CheckoutSkeleton() {
  return (
    <LoadingRegion className="min-h-dvh bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,520px)] min-h-dvh">
        <div className="bg-white order-2 lg:order-1 relative">
          <div className="mx-auto max-w-[580px] px-6 sm:px-8 lg:px-10 pt-12 lg:pt-16 pb-28">
            <div className="inline-flex items-center gap-4 mb-14 group">
              <BrandMark size={104} />
              <span
                dir="ltr"
                className="brand-wordmark brand-wordmark--checkout text-[var(--primitive-black)]"
              >
                {BRAND.wordmark}
              </span>
            </div>

            <Skeleton.Text width="14rem" className="mb-6" />

            <div className="flex justify-end mb-10">
              <Skeleton.Text width="6rem" />
            </div>

            <section className="mb-12">
              <SectionHeadingSkeleton />
              <div className={inputBox} />
            </section>

            <section className="mb-12">
              <SectionHeadingSkeleton />
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={inputBox} />
                  <div className={inputBox} />
                </div>
                <div className={inputBox} />
              </div>
            </section>

            <section className="mb-12">
              <SectionHeadingSkeleton />
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="px-5 py-4 border bg-white flex items-start gap-3 border-neutral-200"
                  >
                    <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-neutral-300" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <Skeleton.Text width="50%" />
                      <Skeleton.Text width="35%" />
                    </div>
                    <Skeleton.Text width="4rem" className="shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-2 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Skeleton.Text width="90%" />
                <Skeleton.Text width="70%" />
              </div>
              <Skeleton.Block height="3.5rem" className="mt-2" />
            </div>
          </div>
        </div>

        <aside className="order-1 lg:order-2 bg-white">
          <div className="lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto px-6 sm:px-8 lg:ps-8 lg:pe-12 pt-12 lg:pt-16 pb-12 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <div className="border border-neutral-200 bg-white">
              <div className="px-6 py-6 divide-y divide-neutral-100">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                    <div className="relative shrink-0">
                      <div className="relative h-[72px] w-[72px] overflow-hidden border border-neutral-200 bg-white">
                        <Skeleton.Block height="100%" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1 flex flex-col gap-2">
                      <Skeleton.Text width="75%" />
                      <Skeleton.Text width="35%" />
                    </div>
                    <Skeleton.Text width="4rem" className="shrink-0 mt-1" />
                  </div>
                ))}
              </div>

              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="px-6 py-4 border-t border-neutral-200 flex justify-between items-center"
                >
                  <Skeleton.Text width="25%" />
                  <Skeleton.Text width="20%" />
                </div>
              ))}

              <div className="px-6 py-5 border-t border-neutral-200 flex justify-between items-baseline">
                <Skeleton.Block height="1rem" width="20%" />
                <Skeleton.Block height="1.75rem" width="35%" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </LoadingRegion>
  );
}
