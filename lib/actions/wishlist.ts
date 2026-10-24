"use server";

import { revalidatePath } from "next/cache";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";

export type WishlistActionErrorCode =
  | "UNAUTHORIZED"
  | "PRODUCT_NOT_FOUND"
  | "INTERNAL_ERROR";

export type WishlistActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: WishlistActionErrorCode };

export async function toggleWishlistAction(
  productSku: string,
): Promise<WishlistActionResult<{ saved: boolean }>> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "Not authenticated",
        errorCode: "UNAUTHORIZED",
      };
    }

    const product = await db.product.findUnique({
      where: { sku: productSku },
      select: {
        sku: true,
        publishStatus: true,
        deletedAt: true,
        category: { select: LIVE_CATEGORY_SELECT },
      },
    });

    if (
      !product ||
      product.deletedAt ||
      product.publishStatus !== "PUBLISHED" ||
      !isLiveCategory(product.category)
    ) {
      return {
        success: false,
        error: "Product not found",
        errorCode: "PRODUCT_NOT_FOUND",
      };
    }

    const existing = await db.wishlistItem.findUnique({
      where: { customerId_productSku: { customerId, productSku } },
      select: { id: true },
    });

    if (existing) {
      await db.wishlistItem.delete({
        where: { customerId_productSku: { customerId, productSku } },
      });
      revalidatePath("/", "layout");
      return { success: true, data: { saved: false } };
    } else {
      await db.wishlistItem.create({
        data: { customerId, productSku },
      });
      revalidatePath("/", "layout");
      return { success: true, data: { saved: true } };
    }
  } catch (err) {
    console.error("[toggleWishlistAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function removeFromWishlistAction(
  productSku: string,
): Promise<WishlistActionResult<void>> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "Not authenticated",
        errorCode: "UNAUTHORIZED",
      };
    }

    await db.wishlistItem.deleteMany({
      where: { customerId, productSku },
    });

    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[removeFromWishlistAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
