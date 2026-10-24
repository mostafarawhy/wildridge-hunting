"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { isPageKey } from "@/lib/utils/page-keys";

type StorePageActionResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: string;
      fieldErrors?: Record<string, string[]>;
    };

class StorePageActionAbort extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const SaveStorePageSchema = z.object({
  key: z.string().refine(isPageKey, "Unknown page."),
  locale: z.enum(["en", "ar", "ru"]),
  title: z.string().trim().max(120),
  content: z.string().trim().max(50000),
  metaTitle: z.string().trim().max(60),
  metaDescription: z.string().trim().max(160),
});

const TITLE_FIELD = { en: "titleEn", ar: "titleAr", ru: "titleRu" } as const;
const CONTENT_FIELD = { en: "contentEn", ar: "contentAr", ru: "contentRu" } as const;
const META_TITLE_FIELD = {
  en: "metaTitleEn",
  ar: "metaTitleAr",
  ru: "metaTitleRu",
} as const;
const META_DESCRIPTION_FIELD = {
  en: "metaDescriptionEn",
  ar: "metaDescriptionAr",
  ru: "metaDescriptionRu",
} as const;

export async function saveStorePageAction(input: {
  key: string;
  locale: string;
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}): Promise<StorePageActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = SaveStorePageSchema.safeParse(input);
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

  const { key, locale, title, content, metaTitle, metaDescription } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.page.findUnique({ where: { key } });

        if (existing?.isActive && locale === "en" && (title === "" || content === "")) {
          throw new StorePageActionAbort(
            "ENGLISH_REQUIRED",
            "Unpublish the page before removing its English title or content.",
          );
        }

        const before = existing
          ? ({
              title: existing[TITLE_FIELD[locale]],
              content: existing[CONTENT_FIELD[locale]],
              metaTitle: existing[META_TITLE_FIELD[locale]],
              metaDescription: existing[META_DESCRIPTION_FIELD[locale]],
            } as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;

        const localeData = {
          [TITLE_FIELD[locale]]: locale === "ru" ? title || null : title,
          [CONTENT_FIELD[locale]]: content || null,
          [META_TITLE_FIELD[locale]]: metaTitle || null,
          [META_DESCRIPTION_FIELD[locale]]: metaDescription || null,
        };

        await tx.page.upsert({
          where: { key },
          create: {
            key,
            slug: key,
            titleEn: "",
            titleAr: "",
            isActive: false,
            ...localeData,
          },
          update: localeData,
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.page.update",
            entityType: "Page",
            entityId: key,
            before,
            after: { title, content, metaTitle, metaDescription },
            metadata: { locale },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");

    return { success: true };
  } catch (err) {
    if (err instanceof StorePageActionAbort) {
      return { success: false, error: err.message, errorCode: err.code };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

const SetStorePagePublishedSchema = z.object({
  key: z.string().refine(isPageKey, "Unknown page."),
  published: z.boolean(),
});

export async function setStorePagePublishedAction(input: {
  key: string;
  published: boolean;
}): Promise<StorePageActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("content:manage");

  const parsed = SetStorePagePublishedSchema.safeParse(input);
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

  const { key, published } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.page.findUnique({ where: { key } });

        if (published) {
          const authored =
            !!existing && existing.titleEn.trim() !== "" && !!existing.contentEn?.trim();
          if (!authored) {
            throw new StorePageActionAbort(
              "ENGLISH_REQUIRED",
              "Add an English title and content before publishing.",
            );
          }
        }

        const before = { isActive: existing?.isActive ?? false };

        await tx.page.upsert({
          where: { key },
          create: { key, slug: key, titleEn: "", titleAr: "", isActive: published },
          update: { isActive: published },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.page.publish",
            entityType: "Page",
            entityId: key,
            before,
            after: { isActive: published },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");

    return { success: true };
  } catch (err) {
    if (err instanceof StorePageActionAbort) {
      return { success: false, error: err.message, errorCode: err.code };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
