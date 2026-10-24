import { useTranslations } from "next-intl";
import ShopProductCard from "@/components/shop/ShopProductCard";
import Skeleton from "@/components/ui/Skeleton";
import type { ProductListItem } from "@/types/shop";

interface ProductGridProps {
  products: ProductListItem[];
  loading?: boolean;
  skeletonCount?: number;
  onQuickView?: (product: ProductListItem) => Promise<void> | void;
  loadingCardSku?: string | null;
  isBusinessMode?: boolean;
}

export default function ProductGrid({
  products,
  loading = false,
  skeletonCount = 8,
  onQuickView,
  loadingCardSku,
  isBusinessMode = false,
}: ProductGridProps) {
  const t = useTranslations("shop");

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 p-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "var(--primitive-white)",
              borderRadius: "var(--radius-card)",
              padding: "1rem",
            }}
          >
            <Skeleton.ProductCard />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p
          className="text-body-lg tracking-widest uppercase mb-3"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("no_results")}
        </p>
        <p
          className="text-body"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("no_results_hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 p-6">
      {products.map((product) => (
        <ShopProductCard
          key={product.id}
          {...product}
          onQuickView={onQuickView}
          isLoadingQuickView={loadingCardSku === product.sku}
          isBusinessMode={isBusinessMode}
        />
      ))}
    </div>
  );
}
