"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { uploadFile, deleteFile } from "@/lib/services/storage";
import { sniffImageType } from "@/lib/utils/image-sniff";
import {
  MAX_MANUAL_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_PRODUCT_IMAGES,
  mimeToExt,
  productImageAltTextSchema,
} from "@/lib/validations/product";

const PRODUCT_IMAGES_BUCKET = "product-images";

export type ProductImageActionErrorCode =
  | "NO_FILE_PROVIDED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "PRODUCT_NOT_FOUND"
  | "CAP_REACHED"
  | "STORAGE_ERROR"
  | "NOT_FOUND"
  | "ORDER_MISMATCH"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export type ProductImageActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ProductImageActionErrorCode;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function addProductImageAction(
  formData: FormData,
): Promise<ProductImageActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const productSku = String(formData.get("productSku") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const rawFile = formData.get("file");

  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  if (!file) {
    return {
      success: false,
      error: "No file provided.",
      errorCode: "NO_FILE_PROVIDED",
    };
  }

  if (file.size > MAX_MANUAL_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      error: `File "${file.name}" exceeds the 4 MB size limit.`,
      errorCode: "FILE_TOO_LARGE",
    };
  }

  const sniffed = sniffImageType(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  if (!sniffed) {
    return {
      success: false,
      error: `File "${file.name}" isn't a JPEG, PNG or WebP image.`,
      errorCode: "INVALID_FILE_TYPE",
    };
  }

  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      sniffed as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    return {
      success: false,
      error: `File "${file.name}" has an unsupported type. Allowed: JPEG, PNG, WebP.`,
      errorCode: "INVALID_FILE_TYPE",
    };
  }

  // Cheap pre-check before upload
  const existingCount = await db.productImage.count({ where: { productSku } });
  if (existingCount >= MAX_PRODUCT_IMAGES) {
    return {
      success: false,
      error: "Maximum number of images reached.",
      errorCode: "CAP_REACHED",
    };
  }

  const ext = mimeToExt[sniffed] ?? "bin";
  const storageKey = `products/${productSku}/${crypto.randomUUID()}.${ext}`;

  try {
    await uploadFile({
      bucket: PRODUCT_IMAGES_BUCKET,
      path: storageKey,
      file,
      contentType: sniffed,
    });
  } catch {
    return {
      success: false,
      error: "Failed to upload image. Please try again.",
      errorCode: "STORAGE_ERROR",
    };
  }

  let imageId: string;

  try {
    imageId = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { sku: productSku, deletedAt: null },
          select: { id: true },
        });
        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        const count = await tx.productImage.count({ where: { productSku } });
        if (count >= MAX_PRODUCT_IMAGES) throw new Error("CAP_REACHED");

        const agg = await tx.productImage.aggregate({
          where: { productSku },
          _max: { displayOrder: true },
        });
        const displayOrder = (agg._max.displayOrder ?? 0) + 1;

        const image = await tx.productImage.create({
          data: { productSku, filename: file.name, storageKey, displayOrder },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_image.create",
            entityType: "ProductImage",
            entityId: image.id,
            after: {
              productSku,
              filename: file.name,
              storageKey,
              displayOrder,
            },
          },
        });

        return image.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    try {
      await deleteFile(PRODUCT_IMAGES_BUCKET, storageKey);
    } catch {
      // best-effort
    }

    if (err instanceof Error) {
      if (err.message === "PRODUCT_NOT_FOUND") {
        return {
          success: false,
          error: "Product not found.",
          errorCode: "PRODUCT_NOT_FOUND",
        };
      }
      if (err.message === "CAP_REACHED") {
        return {
          success: false,
          error: "Maximum number of images reached.",
          errorCode: "CAP_REACHED",
        };
      }
    }

    console.error("[addProductImageAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + productId);

  return { success: true, data: { id: imageId } };
}

export async function deleteProductImageAction(
  imageId: string,
  productId: string,
): Promise<ProductImageActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  let storageKey = null as string | null;

  try {
    await db.$transaction(
      async (tx) => {
        const image = await tx.productImage.findUnique({
          where: { id: imageId },
          select: {
            id: true,
            storageKey: true,
            productSku: true,
            filename: true,
            displayOrder: true,
          },
        });
        if (!image) throw new Error("NOT_FOUND");

        storageKey = image.storageKey;

        await tx.productImage.delete({ where: { id: imageId } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_image.delete",
            entityType: "ProductImage",
            entityId: imageId,
            before: {
              productSku: image.productSku,
              filename: image.filename,
              storageKey: image.storageKey,
              displayOrder: image.displayOrder,
            },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Image not found.",
        errorCode: "NOT_FOUND",
      };
    }
    console.error("[deleteProductImageAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  if (storageKey && !storageKey.startsWith("seed/")) {
    try {
      await deleteFile(PRODUCT_IMAGES_BUCKET, storageKey);
    } catch {
      // best-effort
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + productId);

  return { success: true, data: { id: imageId } };
}

export async function reorderProductImagesAction(
  productId: string,
  productSku: string,
  orderedIds: string[],
): Promise<ProductImageActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  try {
    await db.$transaction(
      async (tx) => {
        const liveImages = await tx.productImage.findMany({
          where: { productSku },
          select: { id: true, displayOrder: true },
        });

        if (orderedIds.length !== liveImages.length) {
          throw new Error("ORDER_MISMATCH");
        }
        const liveIdSet = new Set(liveImages.map((img) => img.id));
        for (const id of orderedIds) {
          if (!liveIdSet.has(id)) throw new Error("ORDER_MISMATCH");
        }

        const sortedByOrder = [...liveImages].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        );

        // Phase 1: shift every row to a negative sentinel range
        for (let i = 0; i < liveImages.length; i++) {
          await tx.productImage.update({
            where: { id: liveImages[i].id },
            data: { displayOrder: -(i + 1) },
          });
        }

        // Phase 2: write final 1-based positions
        for (let i = 0; i < orderedIds.length; i++) {
          await tx.productImage.update({
            where: { id: orderedIds[i] },
            data: { displayOrder: i + 1 },
          });
        }

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_image.reorder",
            entityType: "Product",
            entityId: productId,
            before: { order: sortedByOrder.map((img) => img.id) },
            after: { order: orderedIds },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "ORDER_MISMATCH") {
      return {
        success: false,
        error: "Image list changed. Refresh and try again.",
        errorCode: "ORDER_MISMATCH",
      };
    }
    console.error("[reorderProductImagesAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + productId);

  return { success: true, data: { id: productId } };
}

export async function updateProductImageAltTextAction(
  imageId: string,
  productId: string,
  input: { altTextEn?: string | null; altTextAr?: string | null; altTextRu?: string | null },
): Promise<ProductImageActionResult> {
  const demoRefusal = await demoGate("catalog:write");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("catalog:write");

  const parsed = productImageAltTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input.",
      errorCode: "INVALID_INPUT",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { altTextEn, altTextAr, altTextRu } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const image = await tx.productImage.findUnique({
          where: { id: imageId },
          select: { id: true, productSku: true, altTextEn: true, altTextAr: true, altTextRu: true },
        });
        if (!image) throw new Error("NOT_FOUND");

        const before = {
          altTextEn: image.altTextEn,
          altTextAr: image.altTextAr,
          altTextRu: image.altTextRu,
        };

        await tx.productImage.update({
          where: { id: imageId },
          data: { altTextEn, altTextAr, altTextRu },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "product_image.update_alt_text",
            entityType: "ProductImage",
            entityId: imageId,
            before,
            after: { altTextEn, altTextAr, altTextRu },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Image not found.",
        errorCode: "NOT_FOUND",
      };
    }
    console.error("[updateProductImageAltTextAction]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + productId);

  return { success: true, data: { id: imageId } };
}
