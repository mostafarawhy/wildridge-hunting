import type { PrismaClient } from "../../app/generated/prisma/client";
import {
  hashInt,
  logDone,
  logSection,
  uploadSeedAsset,
} from "./seed-utils";

const BUCKET = "product-images";

const POOLS = {
  rifle: 5,
  pistol: 3,
  optic: 3,
  ammo: 3,
  accessory: 4,
} as const;

type PoolName = keyof typeof POOLS;

const TOP_CATEGORY_POOL: Record<string, PoolName> = {
  "air-rifles": "rifle",
  "pcp-rifles": "rifle",
  "co2-pistols": "pistol",
  optics: "optic",
  "pellets-ammo": "ammo",
  accessories: "accessory",
};

const poolFile = (pool: PoolName, index: number) => `${pool}-${index}.png`;
const storageKeyOf = (file: string) => `seed/products/${file}`;

function pickFromPool(seed: string, pool: PoolName, max: number): string[] {
  const size = POOLS[pool];
  const hash = hashInt(seed);
  const count = Math.min(size, 1 + (hash % max));
  const start = hash % size;
  const step = 1 + (Math.floor(hash / size) % (size - 1 || 1));
  const picked: number[] = [];
  let cursor = start;
  while (picked.length < count) {
    if (!picked.includes(cursor)) picked.push(cursor);
    else cursor = (cursor + 1) % size;
    if (picked.length < count) cursor = (cursor + step) % size;
  }
  return picked.map((i) => poolFile(pool, i + 1));
}

export async function seedProductImages(db: PrismaClient) {
  logSection("Product images");

  const uploaded = new Set<string>();
  for (const [pool, size] of Object.entries(POOLS)) {
    for (let i = 1; i <= size; i++) {
      const file = poolFile(pool as PoolName, i);
      const ok = await uploadSeedAsset(
        BUCKET,
        storageKeyOf(file),
        `products/${file}`,
      );
      if (ok) uploaded.add(file);
    }
  }
  logDone("pool images uploaded", uploaded.size);

  const categories = await db.category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, parentId: true, nameEn: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const poolOfCategory = (categoryId: string): PoolName | null => {
    let current = byId.get(categoryId);
    while (current?.parentId) current = byId.get(current.parentId);
    return current ? (TOP_CATEGORY_POOL[current.slug] ?? null) : null;
  };

  const available = (files: string[]) => files.filter((f) => uploaded.has(f));

  let categoriesUpdated = 0;
  for (const category of categories) {
    const pool = poolOfCategory(category.id);
    if (!pool) continue;
    const [file] = available(pickFromPool(`category:${category.slug}`, pool, 1));
    if (!file) continue;
    await db.category.update({
      where: { id: category.id },
      data: { imageFilename: file, storageKey: storageKeyOf(file) },
    });
    categoriesUpdated++;
  }
  logDone("category images", categoriesUpdated);

  const products = await db.product.findMany({
    where: { deletedAt: null },
    select: { sku: true, nameEn: true, nameAr: true, categoryId: true },
  });
  let productImages = 0;
  for (const product of products) {
    const pool = poolOfCategory(product.categoryId);
    if (!pool) continue;
    const files = available(pickFromPool(product.sku, pool, 3));
    if (files.length === 0) continue;

    await db.productImage.deleteMany({ where: { productSku: product.sku } });
    for (const [index, file] of files.entries()) {
      await db.productImage.create({
        data: {
          productSku: product.sku,
          filename: file,
          storageKey: storageKeyOf(file),
          altTextEn: `${product.nameEn}${files.length > 1 ? ` — image ${index + 1}` : ""}`,
          altTextAr: product.nameAr,
          altTextRu: null,
          displayOrder: index + 1,
        },
      });
      productImages++;
    }
  }
  logDone("product images", productImages);

  const addons = await db.addon.findMany({
    where: { deletedAt: null },
    select: { addonId: true },
  });
  let addonImages = 0;
  for (const addon of addons) {
    const hash = hashInt(`addon:${addon.addonId}`);
    const pool: PoolName = hash % 2 === 0 ? "accessory" : "ammo";
    const [file] = available(pickFromPool(`addon:${addon.addonId}`, pool, 1));
    if (!file) continue;
    await db.addon.update({
      where: { addonId: addon.addonId },
      data: { imageFilename: file, storageKey: storageKeyOf(file) },
    });
    addonImages++;
  }
  logDone("add-on images", addonImages);
}
