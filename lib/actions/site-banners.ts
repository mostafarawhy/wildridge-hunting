"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { uploadFile, listFiles, deleteFiles } from "@/lib/services/storage";
import { sniffImageType } from "@/lib/utils/image-sniff";
import { getContentImageUrl } from "@/lib/utils/images";
import {
  MAX_MANUAL_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  mimeToExt,
} from "@/lib/validations/product";
import {
  SITE_BANNERS_DEFAULT,
  SITE_PHOTO_PREFIX,
  readSiteBanners,
  siteBannersSchema,
  sitePhotoKeys,
  type SiteBannersValue,
} from "@/lib/settings/site-banners";

const BUCKET = "product-images";
const KEY = "site_banners";

export type UploadSiteBannerPhotoResult =
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

export type SaveSiteBannersResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "PHOTO_MISSING"
        | "NO_CHANGES"
        | "INTERNAL_ERROR";
      fieldErrors?: Record<string, string[]>;
    };

export async function uploadSiteBannerPhotoAction(
  formData: unknown,
): Promise<UploadSiteBannerPhotoResult> {
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

  const key = `${SITE_PHOTO_PREFIX}${crypto.randomUUID()}.${mimeToExt[sniffed]}`;
  try {
    await uploadFile({
      bucket: BUCKET,
      path: key,
      file,
      contentType: sniffed,
    });
  } catch (err) {
    console.error("[uploadSiteBannerPhotoAction] upload failed", err);
    return {
      success: false,
      error: "Failed to upload image. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  return { success: true, key, url: getContentImageUrl(key) ?? "" };
}

function photoPath(value: SiteBannersValue, key: string): string {
  if (value.shopPhoto === key) return "shopPhoto";
  if (value.pagesHero === key) return "pagesHero";
  if (value.storesHero === key) return "storesHero";
  return "menuPhoto";
}

export async function saveSiteBannersAction(
  input: unknown,
): Promise<SaveSiteBannersResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = siteBannersSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors,
    };
  }
  const value = parsed.data;

  const keys = sitePhotoKeys(value);
  if (keys.length > 0) {
    let stored: Set<string>;
    try {
      const files = await listFiles(BUCKET, "site");
      stored = new Set(files.map((f) => f.name));
    } catch (err) {
      console.error("[saveSiteBannersAction] photo check failed", err);
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

  const outcome = {
    unchanged: false,
    current: SITE_BANNERS_DEFAULT as SiteBannersValue,
  };

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({
          where: { key: KEY },
        });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        const { value: current, legacy } = readSiteBanners(existing?.value);
        outcome.current = current;

        if (!legacy && JSON.stringify(current) === JSON.stringify(value)) {
          outcome.unchanged = true;
          return;
        }

        await tx.projectConfig.upsert({
          where: { key: KEY },
          create: { key: KEY, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.site_banners.update",
            entityType: "ProjectConfig",
            entityId: KEY,
            before,
            after: value,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    console.error("[saveSiteBannersAction]", err);
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
  const removed = sitePhotoKeys(outcome.current).filter(
    (key) => !kept.has(key) && key.startsWith(SITE_PHOTO_PREFIX),
  );
  if (removed.length > 0) {
    try {
      await deleteFiles(BUCKET, removed);
    } catch (err) {
      console.error("[saveSiteBannersAction] old photo cleanup failed", err);
    }
  }

  revalidatePath("/", "layout");

  return { success: true };
}
