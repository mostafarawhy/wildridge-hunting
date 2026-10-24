import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Prisma, type PrismaClient } from "../../app/generated/prisma/client";
import { isPageKey } from "../../lib/utils/page-keys";
import { logDone, logSection, uploadSeedAsset } from "./seed-utils";
import {
  CONTENT_CONFIG_KEYS,
  type ContentBundle,
  type ContentConfigKey,
} from "./content-format";

const CONTENT_FILE = join(process.cwd(), "prisma", "seed", "content", "content.json");
const CONTENT_ASSETS = join(process.cwd(), "prisma", "seed", "assets", "content");

function walk(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const absolute = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(absolute).isDirectory()) found.push(...walk(absolute, relative));
    else found.push(relative);
  }
  return found;
}

async function validateConfig(key: ContentConfigKey, value: unknown): Promise<unknown> {
  const parsed = await (async () => {
    switch (key) {
      case "home_page": {
        const { homePageStoredSchema } = await import("../../lib/settings/home-page");
        return homePageStoredSchema.safeParse(value);
      }
      case "about_page": {
        const { aboutPageSchema } = await import("../../lib/settings/about-page");
        return aboutPageSchema.safeParse(value);
      }
      case "site_banners": {
        const { siteBannersSchema } = await import("../../lib/settings/site-banners");
        return siteBannersSchema.safeParse(value);
      }
      case "home_popup_style": {
        const { homePopupStyleSchema } = await import("../../lib/utils/home-popup");
        return homePopupStyleSchema.safeParse(value);
      }
      case "store_profile": {
        const { SETTING_KEYS } = await import("../../lib/settings/keys");
        return SETTING_KEYS.store_profile.safeParse(value);
      }
    }
  })();
  if (!parsed.success) {
    throw new Error(
      `content.json projectConfig.${key} is invalid: ${JSON.stringify(parsed.error.issues)}`,
    );
  }
  return parsed.data;
}

export async function seedContent(db: PrismaClient) {
  logSection("Content");

  if (!existsSync(CONTENT_FILE)) {
    console.log("   No prisma/seed/content/content.json, skipped");
    return;
  }

  const bundle = JSON.parse(readFileSync(CONTENT_FILE, "utf8")) as ContentBundle;
  const config = bundle.projectConfig ?? {};
  const pages = bundle.pages ?? [];
  const stores = bundle.stores ?? [];

  const validated: [ContentConfigKey, unknown][] = [];
  for (const key of CONTENT_CONFIG_KEYS) {
    if (config[key] === undefined || config[key] === null) continue;
    validated.push([key, await validateConfig(key, config[key])]);
  }
  for (const page of pages) {
    if (!isPageKey(page.key)) throw new Error(`content.json page key "${page.key}" is not a known page`);
  }

  let uploaded = 0;
  if (existsSync(CONTENT_ASSETS)) {
    for (const relative of walk(CONTENT_ASSETS)) {
      const slash = relative.indexOf("/");
      if (slash === -1) throw new Error(`Asset ${relative} must sit in a bucket folder`);
      const bucket = relative.slice(0, slash);
      const key = relative.slice(slash + 1);
      if (await uploadSeedAsset(bucket, key, `content/${relative}`)) uploaded++;
    }
  }
  logDone("content files uploaded", uploaded);

  for (const [key, value] of validated) {
    await db.projectConfig.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
  logDone("project config rows", validated.length);

  if (bundle.popupBanner) {
    const { startsAt, endsAt, ...popup } = bundle.popupBanner;
    const data = {
      ...popup,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
    };
    await db.banner.upsert({
      where: { bannerId: popup.bannerId },
      update: data,
      create: data,
    });
    logDone("popup banner", 1);
  }

  for (const page of pages) {
    await db.page.upsert({
      where: { key: page.key },
      update: page,
      create: page,
    });
  }
  logDone("pages", pages.length);

  await db.$transaction([
    db.store.deleteMany(),
    ...stores.map((store) =>
      db.store.create({
        data: {
          ...store,
          openingHours:
            store.openingHours === null || store.openingHours === undefined
              ? Prisma.JsonNull
              : (store.openingHours as Prisma.InputJsonValue),
        },
      }),
    ),
  ]);
  logDone("stores", stores.length);

  if (bundle.featured) {
    const { skus, ...fields } = bundle.featured;
    const known = await db.product.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    const knownSkus = new Set(known.map((p) => p.sku));
    const missing = skus.filter((sku) => !knownSkus.has(sku));
    if (missing.length > 0) {
      throw new Error(`content.json featured SKUs not in the catalog: ${missing.join(", ")}`);
    }
    const collection = await db.featuredCollection.upsert({
      where: { key: fields.key },
      update: fields,
      create: { ...fields, displayOrder: 0 },
      select: { id: true },
    });
    await db.featuredCollectionItem.deleteMany({ where: { collectionId: collection.id } });
    if (skus.length > 0) {
      await db.featuredCollectionItem.createMany({
        data: skus.map((sku, index) => ({
          collectionId: collection.id,
          productSku: sku,
          displayOrder: index + 1,
        })),
      });
    }
    logDone("featured items", skus.length);
  }
}
