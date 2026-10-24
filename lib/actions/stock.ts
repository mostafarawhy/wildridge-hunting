"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { adjustStockSchema } from "@/lib/validations/product";

export type AdjustStockErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NEGATIVE_RESULT"
  | "INTERNAL_ERROR";

export type AdjustStockResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: AdjustStockErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

export async function adjustProductStockAction(
  productId: string,
  raw: unknown,
): Promise<AdjustStockResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = adjustStockSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { delta, type, reason } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { sku: true, stockQuantity: true },
        });
        if (!product) throw new Error("NOT_FOUND");

        const before = product.stockQuantity;
        const after = before + delta;
        if (after < 0) throw new Error("NEGATIVE_RESULT");

        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { increment: delta } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productSku: product.sku,
            delta,
            quantityBefore: before,
            quantityAfter: after,
            type,
            reason,
            staffId,
            reference: null,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.stock_adjust",
            entityType: "Product",
            entityId: productId,
            before: { stockQuantity: before },
            after: { stockQuantity: after },
            metadata: { delta, type, reason, movementId: movement.id },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + productId);

    return { success: true, data: { id: productId } };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "NEGATIVE_RESULT") {
        return {
          success: false,
          error: "Adjustment would drive stock below zero.",
          errorCode: "NEGATIVE_RESULT",
        };
      }
    }
    console.error("[adjustProductStockAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
