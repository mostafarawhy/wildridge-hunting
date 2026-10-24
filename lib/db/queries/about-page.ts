import "server-only";
import { db } from "@/lib/db/client";
import { STOREFRONT_WHERE } from "@/lib/db/queries/products";
import { readAboutPage, type AboutFigureCounts } from "@/lib/settings/about-page";

export async function getAboutPage() {
  const row = await db.projectConfig.findUnique({
    where: { key: "about_page" },
    select: { value: true },
  });
  return readAboutPage(row?.value);
}

export async function getAboutFigureCounts(): Promise<AboutFigureCounts> {
  const [products, brands, showrooms] = await Promise.all([
    db.product.count({ where: STOREFRONT_WHERE }),
    db.brand.count({
      where: {
        isVisible: true,
        deletedAt: null,
        products: { some: STOREFRONT_WHERE },
      },
    }),
    db.store.count({ where: { isActive: true } }),
  ]);
  return { brands, products, showrooms };
}
