"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  uploadFile,
  listFiles,
  deleteFiles,
  createSignedUploadUrl,
  readPublicObjectHead,
} from "@/lib/services/storage";
import { isMp4Head } from "@/lib/utils/video-sniff";
import { sniffImageType } from "@/lib/utils/image-sniff";
import { getContentImageUrl } from "@/lib/utils/images";
import { STOREFRONT_WHERE } from "@/lib/db/queries/products";
import {
  FEATURED_COLLECTION_KEY,
  FEATURED_LIMITS,
} from "@/lib/utils/featured-collection";
import {
  MAX_MANUAL_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  mimeToExt,
} from "@/lib/validations/product";
import {
  HOME_PHOTO_PREFIX,
  englishGaps,
  homeBuiltIn,
  homePageSchema,
  homePhotoKeys,
  homeVideoKeys,
  readHomePage,
  type HomePageValue,
} from "@/lib/settings/home-page";
import {
  HOME_VIDEO_MAX_BYTES,
  HOME_VIDEO_PREFIX,
  HOME_VIDEO_TYPE,
  SITE_MEDIA_BUCKET,
} from "@/lib/settings/home-video";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

const BUCKET = "product-images";
const KEY = "home_page";

export type UploadHomePhotoResult =
  | { success: true; key: string; url: string }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "IMAGE_TOO_LARGE"
        | "INVALID_IMAGE"
        | "STORAGE_ERROR";
    };

export type SaveHomePageResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "ENGLISH_REQUIRED"
        | "PHOTO_MISSING"
        | "VIDEO_NEEDS_PHOTO"
        | "VIDEO_INVALID"
        | "NO_CHANGES"
        | "FEATURED_TOO_FEW"
        | "PRODUCT_NOT_LIVE"
        | "INTERNAL_ERROR";
      fieldErrors?: Record<string, string[]>;
    };

export async function uploadHomePhotoAction(
  formData: unknown,
): Promise<UploadHomePhotoResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  await requireStaffAction("content:manage");

  if (!(formData instanceof FormData)) {
    return {
      success: false,
      error: "Invalid request.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const rawFile = formData.get("image");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  if (!file) {
    return {
      success: false,
      error: "Add an image.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  if (file.size > MAX_MANUAL_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      error: `File "${file.name}" exceeds the 4 MB size limit.`,
      errorCode: "IMAGE_TOO_LARGE",
    };
  }

  const sniffed = sniffImageType(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  if (
    !sniffed ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      sniffed as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    return {
      success: false,
      error: `File "${file.name}" isn't a JPEG, PNG or WebP image.`,
      errorCode: "INVALID_IMAGE",
    };
  }

  const key = `${HOME_PHOTO_PREFIX}${crypto.randomUUID()}.${mimeToExt[sniffed]}`;
  try {
    await uploadFile({
      bucket: BUCKET,
      path: key,
      file,
      contentType: sniffed,
    });
  } catch (err) {
    console.error("[uploadHomePhotoAction] upload failed", err);
    return {
      success: false,
      error: "Failed to upload image. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  return { success: true, key, url: getContentImageUrl(key) ?? "" };
}

export type PrepareHomeVideoUploadResult =
  | { success: true; data: { key: string; signedUrl: string } }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "INVALID_FILE_TYPE"
        | "FILE_TOO_LARGE"
        | "STORAGE_ERROR";
    };

const prepareVideoUploadSchema = z.object({
  type: z.string(),
  size: z.number().int(),
});

export async function prepareHomeVideoUploadAction(
  input: unknown,
): Promise<PrepareHomeVideoUploadResult> {
  const demoRefusal = await demoGate("content:manage", "upload");
  if (demoRefusal) return demoRefusal;

  await requireStaffAction("content:manage");

  const parsed = prepareVideoUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid request.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  if (parsed.data.type !== HOME_VIDEO_TYPE) {
    return {
      success: false,
      error: "Upload an MP4 video.",
      errorCode: "INVALID_FILE_TYPE",
    };
  }

  if (parsed.data.size <= 0 || parsed.data.size > HOME_VIDEO_MAX_BYTES) {
    return {
      success: false,
      error: "Videos can be up to 20 MB.",
      errorCode: "FILE_TOO_LARGE",
    };
  }

  const key = `${HOME_VIDEO_PREFIX}${crypto.randomUUID()}.mp4`;
  try {
    const { signedUrl } = await createSignedUploadUrl(SITE_MEDIA_BUCKET, key);
    return { success: true, data: { key, signedUrl } };
  } catch (err) {
    console.error("[prepareHomeVideoUploadAction]", err);
    return {
      success: false,
      error: "Could not prepare the video upload. Try again.",
      errorCode: "STORAGE_ERROR",
    };
  }
}

function videoPath(value: HomePageValue, key: string): string {
  return value.desert.video === key ? "desert.video" : "story.video";
}

function photoPath(value: HomePageValue, key: string): string {
  if (value.hero.photo === key) return "hero.photo";
  if (value.desert.photo === key) return "desert.photo";
  if (value.newsletter.photo === key) return "newsletter.photo";
  if (value.showcase.photo === key) return "showcase.photo";
  if (value.story.photo === key) return "story.photo";
  const index = value.tiles.findIndex((tile) => tile.photo === key);
  return `tiles.${index}.photo`;
}

const VIDEO_NEEDS_PHOTO_MESSAGE =
  "Add a photo to show while the video loads, or remove the video.";
const VIDEO_INVALID_MESSAGE = "This video could not be checked. Upload it again.";

const featuredHeading = z
  .string()
  .trim()
  .max(
    FEATURED_LIMITS.heading,
    `Keep the heading to ${FEATURED_LIMITS.heading} characters or fewer.`,
  );

const saveInputSchema = z.object({
  page: homePageSchema,
  featured: z.object({
    shown: z.boolean(),
    heading: z.object({
      en: featuredHeading,
      ar: featuredHeading,
      ru: featuredHeading,
    }),
    skus: z
      .array(z.string().min(1))
      .max(
        FEATURED_LIMITS.max,
        `Pick ${FEATURED_LIMITS.max} products at most.`,
      )
      .refine(
        (skus) => new Set(skus).size === skus.length,
        "Each product can be picked once.",
      ),
  }),
});

type FeaturedState = {
  shown: boolean;
  heading: { en: string; ar: string; ru: string };
  skus: string[];
};

class ProductsNotLiveError extends Error {
  constructor(readonly names: string[]) {
    super("Featured products are not live.");
  }
}

export async function saveHomePageAction(
  input: unknown,
): Promise<SaveHomePageResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = saveInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path =
        issue.path[0] === "page"
          ? issue.path.slice(1).join(".")
          : issue.path[0] === "featured" && issue.path[1] === "skus"
            ? "featured.products"
            : issue.path.join(".");
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors,
    };
  }
  const value = parsed.data.page;
  const featured: FeaturedState = parsed.data.featured;

  const gaps = englishGaps(value);
  if (!featured.heading.en) {
    gaps["featured.heading.en"] = ["Add the English heading."];
  }
  if (Object.keys(gaps).length > 0) {
    return {
      success: false,
      error: "Fill the English text of every section.",
      errorCode: "ENGLISH_REQUIRED",
      fieldErrors: gaps,
    };
  }

  if (featured.shown && featured.skus.length < FEATURED_LIMITS.min) {
    return {
      success: false,
      error: "Pick at least 4 products to show this section, or hide it.",
      errorCode: "FEATURED_TOO_FEW",
      fieldErrors: {
        "featured.products": [
          "Pick at least 4 products to show this section, or hide it.",
        ],
      },
    };
  }

  const orphaned: Record<string, string[]> = {};
  if (value.desert.video && !value.desert.photo) {
    orphaned["desert.video"] = [VIDEO_NEEDS_PHOTO_MESSAGE];
  }
  if (value.story.video && !value.story.photo) {
    orphaned["story.video"] = [VIDEO_NEEDS_PHOTO_MESSAGE];
  }
  if (Object.keys(orphaned).length > 0) {
    return {
      success: false,
      error: VIDEO_NEEDS_PHOTO_MESSAGE,
      errorCode: "VIDEO_NEEDS_PHOTO",
      fieldErrors: orphaned,
    };
  }

  const keys = homePhotoKeys(value);
  if (keys.length > 0) {
    let stored: Set<string>;
    try {
      const files = await listFiles(BUCKET, "home");
      stored = new Set(files.map((f) => f.name));
    } catch (err) {
      console.error("[saveHomePageAction] photo check failed", err);
      return {
        success: false,
        error: "An unexpected error occurred.",
        errorCode: "INTERNAL_ERROR",
      };
    }
    const missing: Record<string, string[]> = {};
    for (const key of keys) {
      if (!stored.has(key)) {
        missing[photoPath(value, key)] = [
          "This photo is no longer available. Remove it and upload it again.",
        ];
      }
    }
    if (Object.keys(missing).length > 0) {
      return {
        success: false,
        error: "This photo is no longer available. Remove it and upload it again.",
        errorCode: "PHOTO_MISSING",
        fieldErrors: missing,
      };
    }
  }

  const videoKeys = homeVideoKeys(value);
  if (videoKeys.length > 0) {
    const invalid: Record<string, string[]> = {};
    try {
      const files = await listFiles(SITE_MEDIA_BUCKET, "home");
      const storedVideos = new Map(files.map((f) => [f.name, f]));
      for (const key of videoKeys) {
        const file = storedVideos.get(key);
        const ok =
          file !== undefined &&
          file.size !== null &&
          file.size > 0 &&
          file.size <= HOME_VIDEO_MAX_BYTES &&
          file.mimetype === HOME_VIDEO_TYPE &&
          isMp4Head(await readPublicObjectHead(SITE_MEDIA_BUCKET, key, 12));
        if (!ok) invalid[videoPath(value, key)] = [VIDEO_INVALID_MESSAGE];
      }
    } catch (err) {
      console.error("[saveHomePageAction] video check failed", err);
      return {
        success: false,
        error: "An unexpected error occurred.",
        errorCode: "INTERNAL_ERROR",
      };
    }
    if (Object.keys(invalid).length > 0) {
      return {
        success: false,
        error: VIDEO_INVALID_MESSAGE,
        errorCode: "VIDEO_INVALID",
        fieldErrors: invalid,
      };
    }
  }

  const builtIn = homeBuiltIn({ en, ar, ru });
  const outcome = {
    unchanged: false,
    pageChanged: false,
    current: builtIn as HomePageValue,
  };

  try {
    await db.$transaction(
      async (tx) => {
        if (featured.skus.length > 0) {
          const live = await tx.product.findMany({
            where: { sku: { in: featured.skus }, ...STOREFRONT_WHERE },
            select: { sku: true },
          });
          const liveSkus = new Set(live.map((p) => p.sku));
          const missing = featured.skus.filter((sku) => !liveSkus.has(sku));
          if (missing.length > 0) {
            const named = await tx.product.findMany({
              where: { sku: { in: missing } },
              select: { sku: true, nameEn: true },
            });
            const nameBySku = new Map(named.map((p) => [p.sku, p.nameEn]));
            throw new ProductsNotLiveError(
              missing.map((sku) => nameBySku.get(sku) ?? sku),
            );
          }
        }

        const existing = await tx.projectConfig.findUnique({
          where: { key: KEY },
        });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        const { value: current, legacy } = readHomePage(existing?.value, builtIn);
        outcome.current = current;

        const collection = await tx.featuredCollection.findUnique({
          where: { key: FEATURED_COLLECTION_KEY },
          select: {
            id: true,
            isActive: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            items: {
              orderBy: { displayOrder: "asc" },
              select: { productSku: true },
            },
          },
        });
        const featuredBefore: FeaturedState = {
          shown: collection?.isActive ?? true,
          heading: {
            en: collection?.nameEn ?? "",
            ar: collection?.nameAr ?? "",
            ru: collection?.nameRu ?? "",
          },
          skus: collection?.items.map((item) => item.productSku) ?? [],
        };

        const pageChanged =
          legacy || JSON.stringify(current) !== JSON.stringify(value);
        const skusChanged =
          featuredBefore.skus.join("\n") !== featured.skus.join("\n");
        const featuredChanged =
          featuredBefore.shown !== featured.shown ||
          featuredBefore.heading.en !== featured.heading.en ||
          featuredBefore.heading.ar !== featured.heading.ar ||
          featuredBefore.heading.ru !== featured.heading.ru ||
          skusChanged;

        if (!pageChanged && !featuredChanged) {
          outcome.unchanged = true;
          return;
        }
        outcome.pageChanged = pageChanged;

        if (pageChanged) {
          await tx.projectConfig.upsert({
            where: { key: KEY },
            create: { key: KEY, value },
            update: { value },
          });
        }

        if (featuredChanged) {
          const saved = await tx.featuredCollection.upsert({
            where: { key: FEATURED_COLLECTION_KEY },
            create: {
              key: FEATURED_COLLECTION_KEY,
              nameEn: featured.heading.en,
              nameAr: featured.heading.ar,
              nameRu: featured.heading.ru || null,
              isActive: featured.shown,
              displayOrder: 0,
            },
            update: {
              nameEn: featured.heading.en,
              nameAr: featured.heading.ar,
              nameRu: featured.heading.ru || null,
              isActive: featured.shown,
            },
            select: { id: true },
          });
          if (skusChanged) {
            await tx.featuredCollectionItem.deleteMany({
              where: { collectionId: saved.id },
            });
            if (featured.skus.length > 0) {
              await tx.featuredCollectionItem.createMany({
                data: featured.skus.map((sku, index) => ({
                  collectionId: saved.id,
                  productSku: sku,
                  displayOrder: index + 1,
                })),
              });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.home_page.update",
            entityType: "ProjectConfig",
            entityId: KEY,
            ...(pageChanged ? { before, after: value } : {}),
            ...(featuredChanged
              ? { metadata: { featured: { before: featuredBefore, after: featured } } }
              : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof ProductsNotLiveError) {
      const message = `These products are no longer on the shop: ${err.names.join(", ")}. Remove them and save again.`;
      return {
        success: false,
        error: message,
        errorCode: "PRODUCT_NOT_LIVE",
        fieldErrors: { "featured.products": [message] },
      };
    }
    console.error("[saveHomePageAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  if (outcome.unchanged) {
    return {
      success: false,
      error: "Nothing has changed since the last save.",
      errorCode: "NO_CHANGES",
    };
  }

  const kept = new Set(keys);
  const removed = outcome.pageChanged
    ? homePhotoKeys(outcome.current).filter(
        (key) => !kept.has(key) && key.startsWith(HOME_PHOTO_PREFIX),
      )
    : [];
  if (removed.length > 0) {
    try {
      await deleteFiles(BUCKET, removed);
    } catch (err) {
      console.error("[saveHomePageAction] old photo cleanup failed", err);
    }
  }

  const keptVideos = new Set(videoKeys);
  const removedVideos = outcome.pageChanged
    ? homeVideoKeys(outcome.current).filter(
        (key) => !keptVideos.has(key) && key.startsWith(HOME_VIDEO_PREFIX),
      )
    : [];
  if (removedVideos.length > 0) {
    try {
      await deleteFiles(SITE_MEDIA_BUCKET, removedVideos);
    } catch (err) {
      console.error("[saveHomePageAction] old video cleanup failed", err);
    }
  }

  revalidatePath("/", "layout");

  return { success: true };
}
