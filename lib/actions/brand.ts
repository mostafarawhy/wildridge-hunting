"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { slugFromName, slugWithSuffix } from "@/lib/utils/slug";
import {
  CreateBrandSchema,
  UpdateBrandSchema,
} from "@/lib/validations/brand";

export type BrandActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NAME_TAKEN"
  | "SLUG_TAKEN"
  | "IN_USE"
  | "INTERNAL_ERROR";

export type BrandActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: BrandActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

class BrandRefusal extends Error {
  constructor(
    public code: BrandActionErrorCode,
    public text: string,
  ) {
    super(code);
  }
}

const NAME_TAKEN_TEXT = "A brand with this name already exists.";
const SLUG_TAKEN_TEXT = "Another brand uses this web handle.";
const NAME_OR_SLUG_TAKEN_TEXT =
  "A brand with this name or web handle already exists.";

function handleBrandError(err: unknown, tag: string): BrandActionResult {
  const prismaCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : undefined;

  if (prismaCode === "P2002") {
    return {
      success: false,
      error: NAME_OR_SLUG_TAKEN_TEXT,
      errorCode: "NAME_TAKEN",
      fieldErrors: { nameEn: [NAME_OR_SLUG_TAKEN_TEXT] },
    };
  }

  if (err instanceof BrandRefusal) {
    return { success: false, error: err.text, errorCode: err.code };
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Brand not found.",
          errorCode: "NOT_FOUND",
        };
      case "NAME_TAKEN":
        return {
          success: false,
          error: NAME_TAKEN_TEXT,
          errorCode: "NAME_TAKEN",
          fieldErrors: { nameEn: [NAME_TAKEN_TEXT] },
        };
      case "SLUG_TAKEN":
        return {
          success: false,
          error: SLUG_TAKEN_TEXT,
          errorCode: "SLUG_TAKEN",
          fieldErrors: { slug: [SLUG_TAKEN_TEXT] },
        };
    }
  }

  console.error(`[${tag}]`, err);
  return {
    success: false,
    error: "An unexpected error occurred.",
    errorCode: "INTERNAL_ERROR",
  };
}

function revalidateBrand(id: string) {
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${id}`);
  revalidatePath("/admin/products");
  revalidatePath("/[locale]", "layout");
}

export async function createBrandAction(
  raw: unknown,
): Promise<BrandActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = CreateBrandSchema.safeParse(raw);
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

  try {
    const brand = await db.$transaction(
      async (tx) => {
        const nameConflict = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Brand"
          WHERE "deletedAt" IS NULL
            AND lower(btrim("nameEn")) = lower(btrim(${data.nameEn}))
          LIMIT 1`;
        if (nameConflict.length > 0) throw new Error("NAME_TAKEN");

        let slug: string;
        if (data.slug) {
          const slugConflict = await tx.brand.findUnique({
            where: { slug: data.slug },
            select: { id: true },
          });
          if (slugConflict) throw new Error("SLUG_TAKEN");
          slug = data.slug;
        } else {
          const base = slugFromName(data.nameEn) || "brand";
          slug = base;
          let n = 2;
          while (
            await tx.brand.findUnique({
              where: { slug },
              select: { id: true },
            })
          ) {
            slug = slugWithSuffix(base, n);
            n++;
          }
        }

        const createData = {
          nameEn: data.nameEn,
          nameAr: data.nameAr,
          nameRu: data.nameRu,
          slug,
          isVisible: true,
        };

        const created = await tx.brand.create({
          data: createData,
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "brand.create",
            entityType: "Brand",
            entityId: created.id,
            after: createData,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidateBrand(brand.id);

    return { success: true, data: { id: brand.id } };
  } catch (err) {
    return handleBrandError(err, "createBrandAction");
  }
}

export async function updateBrandAction(
  id: string,
  raw: unknown,
): Promise<BrandActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = UpdateBrandSchema.safeParse(raw);
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

  try {
    await db.$transaction(
      async (tx) => {
        const brand = await tx.brand.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            slug: true,
          },
        });
        if (!brand) throw new Error("NOT_FOUND");

        const nameConflict = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Brand"
          WHERE "deletedAt" IS NULL
            AND "id" <> ${id}
            AND lower(btrim("nameEn")) = lower(btrim(${data.nameEn}))
          LIMIT 1`;
        if (nameConflict.length > 0) throw new Error("NAME_TAKEN");

        if (data.slug !== brand.slug) {
          const slugConflict = await tx.brand.findFirst({
            where: { slug: data.slug, id: { not: id } },
            select: { id: true },
          });
          if (slugConflict) throw new Error("SLUG_TAKEN");
        }

        await tx.brand.update({
          where: { id },
          data: {
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            nameRu: data.nameRu,
            slug: data.slug,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "brand.update",
            entityType: "Brand",
            entityId: id,
            before: {
              nameEn: brand.nameEn,
              nameAr: brand.nameAr,
              nameRu: brand.nameRu,
              slug: brand.slug,
            },
            after: data,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidateBrand(id);

    return { success: true, data: { id } };
  } catch (err) {
    return handleBrandError(err, "updateBrandAction");
  }
}

export async function setBrandVisibilityAction(
  id: string,
  isVisible: boolean,
): Promise<BrandActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    const changed = await db.$transaction(
      async (tx) => {
        const brand = await tx.brand.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, isVisible: true },
        });
        if (!brand) throw new Error("NOT_FOUND");

        if (brand.isVisible === isVisible) return false;

        await tx.brand.update({ where: { id }, data: { isVisible } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "brand.visibility",
            entityType: "Brand",
            entityId: id,
            before: { isVisible: brand.isVisible },
            after: { isVisible },
          },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (changed) revalidateBrand(id);

    return { success: true, data: { id } };
  } catch (err) {
    return handleBrandError(err, "setBrandVisibilityAction");
  }
}

export async function deleteBrandAction(
  id: string,
): Promise<BrandActionResult> {
  const demoRefusal = await demoGate("catalog:write", "delete");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    await db.$transaction(
      async (tx) => {
        const brand = await tx.brand.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            isVisible: true,
            _count: {
              select: {
                products: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!brand) throw new Error("NOT_FOUND");
        const productCount = brand._count.products;
        if (productCount > 0) {
          throw new BrandRefusal(
            "IN_USE",
            productCount === 1
              ? "This brand is used by 1 product. Pick another brand on it first."
              : `This brand is used by ${productCount} products. Pick another brand on them first.`,
          );
        }

        const deletedAt = new Date();

        await tx.brand.update({
          where: { id },
          data: { deletedAt, isVisible: false },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "brand.delete",
            entityType: "Brand",
            entityId: id,
            before: { deletedAt: null, isVisible: brand.isVisible },
            after: { deletedAt: deletedAt.toISOString(), isVisible: false },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidateBrand(id);

    return { success: true, data: { id } };
  } catch (err) {
    return handleBrandError(err, "deleteBrandAction");
  }
}
