import "../prisma/seed/load-env";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CONTENT_CONFIG_KEYS,
  serializeContent,
  type ContentBundle,
  type ContentConfigKey,
} from "../prisma/seed/content-format";

const CONTENT_FILE = join(process.cwd(), "prisma", "seed", "content", "content.json");
const CONTENT_ASSETS = join(process.cwd(), "prisma", "seed", "assets", "content");

function collectStrings(value: unknown, into: Set<string>) {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, into));
  else if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectStrings(item, into),
    );
  }
}

async function main() {
  const { db } = await import("../lib/db/client");
  const { downloadFile } = await import("../lib/services/storage");
  const { HOME_PHOTO_KEY_RE } = await import("../lib/settings/home-page");
  const { ABOUT_PHOTO_KEY_RE } = await import("../lib/settings/about-page");
  const { SITE_PHOTO_KEY_RE } = await import("../lib/settings/site-banners");
  const { HOME_VIDEO_KEY_RE, SITE_MEDIA_BUCKET } = await import(
    "../lib/settings/home-video"
  );
  const { POPUP_BANNER_ID } = await import("../lib/db/queries/banners");
  const { FEATURED_COLLECTION_KEY } = await import("../lib/utils/featured-collection");

  try {
    const configRows = await db.projectConfig.findMany({
      where: { key: { in: [...CONTENT_CONFIG_KEYS] } },
    });
    const projectConfig: ContentBundle["projectConfig"] = {};
    for (const key of CONTENT_CONFIG_KEYS) {
      const row = configRows.find((r) => r.key === key);
      if (row && row.value !== null) projectConfig[key as ContentConfigKey] = row.value;
    }

    const popup = await db.banner.findUnique({ where: { bannerId: POPUP_BANNER_ID } });
    const pages = await db.page.findMany({ orderBy: { key: "asc" } });
    const stores = await db.store.findMany({
      orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
    });
    const collection = await db.featuredCollection.findUnique({
      where: { key: FEATURED_COLLECTION_KEY },
      include: { items: { orderBy: { displayOrder: "asc" } } },
    });

    const bundle: ContentBundle = {
      projectConfig,
      popupBanner: popup
        ? {
            bannerId: popup.bannerId,
            pageKey: popup.pageKey,
            titleEn: popup.titleEn,
            titleAr: popup.titleAr,
            titleRu: popup.titleRu,
            subtitleEn: popup.subtitleEn,
            subtitleAr: popup.subtitleAr,
            subtitleRu: popup.subtitleRu,
            ctaEn: popup.ctaEn,
            ctaAr: popup.ctaAr,
            ctaRu: popup.ctaRu,
            linkUrl: popup.linkUrl,
            imageFilename: popup.imageFilename,
            storageKey: popup.storageKey,
            isActive: popup.isActive,
            displayOrder: popup.displayOrder,
            startsAt: popup.startsAt?.toISOString() ?? null,
            endsAt: popup.endsAt?.toISOString() ?? null,
          }
        : null,
      pages: pages.map((p) => ({
        key: p.key,
        slug: p.slug,
        titleEn: p.titleEn,
        titleAr: p.titleAr,
        titleRu: p.titleRu,
        contentEn: p.contentEn,
        contentAr: p.contentAr,
        contentRu: p.contentRu,
        metaTitleEn: p.metaTitleEn,
        metaTitleAr: p.metaTitleAr,
        metaTitleRu: p.metaTitleRu,
        metaDescriptionEn: p.metaDescriptionEn,
        metaDescriptionAr: p.metaDescriptionAr,
        metaDescriptionRu: p.metaDescriptionRu,
        isActive: p.isActive,
      })),
      stores: stores.map((s) => ({
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        nameRu: s.nameRu,
        addressEn: s.addressEn,
        addressAr: s.addressAr,
        addressRu: s.addressRu,
        descriptionEn: s.descriptionEn,
        descriptionAr: s.descriptionAr,
        descriptionRu: s.descriptionRu,
        hoursNoteEn: s.hoursNoteEn,
        hoursNoteAr: s.hoursNoteAr,
        hoursNoteRu: s.hoursNoteRu,
        latitude: s.latitude,
        longitude: s.longitude,
        phone: s.phone,
        email: s.email,
        openingHours: s.openingHours,
        isActive: s.isActive,
        isPrimary: s.isPrimary,
        displayOrder: s.displayOrder,
      })),
      featured: collection
        ? {
            key: collection.key,
            nameEn: collection.nameEn,
            nameAr: collection.nameAr,
            nameRu: collection.nameRu,
            isActive: collection.isActive,
            skus: collection.items.map((item) => item.productSku),
          }
        : null,
    };

    const strings = new Set<string>();
    collectStrings(projectConfig, strings);
    const objects = new Map<string, { bucket: string; key: string }>();
    for (const value of strings) {
      if (
        HOME_PHOTO_KEY_RE.test(value) ||
        ABOUT_PHOTO_KEY_RE.test(value) ||
        SITE_PHOTO_KEY_RE.test(value)
      ) {
        objects.set(`product-images/${value}`, { bucket: "product-images", key: value });
      } else if (HOME_VIDEO_KEY_RE.test(value)) {
        objects.set(`${SITE_MEDIA_BUCKET}/${value}`, { bucket: SITE_MEDIA_BUCKET, key: value });
      }
    }
    if (popup?.storageKey) {
      objects.set(`product-images/${popup.storageKey}`, {
        bucket: "product-images",
        key: popup.storageKey,
      });
    }

    const downloads: { path: string; bytes: Buffer }[] = [];
    for (const [path, { bucket, key }] of [...objects].sort(([a], [b]) => a.localeCompare(b))) {
      const blob = await downloadFile(bucket, key);
      downloads.push({ path, bytes: Buffer.from(await blob.arrayBuffer()) });
    }

    rmSync(CONTENT_ASSETS, { recursive: true, force: true });
    mkdirSync(CONTENT_ASSETS, { recursive: true });
    for (const { path, bytes } of downloads) {
      const target = join(CONTENT_ASSETS, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }

    mkdirSync(dirname(CONTENT_FILE), { recursive: true });
    writeFileSync(CONTENT_FILE, serializeContent(bundle));

    console.log("Content captured");
    console.log(`  projectConfig rows: ${Object.keys(projectConfig).join(", ") || "none"}`);
    console.log(`  popup banner:       ${bundle.popupBanner ? "yes" : "no"}`);
    console.log(`  pages:              ${bundle.pages.length}`);
    console.log(`  stores:             ${bundle.stores.length}`);
    console.log(`  featured:           ${bundle.featured ? `${bundle.featured.skus.length} SKUs` : "no"}`);
    console.log(`  files:              ${downloads.length}`);
    for (const { path, bytes } of downloads) console.log(`    ${path} (${bytes.length} bytes)`);
    console.log(`  wrote ${CONTENT_FILE}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Capture failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
