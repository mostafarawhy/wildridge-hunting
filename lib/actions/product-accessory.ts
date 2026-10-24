"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";

export type ProductAccessoryActionErrorCode =
  | "NOT_FOUND"
  | "SELF_LINK"
  | "NOT_ALLOWED"
  | "ALREADY_LINKED"
  | "ORDER_MISMATCH"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export type ProductAccessoryActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ProductAccessoryActionErrorCode;
    };

const ERROR_MESSAGE: Record<ProductAccessoryActionErrorCode, string> = {
  NOT_FOUND: "Product or accessory not found.",
  SELF_LINK: "A product can't be its own accessory.",
  NOT_ALLOWED: "Rifles and pistols can't be linked as accessories.",
  ALREADY_LINKED: "This accessory is already linked.",
  ORDER_MISMATCH: "Accessory list changed. Refresh and try again.",
  INVALID_INPUT: "Invalid input.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

function fail(
  errorCode: ProductAccessoryActionErrorCode,
): ProductAccessoryActionResult {
  return { success: false, error: ERROR_MESSAGE[errorCode], errorCode };
}

function isErrorCode(
  value: string,
): value is ProductAccessoryActionErrorCode {
  return value in ERROR_MESSAGE;
}

function revalidate(productId: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + productId);
}

export async function linkAccessoryAction(
  productId: string,
  accessorySku: string,
): Promise<ProductAccessoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  if (!productId || typeof productId !== "string") return fail("INVALID_INPUT");
  if (!accessorySku || typeof accessorySku !== "string") {
    return fail("INVALID_INPUT");
  }

  let linkId: string;

  try {
    linkId = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { sku: true },
        });
        if (!product) throw new Error("NOT_FOUND");

        const accessory = await tx.product.findFirst({
          where: { sku: accessorySku, deletedAt: null },
          select: {
            sku: true,
            category: {
              select: {
                navGroup: true,
                parent: { select: { navGroup: true } },
              },
            },
          },
        });
        if (!accessory) throw new Error("NOT_FOUND");

        if (accessory.sku === product.sku) throw new Error("SELF_LINK");

        const rootNavGroup = accessory.category.parent
          ? accessory.category.parent.navGroup
          : accessory.category.navGroup;
        if (rootNavGroup === "RIFLES") throw new Error("NOT_ALLOWED");

        const agg = await tx.productAccessory.aggregate({
          where: { productSku: product.sku },
          _max: { displayOrder: true },
        });
        const displayOrder = (agg._max.displayOrder ?? 0) + 1;

        const link = await tx.productAccessory.create({
          data: {
            productSku: product.sku,
            accessorySku: accessory.sku,
            displayOrder,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_accessory.create",
            entityType: "Product",
            entityId: productId,
            after: { accessorySku: accessory.sku, displayOrder },
          },
        });

        return link.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && isErrorCode(err.message)) {
      return fail(err.message);
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
    ) {
      return fail("ALREADY_LINKED");
    }
    console.error("[linkAccessoryAction]", err);
    return fail("INTERNAL_ERROR");
  }

  revalidate(productId);

  return { success: true, data: { id: linkId } };
}

export async function unlinkAccessoryAction(
  linkId: string,
  productId: string,
): Promise<ProductAccessoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  if (!linkId || typeof linkId !== "string") return fail("INVALID_INPUT");
  if (!productId || typeof productId !== "string") return fail("INVALID_INPUT");

  try {
    await db.$transaction(
      async (tx) => {
        const link = await tx.productAccessory.findFirst({
          where: { id: linkId, product: { id: productId } },
          select: { id: true, accessorySku: true, displayOrder: true },
        });
        if (!link) throw new Error("NOT_FOUND");

        await tx.productAccessory.delete({ where: { id: link.id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_accessory.delete",
            entityType: "Product",
            entityId: productId,
            before: {
              accessorySku: link.accessorySku,
              displayOrder: link.displayOrder,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && isErrorCode(err.message)) {
      return fail(err.message);
    }
    console.error("[unlinkAccessoryAction]", err);
    return fail("INTERNAL_ERROR");
  }

  revalidate(productId);

  return { success: true, data: { id: linkId } };
}

export async function reorderAccessoriesAction(
  productId: string,
  orderedIds: string[],
): Promise<ProductAccessoryActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  if (!productId || typeof productId !== "string") return fail("INVALID_INPUT");
  if (!Array.isArray(orderedIds)) return fail("INVALID_INPUT");

  try {
    await db.$transaction(
      async (tx) => {
        const liveLinks = await tx.productAccessory.findMany({
          where: { product: { id: productId } },
          select: { id: true, accessorySku: true, displayOrder: true },
        });

        if (orderedIds.length !== liveLinks.length) {
          throw new Error("ORDER_MISMATCH");
        }
        const liveById = new Map(liveLinks.map((l) => [l.id, l]));
        if (liveById.size !== new Set(orderedIds).size) {
          throw new Error("ORDER_MISMATCH");
        }
        for (const id of orderedIds) {
          if (!liveById.has(id)) throw new Error("ORDER_MISMATCH");
        }

        const sortedByOrder = [...liveLinks].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        );

        for (let i = 0; i < orderedIds.length; i++) {
          await tx.productAccessory.update({
            where: { id: orderedIds[i] },
            data: { displayOrder: i + 1 },
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_accessory.reorder",
            entityType: "Product",
            entityId: productId,
            before: { order: sortedByOrder.map((l) => l.accessorySku) },
            after: {
              order: orderedIds.map((id) => liveById.get(id)!.accessorySku),
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && isErrorCode(err.message)) {
      return fail(err.message);
    }
    console.error("[reorderAccessoriesAction]", err);
    return fail("INTERNAL_ERROR");
  }

  revalidate(productId);

  return { success: true, data: { id: productId } };
}
