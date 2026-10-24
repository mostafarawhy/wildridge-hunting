import { getTranslations } from "next-intl/server";
import ShopProductCard from "@/components/shop/ShopProductCard";
import type { ProductListItem } from "@/types/shop";

interface MoreInCategoryProps {
  products: ProductListItem[];
  categoryName: string;
  isBusinessMode?: boolean;
}

export default async function MoreInCategory({
  products,
  categoryName,
  isBusinessMode = false,
}: MoreInCategoryProps) {
  if (products.length === 0) return null;

  const t = await getTranslations("shop");

  return (
    <section
      aria-labelledby="more-in-category"
      className="px-6 lg:px-10 py-10"
      style={{
        borderTop: "1px solid var(--color-shop-divider)",
        backgroundColor: "var(--color-auth-input-bg)",
      }}
    >
      <h2
        id="more-in-category"
        className="text-body-lg mb-5"
        style={{
          color: "var(--primitive-black)",
          fontWeight: "var(--font-semibold)",
        }}
      >
        {t("more_in_category", { category: categoryName })}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((product) => (
          <ShopProductCard
            key={product.id}
            {...product}
            isBusinessMode={isBusinessMode}
          />
        ))}
      </div>
    </section>
  );
}
