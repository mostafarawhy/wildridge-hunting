import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import { FiltersSkeleton } from "@/components/shop/filters/FiltersSkeleton";
import ProductGrid from "@/components/shop/ProductGrid";
import ShopHero from "@/components/shop/ShopHero";
import type { FocalPoint } from "@/lib/utils/focal-point";

export default function CatalogSkeleton({
  heroSrc,
  heroFocus,
}: {
  heroSrc: string;
  heroFocus?: FocalPoint;
}) {
  return (
    <LoadingRegion
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      <ShopHero imageSrc={heroSrc} focus={heroFocus}>
        <Skeleton.Block tone="dark" height="2.25rem" width="14rem" />
        <div
          style={{
            width: "100px",
            height: "2px",
            backgroundColor: "var(--color-action-primary)",
          }}
        />
      </ShopHero>

      <div className="flex">
        <div
          className="hidden lg:block w-64 flex-shrink-0"
          style={{
            backgroundColor: "var(--color-shop-bg)",
            borderInlineEnd: "1px solid var(--color-shop-divider)",
            minHeight: "100%",
          }}
        >
          <FiltersSkeleton />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-4 px-6 py-3"
            style={{
              backgroundColor: "var(--primitive-white)",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <div
              className="flex-1 max-w-sm h-9"
              style={{ border: "1px solid var(--color-content-tertiary)" }}
            />

            <Skeleton.Text width="5rem" className="flex-shrink-0 ms-auto" />

            <div
              className="h-5 w-32"
              style={{ borderBottom: "1px solid var(--primitive-black)" }}
            />
          </div>

          <ProductGrid products={[]} loading />
        </div>
      </div>
    </LoadingRegion>
  );
}
