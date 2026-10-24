"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { productSpecsInputSchema } from "@/lib/validations/product";

export type ProductSpecIssue = {
  row: number | null;
  field: string | null;
  message: string;
};

export type ProductSpecActionResult =
  | { success: true; data: { count: number } }
  | {
      success: false;
      error: string;
      errorCode:
        | "VALIDATION_ERROR"
        | "DUPLICATE_LABEL"
        | "NOT_FOUND"
        | "NO_CHANGES"
        | "INTERNAL_ERROR";
      issues?: ProductSpecIssue[];
    };

const specStrings = (rows: { labelEn: string; valueEn: string }[]) =>
  rows.map((r) => `${r.labelEn}: ${r.valueEn}`);

const signature = (r: {
  labelEn: string;
  labelAr: string;
  labelRu: string | null;
  valueEn: string;
  valueAr: string;
  valueRu: string | null;
}) =>
  JSON.stringify([
    r.labelEn,
    r.labelAr,
    r.labelRu ?? "",
    r.valueEn,
    r.valueAr,
    r.valueRu ?? "",
  ]);

export async function replaceProductSpecsAction(
  productId: string,
  raw: unknown,
): Promise<ProductSpecActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = productSpecsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((issue) => {
        const rowKey = issue.path[1];
        const fieldKey = issue.path[2];
        return {
          row: typeof rowKey === "number" ? rowKey : null,
          field: typeof fieldKey === "string" ? fieldKey : null,
          message: issue.message,
        };
      }),
    };
  }

  const rows = parsed.data.rows;

  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].labelEn.toLowerCase();
    if (seen.has(key)) {
      return {
        success: false,
        error: `'${rows[i].labelEn}' is listed twice.`,
        errorCode: "DUPLICATE_LABEL",
        issues: [
          {
            row: i,
            field: "labelEn",
            message: "This label is already used in another row.",
          },
        ],
      };
    }
    seen.add(key);
  }

  try {
    await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { sku: true },
        });
        if (!product) throw new Error("NOT_FOUND");

        const current = await tx.productSpec.findMany({
          where: { productSku: product.sku },
          orderBy: [{ displayOrder: "asc" }, { labelEn: "asc" }],
          select: {
            labelEn: true,
            labelAr: true,
            labelRu: true,
            valueEn: true,
            valueAr: true,
            valueRu: true,
          },
        });

        const same =
          current.length === rows.length &&
          current.every((c, i) => signature(c) === signature(rows[i]));
        if (same) throw new Error("NO_CHANGES");

        await tx.productSpec.deleteMany({
          where: { productSku: product.sku },
        });
        if (rows.length > 0) {
          await tx.productSpec.createMany({
            data: rows.map((r, index) => ({
              productSku: product.sku,
              labelEn: r.labelEn,
              labelAr: r.labelAr,
              labelRu: r.labelRu,
              valueEn: r.valueEn,
              valueAr: r.valueAr,
              valueRu: r.valueRu,
              displayOrder: index,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product.update",
            entityType: "Product",
            entityId: productId,
            before: { specs: specStrings(current) },
            after: { specs: specStrings(rows) },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "NOT_FOUND",
        };
      }
      if (err.message === "NO_CHANGES") {
        return {
          success: false,
          error: "Nothing changed.",
          errorCode: "NO_CHANGES",
        };
      }
    }

    console.error("[replaceProductSpecsAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/[locale]", "layout");

  return { success: true, data: { count: rows.length } };
}
