"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";

export type ProductCategoryActionErrorCode =
  | "NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "NOTHING_TO_ADD"
  | "LINK_NOT_FOUND"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export type ProductCategoryActionResult =
  | { success: true; data: { count: number } }
  | {
      success: false;
      error: string;
      errorCode: ProductCategoryActionErrorCode;
    };

const ERROR_MESSAGE: Record<ProductCategoryActionErrorCode, string> = {
  NOT_FOUND: "Category not found.",
  PRODUCT_NOT_FOUND:
    "One or more products no longer exist. Refresh and try again.",
  NOTHING_TO_ADD: "These products are already in this category.",
  LINK_NOT_FOUND:
    "This product isn't in this category anymore. Refresh the page.",
  INVALID_INPUT: "Invalid input.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

const SkusSchema = z.array(z.string().trim().min(1).max(64)).min(1).max(200);

function fail(
  errorCode: ProductCategoryActionErrorCode,
): ProductCategoryActionResult {
  return { success: false, error: ERROR_MESSAGE[errorCode], errorCode };
}

function isErrorCode(value: string): value is ProductCategoryActionErrorCode {
  return value in ERROR_MESSAGE;
}

function revalidate(categoryId: string) {
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath("/admin/products");
  revalidatePath("/[locale]", "layout");
}

export async function addProductsToCategoryAction(
  categoryId: string,
  productSkus: unknown,
): Promise<ProductCategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  if (!categoryId || typeof categoryId !== "string") {
    return fail("INVALID_INPUT");
  }
  const parsed = SkusSchema.safeParse(productSkus);
  if (!parsed.success) return fail("INVALID_INPUT");
  const skus = [...new Set(parsed.data)];

  let count: number;

  try {
    count = await db.$transaction(
      async (tx) => {
        const category = await tx.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { id: true },
        });
        if (!category) throw new Error("NOT_FOUND");

        const products = await tx.product.findMany({
          where: { sku: { in: skus }, deletedAt: null },
          select: { sku: true, categoryId: true },
        });
        if (products.length !== skus.length) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const existing = await tx.productCategory.findMany({
          where: { categoryId, productSku: { in: skus } },
          select: { productSku: true },
        });
        const existingSkus = new Set(existing.map((e) => e.productSku));

        const toAdd = products
          .filter(
            (p) => p.categoryId !== categoryId && !existingSkus.has(p.sku),
          )
          .map((p) => p.sku);
        if (toAdd.length === 0) throw new Error("NOTHING_TO_ADD");

        const created = await tx.productCategory.createMany({
          data: toAdd.map((productSku) => ({ productSku, categoryId })),
          skipDuplicates: true,
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.update",
            entityType: "Category",
            entityId: categoryId,
            metadata: {
              change: "products_add",
              skus: toAdd,
              added: created.count,
              skipped: skus.length - created.count,
            },
          },
        });

        return created.count;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && isErrorCode(err.message)) {
      return fail(err.message);
    }
    console.error("[addProductsToCategoryAction]", err);
    return fail("INTERNAL_ERROR");
  }

  revalidate(categoryId);

  return { success: true, data: { count } };
}

export async function removeProductFromCategoryAction(
  categoryId: string,
  productSku: string,
): Promise<ProductCategoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  if (!categoryId || typeof categoryId !== "string") {
    return fail("INVALID_INPUT");
  }
  if (!productSku || typeof productSku !== "string") {
    return fail("INVALID_INPUT");
  }

  try {
    await db.$transaction(
      async (tx) => {
        const link = await tx.productCategory.findFirst({
          where: { categoryId, productSku },
          select: { id: true },
        });
        if (!link) throw new Error("LINK_NOT_FOUND");

        await tx.productCategory.delete({ where: { id: link.id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "category.update",
            entityType: "Category",
            entityId: categoryId,
            metadata: { change: "products_remove", skus: [productSku] },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && isErrorCode(err.message)) {
      return fail(err.message);
    }
    console.error("[removeProductFromCategoryAction]", err);
    return fail("INTERNAL_ERROR");
  }

  revalidate(categoryId);

  return { success: true, data: { count: 1 } };
}
