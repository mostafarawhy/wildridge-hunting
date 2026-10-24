"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { sniffImageType } from "@/lib/utils/image-sniff";
import {
  dubaiDayEndIso,
  dubaiDayFromIso,
  dubaiDayStartIso,
} from "@/lib/utils/coupon-display";
import {
  MAX_MANUAL_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  mimeToExt,
} from "@/lib/validations/product";
import { HomePopupSchema } from "@/lib/validations/banner";
import {
  HOME_POPUP_STYLE_KEY,
  POPUP_BANNER_ID,
  getHomePopupStyle,
} from "@/lib/db/queries/banners";
import {
  parseHomePopupStyle,
  type HomePopupStyle,
} from "@/lib/utils/home-popup";

const BUCKET = "product-images";
const KEY_PREFIX = `banners/${POPUP_BANNER_ID}/`;

const SCALAR_FIELDS = [
  "titleEn",
  "titleAr",
  "titleRu",
  "subtitleEn",
  "subtitleAr",
  "subtitleRu",
  "ctaEn",
  "ctaAr",
  "ctaRu",
  "linkUrl",
  "isActive",
  "startsOn",
  "endsOn",
  "theme",
  "buttonColor",
  "purpose",
] as const;

export type SaveHomePopupResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "INVALID_IMAGE"
        | "IMAGE_TOO_LARGE"
        | "STORAGE_ERROR"
        | "NO_CHANGES"
        | "INTERNAL_ERROR";
      fieldErrors?: Record<string, string[]>;
    };

function blankToNull(value: string): string | null {
  return value === "" ? null : value;
}

function resolveInstant(
  day: string,
  stored: Date | null,
  edge: "start" | "end",
): Date | null {
  if (!day) return null;
  if (stored && day === dubaiDayFromIso(stored.toISOString())) return stored;
  return new Date(edge === "start" ? dubaiDayStartIso(day) : dubaiDayEndIso(day));
}

type PopupRow = {
  bannerId: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  linkUrl: string | null;
  storageKey: string | null;
  titleEn: string;
  titleAr: string;
  titleRu: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  subtitleRu: string | null;
  ctaEn: string | null;
  ctaAr: string | null;
  ctaRu: string | null;
};

function auditFields(row: PopupRow) {
  return {
    bannerId: row.bannerId,
    isActive: row.isActive,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    linkUrl: row.linkUrl,
    storageKey: row.storageKey,
    titleEn: row.titleEn,
    titleAr: row.titleAr,
    titleRu: row.titleRu,
    subtitleEn: row.subtitleEn,
    subtitleAr: row.subtitleAr,
    subtitleRu: row.subtitleRu,
    ctaEn: row.ctaEn,
    ctaAr: row.ctaAr,
    ctaRu: row.ctaRu,
  };
}

export async function saveHomePopupAction(
  formData: unknown,
): Promise<SaveHomePopupResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const staff = await requireStaffAction("content:manage");

  if (!(formData instanceof FormData)) {
    return {
      success: false,
      error: "Invalid request.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const raw: Record<string, string> = {};
  for (const field of SCALAR_FIELDS) {
    const value = formData.get(field);
    raw[field] = typeof value === "string" ? value : "";
  }

  const parsed = HomePopupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const data = parsed.data;
  const isActive = data.isActive === "true";

  const rawFile = formData.get("image");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

  let sniffed: string | null = null;
  if (file) {
    if (file.size > MAX_MANUAL_IMAGE_SIZE_BYTES) {
      return {
        success: false,
        error: `File "${file.name}" exceeds the 4 MB size limit.`,
        errorCode: "IMAGE_TOO_LARGE",
      };
    }
    sniffed = sniffImageType(
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
  }

  const existing = await db.banner.findUnique({
    where: { bannerId: POPUP_BANNER_ID },
  });
  const nextStyle: HomePopupStyle = {
    theme: data.theme,
    buttonColor: data.buttonColor,
    purpose: data.purpose,
  };
  const fieldErrors: Record<string, string[]> = {};
  if (!data.titleEn) {
    fieldErrors.titleEn = ["Add an English heading."];
  }
  if (!data.ctaEn) {
    fieldErrors.ctaEn = ["Add English button text."];
  }
  if (!file && !existing?.storageKey) {
    fieldErrors.image = ["Add an image."];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors,
    };
  }

  if (!file && existing) {
    const existingStyle = await getHomePopupStyle();
    const nextStartsAt = resolveInstant(data.startsOn, existing.startsAt, "start");
    const nextEndsAt = resolveInstant(data.endsOn, existing.endsAt, "end");
    const unchanged =
      existing.titleEn === data.titleEn &&
      existing.titleAr === data.titleAr &&
      existing.titleRu === blankToNull(data.titleRu) &&
      existing.subtitleEn === blankToNull(data.subtitleEn) &&
      existing.subtitleAr === blankToNull(data.subtitleAr) &&
      existing.subtitleRu === blankToNull(data.subtitleRu) &&
      existing.ctaEn === blankToNull(data.ctaEn) &&
      existing.ctaAr === blankToNull(data.ctaAr) &&
      existing.ctaRu === blankToNull(data.ctaRu) &&
      existing.linkUrl === blankToNull(data.linkUrl) &&
      existing.isActive === isActive &&
      existingStyle.theme === nextStyle.theme &&
      existingStyle.buttonColor === nextStyle.buttonColor &&
      existingStyle.purpose === nextStyle.purpose &&
      (existing.startsAt?.getTime() ?? null) === (nextStartsAt?.getTime() ?? null) &&
      (existing.endsAt?.getTime() ?? null) === (nextEndsAt?.getTime() ?? null);
    if (unchanged) {
      return {
        success: false,
        error: "Nothing has changed since the last save.",
        errorCode: "NO_CHANGES",
      };
    }
  }

  let newKey: string | null = null;
  if (file && sniffed) {
    const ext = mimeToExt[sniffed] ?? "bin";
    newKey = `${KEY_PREFIX}${crypto.randomUUID()}.${ext}`;
    try {
      await uploadFile({
        bucket: BUCKET,
        path: newKey,
        file,
        contentType: sniffed,
      });
    } catch (err) {
      console.error("[saveHomePopupAction] upload failed", err);
      return {
        success: false,
        error: "Failed to upload image. Please try again.",
        errorCode: "STORAGE_ERROR",
      };
    }
  }

  const prior = { key: null as string | null };

  try {
    await db.$transaction(
      async (tx) => {
        const current = await tx.banner.findUnique({
          where: { bannerId: POPUP_BANNER_ID },
        });

        const startsAt = resolveInstant(
          data.startsOn,
          current?.startsAt ?? null,
          "start",
        );
        const endsAt = resolveInstant(
          data.endsOn,
          current?.endsAt ?? null,
          "end",
        );

        const fields = {
          titleEn: data.titleEn,
          titleAr: data.titleAr,
          titleRu: blankToNull(data.titleRu),
          subtitleEn: blankToNull(data.subtitleEn),
          subtitleAr: blankToNull(data.subtitleAr),
          subtitleRu: blankToNull(data.subtitleRu),
          ctaEn: blankToNull(data.ctaEn),
          ctaAr: blankToNull(data.ctaAr),
          ctaRu: blankToNull(data.ctaRu),
          linkUrl: blankToNull(data.linkUrl),
          isActive,
          startsAt,
          endsAt,
        };
        const currentStyleRow = await tx.projectConfig.findUnique({
          where: { key: HOME_POPUP_STYLE_KEY },
          select: { value: true },
        });
        const currentStyle = parseHomePopupStyle(currentStyleRow?.value);
        const imageFields = newKey
          ? { storageKey: newKey, imageFilename: file?.name ?? null }
          : {};

        const row = await tx.banner.upsert({
          where: { bannerId: POPUP_BANNER_ID },
          create: {
            bannerId: POPUP_BANNER_ID,
            pageKey: "popup",
            displayOrder: 0,
            ...fields,
            ...imageFields,
          },
          update: { ...fields, ...imageFields },
        });

        await tx.projectConfig.upsert({
          where: { key: HOME_POPUP_STYLE_KEY },
          create: { key: HOME_POPUP_STYLE_KEY, value: nextStyle },
          update: { value: nextStyle },
        });

        prior.key = current?.storageKey ?? null;

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staff.id,
            action: "banner.update",
            entityType: "Banner",
            entityId: row.id,
            before: current
              ? { ...auditFields(current), style: currentStyle }
              : Prisma.DbNull,
            after: { ...auditFields(row), style: nextStyle },
            metadata: { bannerId: POPUP_BANNER_ID },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (newKey) {
      try {
        await deleteFile(BUCKET, newKey);
      } catch {
        // best-effort
      }
    }
    console.error("[saveHomePopupAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  const previousKey = prior.key;
  if (
    newKey &&
    previousKey &&
    previousKey !== newKey &&
    previousKey.startsWith(KEY_PREFIX)
  ) {
    try {
      await deleteFile(BUCKET, previousKey);
    } catch (err) {
      console.error("[saveHomePopupAction] old image cleanup failed", err);
    }
  }

  revalidatePath("/", "layout");

  return { success: true };
}
