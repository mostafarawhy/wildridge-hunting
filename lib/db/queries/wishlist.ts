import "server-only";
import { db } from "@/lib/db/client";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import { BRAND_LABEL_SELECT, toBrandLabel } from "@/lib/utils/brand";
import { getSetting } from "@/lib/db/queries/settings";
import { POINTS_BOOST_SELECT, toPointsBoost } from "@/lib/db/queries/products";
import type { ProductListItem } from "@/types/shop";

export async function getWishlistSkus(customerId: string): Promise<string[]> {
  const items = await db.wishlistItem.findMany({
    where: { customerId },
    select: { productSku: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((i) => i.productSku);
}

export async function getWishlist(
  customerId: string,
  locale: "en" | "ar" | "ru",
): Promise<ProductListItem[]> {
  void locale;

  const [items, loyaltyProgram] = await Promise.all([
    db.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      product: {
        select: {
          ...POINTS_BOOST_SELECT,
          id: true,
          sku: true,
          slugEn: true,
          nameEn: true,
          nameAr: true,
          nameRu: true,
          brandRef: { select: BRAND_LABEL_SELECT },
          price: true,
          compareAtPrice: true,
          stockQuantity: true,
          reservedQuantity: true,
          lowStockThreshold: true,
          requiresIdVerification: true,
          isNewArrival: true,
          publishStatus: true,
          deletedAt: true,
          category: { select: { slug: true, ...LIVE_CATEGORY_SELECT } },
          images: {
            where: { displayOrder: 1 },
            take: 1,
            select: {
              storageKey: true,
              altTextEn: true,
              altTextAr: true,
              altTextRu: true,
            },
          },
        },
      },
    },
    }),
    getSetting("loyalty_program"),
  ]);

  const boostNow = new Date();

  return items
    .filter(
      (i) =>
        i.product.publishStatus === "PUBLISHED" &&
        !i.product.deletedAt &&
        isLiveCategory(i.product.category),
    )
    .map((i) => {
      const p = i.product;
      const img = p.images[0] ?? null;
      return {
        id: p.id,
        sku: p.sku,
        slugEn: p.slugEn,
        categorySlug: p.category.slug,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        nameRu: p.nameRu,
        brand: toBrandLabel(p.brandRef),
        price: p.price.toNumber(),
        compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
        primaryImage: img
          ? {
              storageKey: img.storageKey,
              altEn: img.altTextEn,
              altAr: img.altTextAr,
              altRu: img.altTextRu,
            }
          : null,
        stockQuantity: p.stockQuantity,
        reservedQuantity: p.reservedQuantity,
        lowStockThreshold: p.lowStockThreshold,
        requiresIdVerification: p.requiresIdVerification,
        isNewArrival: p.isNewArrival,
        pointsBoost: toPointsBoost(p, loyaltyProgram.enabled, boostNow),
      };
    });
}
