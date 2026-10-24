import { db } from "@/lib/db/client";
import { getImageUrl } from "@/lib/utils/images";
import { BRAND_LABEL_SELECT, toBrandLabel } from "@/lib/utils/brand";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import {
  POINTS_BOOST_SELECT,
  STOREFRONT_WHERE,
  toPointsBoost,
} from "@/lib/db/queries/products";
import { getSetting } from "@/lib/db/queries/settings";
import { FEATURED_COLLECTION_KEY } from "@/lib/utils/featured-collection";
import type { Prisma, PublishStatus } from "@/app/generated/prisma/client";
import type {
  FeaturedProductItem,
  FeaturedCollectionResult,
  ProductImageItem,
} from "@/types/shop";

const FEATURED_IMAGE_SELECT = {
  storageKey: true,
  altTextEn: true,
  altTextAr: true,
  altTextRu: true,
} as const;

function toPrimaryImage(
  img:
    | {
        storageKey: string | null;
        altTextEn: string | null;
        altTextAr: string | null;
        altTextRu: string | null;
      }
    | undefined,
): ProductImageItem | null {
  return img
    ? {
        storageKey: img.storageKey,
        altEn: img.altTextEn,
        altAr: img.altTextAr,
        altRu: img.altTextRu,
      }
    : null;
}

export async function getFeaturedCollection(
  key: string,
): Promise<FeaturedCollectionResult | null> {
  const boostNow = new Date();
  const [loyaltyProgram, collection] = await Promise.all([
    getSetting("loyalty_program"),
    db.featuredCollection.findFirst({
      where: { key, isActive: true },
      select: {
        key: true,
        nameEn: true,
        nameAr: true,
        nameRu: true,
        items: {
          orderBy: { displayOrder: "asc" },
          select: {
            product: {
              select: {
                ...POINTS_BOOST_SELECT,
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
                category: {
                  select: { slug: true, ...LIVE_CATEGORY_SELECT },
                },
                images: {
                  orderBy: { displayOrder: "asc" },
                  take: 1,
                  select: FEATURED_IMAGE_SELECT,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!collection) return null;

  const items: FeaturedProductItem[] = collection.items
    .filter(
      (item) =>
        item.product.publishStatus === "PUBLISHED" &&
        item.product.deletedAt === null &&
        isLiveCategory(item.product.category),
    )
    .map((item) => {
      const imageUrl = getImageUrl(item.product.images[0]?.storageKey);

      return {
        sku: item.product.sku,
        slugEn: item.product.slugEn,
        categorySlug: item.product.category.slug,
        nameEn: item.product.nameEn,
        nameAr: item.product.nameAr,
        nameRu: item.product.nameRu,
        brand: toBrandLabel(item.product.brandRef),
        price: item.product.price.toNumber(),
        compareAtPrice: item.product.compareAtPrice?.toNumber() ?? null,
        imageUrl,
        primaryImage: toPrimaryImage(item.product.images[0]),
        stockQuantity: item.product.stockQuantity,
        reservedQuantity: item.product.reservedQuantity,
        lowStockThreshold: item.product.lowStockThreshold,
        requiresIdVerification: item.product.requiresIdVerification,
        isNewArrival: item.product.isNewArrival,
        pointsBoost: toPointsBoost(item.product, loyaltyProgram.enabled, boostNow),
      };
    });

  return {
    key: collection.key,
    nameEn: collection.nameEn,
    nameAr: collection.nameAr,
    nameRu: collection.nameRu,
    items,
  };
}

export interface FeaturedEditorItem extends FeaturedProductItem {
  live: boolean;
  publishStatus: PublishStatus;
}

export interface FeaturedEditorState {
  shown: boolean;
  heading: { en: string; ar: string; ru: string };
  items: FeaturedEditorItem[];
}

export interface FeaturedPickerItem extends FeaturedProductItem {
  categoryLabel: string;
  categoryId: string;
  parentCategoryId: string | null;
}

const FEATURED_PRODUCT_SELECT = {
  ...POINTS_BOOST_SELECT,
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
  categoryId: true,
  category: {
    select: {
      slug: true,
      nameEn: true,
      parentId: true,
      isVisible: true,
      deletedAt: true,
      parent: { select: { nameEn: true, isVisible: true, deletedAt: true } },
    },
  },
  images: {
    orderBy: { displayOrder: "asc" },
    take: 1,
    select: FEATURED_IMAGE_SELECT,
  },
} satisfies Prisma.ProductSelect;

type FeaturedProductRow = Prisma.ProductGetPayload<{
  select: typeof FEATURED_PRODUCT_SELECT;
}>;

function toFeaturedItem(
  p: FeaturedProductRow,
  loyaltyEnabled: boolean,
  boostNow: Date,
): FeaturedProductItem {
  return {
    sku: p.sku,
    slugEn: p.slugEn,
    categorySlug: p.category.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    nameRu: p.nameRu,
    brand: toBrandLabel(p.brandRef),
    price: p.price.toNumber(),
    compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
    imageUrl: getImageUrl(p.images[0]?.storageKey),
    primaryImage: toPrimaryImage(p.images[0]),
    stockQuantity: p.stockQuantity,
    reservedQuantity: p.reservedQuantity,
    lowStockThreshold: p.lowStockThreshold,
    requiresIdVerification: p.requiresIdVerification,
    isNewArrival: p.isNewArrival,
    pointsBoost: toPointsBoost(p, loyaltyEnabled, boostNow),
  };
}

export async function getFeaturedForEditor(): Promise<FeaturedEditorState> {
  const loyaltyProgram = await getSetting("loyalty_program");
  const boostNow = new Date();
  const row = await db.featuredCollection.findUnique({
    where: { key: FEATURED_COLLECTION_KEY },
    select: {
      isActive: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      items: {
        orderBy: { displayOrder: "asc" },
        select: { product: { select: FEATURED_PRODUCT_SELECT } },
      },
    },
  });

  if (!row) {
    return { shown: true, heading: { en: "", ar: "", ru: "" }, items: [] };
  }

  return {
    shown: row.isActive,
    heading: { en: row.nameEn, ar: row.nameAr, ru: row.nameRu ?? "" },
    items: row.items.map(({ product }) => ({
      ...toFeaturedItem(product, loyaltyProgram.enabled, boostNow),
      live:
        product.publishStatus === "PUBLISHED" &&
        product.deletedAt === null &&
        isLiveCategory(product.category),
      publishStatus: product.publishStatus,
    })),
  };
}

export async function getFeaturedPickerItems(): Promise<FeaturedPickerItem[]> {
  const loyaltyProgram = await getSetting("loyalty_program");
  const boostNow = new Date();
  const rows = await db.product.findMany({
    where: STOREFRONT_WHERE,
    orderBy: { nameEn: "asc" },
    select: FEATURED_PRODUCT_SELECT,
  });

  return rows.map((p) => ({
    ...toFeaturedItem(p, loyaltyProgram.enabled, boostNow),
    categoryLabel: p.category.parent
      ? `${p.category.parent.nameEn} › ${p.category.nameEn}`
      : p.category.nameEn,
    categoryId: p.categoryId,
    parentCategoryId: p.category.parentId,
  }));
}
