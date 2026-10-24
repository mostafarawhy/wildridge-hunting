"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { Prisma } from "@/app/generated/prisma/client";
import { slugWithSuffix } from "@/lib/utils/slug";
import { normalizeLoyaltyRuleFields } from "@/lib/utils/loyalty-points";
import {
  CreateProductSchema,
  ProductDetailsUpdateSchema,
  PUBLISH_STATUS_VALUES,
} from "@/lib/validations/product";

export type ProductActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "BRAND_NOT_FOUND"
  | "SKU_TAKEN"
  | "SLUG_TAKEN"
  | "NO_IMAGE"
  | "MUST_ARCHIVE_FIRST"
  | "INVALID_STATUS"
  | "INTERNAL_ERROR";

export type ProductActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ProductActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

const ExtraCategoryIdsSchema = z.array(z.string().min(1)).max(50);

const EXTRA_CATEGORY_IDS_INVALID: ProductActionResult = {
  success: false,
  error: "Validation failed.",
  errorCode: "VALIDATION_ERROR",
  fieldErrors: { extraCategoryIds: ["Choose categories from the list."] },
};

function readExtraCategoryIds(
  raw: unknown,
): { ok: true; ids: string[] | undefined } | { ok: false } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: true, ids: undefined };
  }
  const value = (raw as { extraCategoryIds?: unknown }).extraCategoryIds;
  if (value === undefined) return { ok: true, ids: undefined };
  const parsed = ExtraCategoryIdsSchema.safeParse(value);
  if (!parsed.success) return { ok: false };
  return { ok: true, ids: [...new Set(parsed.data)] };
}

const BRAND_NOT_FOUND_RESULT: ProductActionResult = {
  success: false,
  error: "Pick a brand from the list.",
  errorCode: "BRAND_NOT_FOUND",
  fieldErrors: { brandId: ["Pick a brand from the list."] },
};

async function claimFreeSlug(
  tx: Prisma.TransactionClient,
  base: string,
): Promise<string> {
  const rows = await tx.product.findMany({
    where: { slugEn: { startsWith: base } },
    select: { slugEn: true },
  });
  const taken = new Set(rows.map((r) => r.slugEn));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = slugWithSuffix(base, n);
    if (!taken.has(candidate)) return candidate;
  }
}

export async function createProductAction(
  raw: unknown,
): Promise<ProductActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = CreateProductSchema.safeParse(raw);
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

  const extra = readExtraCategoryIds(raw);
  if (!extra.ok) return EXTRA_CATEGORY_IDS_INVALID;

  const { sku, openingStock, ...parsedFields } = parsed.data;
  const fields = normalizeLoyaltyRuleFields(parsedFields);
  const extraCategoryIds = (extra.ids ?? []).filter(
    (categoryId) => categoryId !== fields.categoryId,
  );

  try {
    const product = await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id: fields.categoryId, deletedAt: null },
          select: { id: true },
        });
        if (!category) throw new Error("CATEGORY_NOT_FOUND");

        const brand = await tx.brand.findFirst({
          where: { id: fields.brandId, deletedAt: null },
          select: { id: true },
        });
        if (!brand) throw new Error("BRAND_NOT_FOUND");

        if (extraCategoryIds.length > 0) {
          const found = await tx.category.count({
            where: { id: { in: extraCategoryIds }, deletedAt: null },
          });
          if (found !== extraCategoryIds.length) {
            throw new Error("CATEGORY_NOT_FOUND");
          }
        }

        const slugEn = await claimFreeSlug(tx, fields.slugEn);

        const created = await tx.product.create({
          data: {
            sku,
            ...fields,
            slugEn,
            publishStatus: "DRAFT",
            stockQuantity: openingStock,
          },
          select: { id: true },
        });

        if (openingStock > 0) {
          await tx.stockMovement.create({
            data: {
              productSku: sku,
              delta: openingStock,
              quantityBefore: 0,
              quantityAfter: openingStock,
              type: "MANUAL_ADJUSTMENT",
              reason: "Opening stock",
              reference: null,
              staffId,
            },
          });
        }

        if (extraCategoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: extraCategoryIds.map((categoryId) => ({
              productSku: sku,
              categoryId,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.create",
            entityType: "Product",
            entityId: created.id,
            after: {
              sku,
              ...fields,
              slugEn,
              publishStatus: "DRAFT",
              stockQuantity: openingStock,
              extraCategoryIds: [...extraCategoryIds].sort(),
            },
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/products");

    return { success: true, data: { id: product.id } };
  } catch (err) {
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: string }).code
        : undefined;

    if (prismaCode === "P2002") {
      const targets =
        (err as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (targets.includes("sku")) {
        return {
          success: false,
          error: "A product with this SKU already exists.",
          errorCode: "SKU_TAKEN",
        };
      }
      if (targets.includes("slugEn")) {
        return {
          success: false,
          error: "A product with this slug already exists.",
          errorCode: "SLUG_TAKEN",
        };
      }
    }

    if (err instanceof Error && err.message === "CATEGORY_NOT_FOUND") {
      return {
        success: false,
        error: "The selected category does not exist.",
        errorCode: "CATEGORY_NOT_FOUND",
      };
    }

    if (err instanceof Error && err.message === "BRAND_NOT_FOUND") {
      return BRAND_NOT_FOUND_RESULT;
    }

    console.error("[createProductAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateProductAction(
  id: string,
  raw: unknown,
): Promise<ProductActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = ProductDetailsUpdateSchema.safeParse(raw);
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

  const extra = readExtraCategoryIds(raw);
  if (!extra.ok) return EXTRA_CATEGORY_IDS_INVALID;
  const extraIds = extra.ids;

  const data = normalizeLoyaltyRuleFields(parsed.data);

  try {
    await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            sku: true,
            slugEn: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            brandId: true,
            actionType: true,
            caliberMm: true,
            descriptionEn: true,
            descriptionAr: true,
            descriptionRu: true,
            categoryId: true,
            tags: true,
            price: true,
            compareAtPrice: true,
            lowStockThreshold: true,
            weightGrams: true,
            requiresIdVerification: true,
            serialTracking: true,
            supportsAddons: true,
            b2bAvailable: true,
            minOrderQty: true,
            maxOrderQty: true,
            isNewArrival: true,
            isFeatured: true,
            sortOrder: true,
            loyaltyPointsEarn: true,
            loyaltyRule: true,
            loyaltyMultiplier: true,
            loyaltyRuleStartsAt: true,
            loyaltyRuleEndsAt: true,
            metaTitleEn: true,
            metaTitleAr: true,
            metaTitleRu: true,
            metaDescriptionEn: true,
            metaDescriptionAr: true,
            metaDescriptionRu: true,
            internalNotes: true,
          },
        });
        if (!product) throw new Error("NOT_FOUND");

        const category = await tx.category.findFirst({
          where: { id: data.categoryId, deletedAt: null },
          select: { id: true },
        });
        if (!category) throw new Error("CATEGORY_NOT_FOUND");

        const brand = await tx.brand.findFirst({
          where: { id: data.brandId, deletedAt: null },
          select: { id: true },
        });
        if (!brand) throw new Error("BRAND_NOT_FOUND");

        if (data.slugEn !== product.slugEn) {
          const slugConflict = await tx.product.findFirst({
            where: { slugEn: data.slugEn, id: { not: id } },
            select: { id: true },
          });
          if (slugConflict) throw new Error("SLUG_TAKEN");
        }

        let extraChange: { current: string[]; next: string[] } | null = null;
        if (extraIds !== undefined) {
          const next = extraIds
            .filter((categoryId) => categoryId !== data.categoryId)
            .sort();
          if (next.length > 0) {
            const found = await tx.category.count({
              where: { id: { in: next }, deletedAt: null },
            });
            if (found !== next.length) throw new Error("CATEGORY_NOT_FOUND");
          }
          const current = (
            await tx.productCategory.findMany({
              where: { productSku: product.sku },
              select: { categoryId: true },
            })
          )
            .map((l) => l.categoryId)
            .sort();
          const removed = current.filter((c) => !next.includes(c));
          const added = next.filter((c) => !current.includes(c));
          if (removed.length > 0) {
            await tx.productCategory.deleteMany({
              where: { productSku: product.sku, categoryId: { in: removed } },
            });
          }
          if (added.length > 0) {
            await tx.productCategory.createMany({
              data: added.map((categoryId) => ({
                productSku: product.sku,
                categoryId,
              })),
            });
          }
          extraChange = { current, next };
        }

        await tx.product.update({ where: { id }, data });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.update",
            entityType: "Product",
            entityId: id,
            before: {
              nameEn: product.nameEn,
              nameAr: product.nameAr,
              nameRu: product.nameRu,
              slugEn: product.slugEn,
              brandId: product.brandId,
              actionType: product.actionType,
              caliberMm:
                product.caliberMm != null ? Number(product.caliberMm) : null,
              descriptionEn: product.descriptionEn,
              descriptionAr: product.descriptionAr,
              descriptionRu: product.descriptionRu,
              categoryId: product.categoryId,
              tags: product.tags,
              price: Number(product.price),
              compareAtPrice:
                product.compareAtPrice != null
                  ? Number(product.compareAtPrice)
                  : null,
              lowStockThreshold: product.lowStockThreshold,
              weightGrams: product.weightGrams,
              requiresIdVerification: product.requiresIdVerification,
              serialTracking: product.serialTracking,
              supportsAddons: product.supportsAddons,
              b2bAvailable: product.b2bAvailable,
              minOrderQty: product.minOrderQty,
              maxOrderQty: product.maxOrderQty,
              isNewArrival: product.isNewArrival,
              isFeatured: product.isFeatured,
              sortOrder: product.sortOrder,
              loyaltyPointsEarn: product.loyaltyPointsEarn,
              loyaltyRule: product.loyaltyRule,
              loyaltyMultiplier: product.loyaltyMultiplier?.toNumber() ?? null,
              loyaltyRuleStartsAt:
                product.loyaltyRuleStartsAt?.toISOString() ?? null,
              loyaltyRuleEndsAt:
                product.loyaltyRuleEndsAt?.toISOString() ?? null,
              metaTitleEn: product.metaTitleEn,
              metaTitleAr: product.metaTitleAr,
              metaTitleRu: product.metaTitleRu,
              metaDescriptionEn: product.metaDescriptionEn,
              metaDescriptionAr: product.metaDescriptionAr,
              metaDescriptionRu: product.metaDescriptionRu,
              internalNotes: product.internalNotes,
              ...(extraChange
                ? { extraCategoryIds: extraChange.current }
                : {}),
            },
            after: extraChange
              ? { ...data, extraCategoryIds: extraChange.next }
              : data,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);

    return { success: true, data: { id } };
  } catch (err) {
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: string }).code
        : undefined;

    if (prismaCode === "P2002") {
      const targets =
        (err as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (targets.includes("slugEn")) {
        return {
          success: false,
          error: "A product with this slug already exists.",
          errorCode: "SLUG_TAKEN",
        };
      }
    }

    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "CATEGORY_NOT_FOUND") {
        return {
          success: false,
          error: "The selected category does not exist.",
          errorCode: "CATEGORY_NOT_FOUND",
        };
      }
      if (err.message === "BRAND_NOT_FOUND") {
        return BRAND_NOT_FOUND_RESULT;
      }
      if (err.message === "SLUG_TAKEN") {
        return {
          success: false,
          error: "A product with this slug already exists.",
          errorCode: "SLUG_TAKEN",
        };
      }
    }

    console.error("[updateProductAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

function revalidateProduct(id: string) {
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/[locale]", "layout");
}

export async function setProductStatusAction(
  id: string,
  status: unknown,
): Promise<ProductActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsedStatus = z.enum(PUBLISH_STATUS_VALUES).safeParse(status);
  if (!parsedStatus.success) {
    return {
      success: false,
      error: "Invalid status.",
      errorCode: "INVALID_STATUS",
    };
  }
  const target = parsedStatus.data;

  try {
    const changed = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id, deletedAt: null },
          select: { sku: true, publishStatus: true },
        });
        if (!product) throw new Error("NOT_FOUND");

        if (product.publishStatus === target) return false;

        if (target === "PUBLISHED") {
          const imageCount = await tx.productImage.count({
            where: { productSku: product.sku },
          });
          if (imageCount === 0) throw new Error("NO_IMAGE");
        }

        await tx.product.update({
          where: { id },
          data: { publishStatus: target },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.status",
            entityType: "Product",
            entityId: id,
            before: { publishStatus: product.publishStatus },
            after: { publishStatus: target },
            metadata: { sku: product.sku },
          },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (changed) revalidateProduct(id);

    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "NO_IMAGE") {
        return {
          success: false,
          error: "Add at least one image before publishing.",
          errorCode: "NO_IMAGE",
        };
      }
    }

    console.error("[setProductStatusAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function deleteProductAction(
  id: string,
): Promise<ProductActionResult> {
  const demoRefusal = await demoGate("catalog:write", "delete");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id, deletedAt: null },
          select: { sku: true, publishStatus: true },
        });
        if (!product) throw new Error("NOT_FOUND");

        if (product.publishStatus === "PUBLISHED") {
          throw new Error("MUST_ARCHIVE_FIRST");
        }

        const removed = await tx.cartItem.deleteMany({
          where: { productSku: product.sku },
        });

        const accessoryLinks = await tx.productAccessory.deleteMany({
          where: {
            OR: [{ productSku: product.sku }, { accessorySku: product.sku }],
          },
        });

        const categoryLinks = await tx.productCategory.deleteMany({
          where: { productSku: product.sku },
        });

        const deletedAt = new Date();
        await tx.product.update({ where: { id }, data: { deletedAt } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.delete",
            entityType: "Product",
            entityId: id,
            before: { deletedAt: null, publishStatus: product.publishStatus },
            after: { deletedAt: deletedAt.toISOString() },
            metadata: {
              sku: product.sku,
              cartLinesRemoved: removed.count,
              accessoryLinksRemoved: accessoryLinks.count,
              categoryLinksRemoved: categoryLinks.count,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidateProduct(id);

    return { success: true, data: { id } };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "MUST_ARCHIVE_FIRST") {
        return {
          success: false,
          error: "Archive the product before deleting it.",
          errorCode: "MUST_ARCHIVE_FIRST",
        };
      }
    }

    console.error("[deleteProductAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
