import type { PrismaClient } from "../../app/generated/prisma/client";

const HOMEPAGE_FEATURED_ITEMS = [
  {
    sku: "HLV-34-45",
    displayOrder: 1,
  },
  {
    sku: "HLV-48-55",
    displayOrder: 2,
  },
  {
    sku: "HLV-54-45",
    displayOrder: 3,
  },
  {
    sku: "BRF-GLE95-45",
    displayOrder: 4,
  },
  {
    sku: "BRF-GLE125-55",
    displayOrder: 5,
  },
  {
    sku: "HLV-RNG-45",
    displayOrder: 6,
  },
  {
    sku: "HLV-KST50-45",
    displayOrder: 7,
  },
  {
    sku: "HLV-KST80-55",
    displayOrder: 8,
  },
];

export async function seedFeaturedCollections(db: PrismaClient) {
  console.log("🌟 Seeding featured collections...");

  const collection = await db.featuredCollection.upsert({
    where: { key: "homepage-featured" },
    update: {},
    create: {
      key: "homepage-featured",
      nameEn: "Field Tested. New Arrivals.",
      nameAr: "اختُبر ميدانياً. وصل حديثاً.",
      nameRu: "Проверено в полевых условиях. Новинки.",
      isActive: true,
      displayOrder: 0,
    },
  });

  for (const item of HOMEPAGE_FEATURED_ITEMS) {
    await db.featuredCollectionItem.upsert({
      where: {
        collectionId_productSku: {
          collectionId: collection.id,
          productSku: item.sku,
        },
      },
      update: {
        displayOrder: item.displayOrder,
      },
      create: {
        collectionId: collection.id,
        productSku: item.sku,
        displayOrder: item.displayOrder,
      },
    });
  }

  console.log(
    `✅ Featured collection seeded with ${HOMEPAGE_FEATURED_ITEMS.length} items`,
  );
}
