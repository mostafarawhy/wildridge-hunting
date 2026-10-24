"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import {
  getCartProjection,
  findCustomerCartId,
  findGuestCartId,
  type CartProjection,
} from "@/lib/db/queries/cart";
import { getIsBusinessMode } from "@/lib/utils/shop-mode";

const CART_COOKIE = "cartToken";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type Locale = "en" | "ar" | "ru";

export type CartActionErrorCode =
  | "VALIDATION_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "ADDON_NOT_FOUND"
  | "ADDON_NOT_LINKED"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "ADDON_INSUFFICIENT_STOCK"
  | "CART_ITEM_NOT_FOUND"
  | "B2B_QUOTE_ONLY"
  | "INTERNAL_ERROR";

export type CartActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; errorCode: CartActionErrorCode };

async function resolveCartId(): Promise<string> {
  const customerId = await getSessionCustomerId();

  if (customerId) {
    const existing = await findCustomerCartId(customerId);
    if (existing) return existing;
    const created = await db.cart.create({
      data: { customerId },
      select: { id: true },
    });
    return created.id;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await findGuestCartId(token);
    if (existing) return existing;
  }

  const newToken = randomUUID();
  const created = await db.cart.create({
    data: { guestToken: newToken },
    select: { id: true },
  });
  cookieStore.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CART_COOKIE_MAX_AGE,
    path: "/",
  });
  return created.id;
}

export async function getCart(locale: Locale): Promise<CartProjection | null> {
  const customerId = await getSessionCustomerId();

  let cartId: string | null = null;
  if (customerId) {
    cartId = await findCustomerCartId(customerId);
  } else {
    const cookieStore = await cookies();
    const token = cookieStore.get(CART_COOKIE)?.value;
    if (token) cartId = await findGuestCartId(token);
  }

  if (!cartId) return null;
  return getCartProjection(cartId, locale);
}

export interface AddToCartInput {
  productSku: string;
  quantity: number;
  accessorySkus?: string[];
  locale: Locale;
}

export async function addToCartAction(
  input: AddToCartInput,
): Promise<CartActionResult<CartProjection>> {
  try {
    if (!input.productSku || input.quantity < 1) {
      return {
        success: false,
        error: "Invalid input",
        errorCode: "VALIDATION_ERROR",
      };
    }

    if (await getIsBusinessMode(await getSessionCustomerId())) {
      return {
        success: false,
        error: "Quote-only account",
        errorCode: "B2B_QUOTE_ONLY",
      };
    }

    const product = await db.product.findUnique({
      where: { sku: input.productSku },
      select: {
        sku: true,
        stockQuantity: true,
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

    if (product.stockQuantity < input.quantity) {
      return {
        success: false,
        error: "Insufficient stock",
        errorCode:
          product.stockQuantity === 0 ? "OUT_OF_STOCK" : "INSUFFICIENT_STOCK",
      };
    }

    const accessorySkus = [...new Set(input.accessorySkus ?? [])];
    const accessories: { sku: string; stockQuantity: number }[] = [];
    if (accessorySkus.length > 0) {
      const links = await db.productAccessory.findMany({
        where: {
          productSku: product.sku,
          accessorySku: { in: accessorySkus },
        },
        select: {
          accessory: {
            select: {
              sku: true,
              stockQuantity: true,
              publishStatus: true,
              deletedAt: true,
              category: { select: LIVE_CATEGORY_SELECT },
            },
          },
        },
      });
      if (links.length !== accessorySkus.length) {
        return {
          success: false,
          error: "Invalid add-on selection",
          errorCode: "ADDON_NOT_LINKED",
        };
      }
      if (
        links.some(
          (l) =>
            l.accessory.deletedAt ||
            l.accessory.publishStatus !== "PUBLISHED" ||
            !isLiveCategory(l.accessory.category),
        )
      ) {
        return {
          success: false,
          error: "Add-on not found",
          errorCode: "ADDON_NOT_FOUND",
        };
      }
      if (links.some((l) => l.accessory.stockQuantity < input.quantity)) {
        return {
          success: false,
          error: "Insufficient add-on stock",
          errorCode: "ADDON_INSUFFICIENT_STOCK",
        };
      }
      accessories.push(
        ...links.map((l) => ({
          sku: l.accessory.sku,
          stockQuantity: l.accessory.stockQuantity,
        })),
      );
    }

    const cartId = await resolveCartId();

    await db.$transaction(async (tx) => {
      const targets = [
        { sku: product.sku, stockQuantity: product.stockQuantity },
        ...accessories,
      ];
      for (const target of targets) {
        const inserted = await tx.cartItem.createMany({
          data: [{ cartId, productSku: target.sku, quantity: input.quantity }],
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          await tx.cartItem.update({
            where: { cartId_productSku: { cartId, productSku: target.sku } },
            data: { quantity: { increment: input.quantity } },
          });
        }
        await tx.cartItem.updateMany({
          where: {
            cartId,
            productSku: target.sku,
            quantity: { gt: target.stockQuantity },
          },
          data: { quantity: target.stockQuantity },
        });
      }

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });
    });

    revalidatePath("/", "layout");

    const projection = await getCartProjection(cartId, input.locale);
    if (!projection) {
      return {
        success: false,
        error: "Cart not found after add",
        errorCode: "INTERNAL_ERROR",
      };
    }

    return { success: true, data: projection };
  } catch (err) {
    console.error("[addToCartAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateCartItemQuantityAction(input: {
  cartItemId: string;
  quantity: number;
  locale: Locale;
}): Promise<CartActionResult<CartProjection>> {
  try {
    if (input.quantity < 1) {
      return {
        success: false,
        error: "Quantity must be at least 1",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const line = await db.cartItem.findUnique({
      where: { id: input.cartItemId },
      include: {
        product: { select: { stockQuantity: true } },
        cart: { select: { id: true, customerId: true, guestToken: true } },
      },
    });

    if (!line) {
      return {
        success: false,
        error: "Cart item not found",
        errorCode: "CART_ITEM_NOT_FOUND",
      };
    }

    const ok = await assertCartOwnership(line.cart);
    if (!ok) {
      return {
        success: false,
        error: "Cart item not found",
        errorCode: "CART_ITEM_NOT_FOUND",
      };
    }

    if (input.quantity > line.product.stockQuantity) {
      return {
        success: false,
        error: "Insufficient stock",
        errorCode: "INSUFFICIENT_STOCK",
      };
    }

    await db.cartItem.update({
      where: { id: input.cartItemId },
      data: { quantity: input.quantity },
    });

    revalidatePath("/", "layout");

    const projection = await getCartProjection(line.cart.id, input.locale);
    if (!projection) {
      return {
        success: false,
        error: "Cart not found",
        errorCode: "INTERNAL_ERROR",
      };
    }
    return { success: true, data: projection };
  } catch (err) {
    console.error("[updateCartItemQuantityAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function removeFromCartAction(input: {
  cartItemId: string;
  locale: Locale;
}): Promise<CartActionResult<CartProjection | null>> {
  try {
    const line = await db.cartItem.findUnique({
      where: { id: input.cartItemId },
      include: {
        cart: { select: { id: true, customerId: true, guestToken: true } },
      },
    });

    if (!line) {
      return {
        success: false,
        error: "Cart item not found",
        errorCode: "CART_ITEM_NOT_FOUND",
      };
    }

    const ok = await assertCartOwnership(line.cart);
    if (!ok) {
      return {
        success: false,
        error: "Cart item not found",
        errorCode: "CART_ITEM_NOT_FOUND",
      };
    }

    await db.cartItem.delete({ where: { id: input.cartItemId } });

    revalidatePath("/", "layout");

    const projection = await getCartProjection(line.cart.id, input.locale);
    return { success: true, data: projection };
  } catch (err) {
    console.error("[removeFromCartAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function mergeGuestCartAction(
  customerIdOverride?: string,
): Promise<CartActionResult<void>> {
  try {
    let customerId: string | undefined = customerIdOverride;
    if (!customerId) {
      customerId = (await getSessionCustomerId()) ?? undefined;
    }
    if (!customerId) {
      return {
        success: false,
        error: "Not authenticated",
        errorCode: "VALIDATION_ERROR",
      };
    }

    const cookieStore = await cookies();
    const guestToken = cookieStore.get(CART_COOKIE)?.value;

    if (await getIsBusinessMode(customerId)) {
      if (guestToken) cookieStore.delete(CART_COOKIE);
      return { success: true, data: undefined };
    }

    if (!guestToken) return { success: true, data: undefined };

    const guestCart = await db.cart.findUnique({
      where: { guestToken },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      cookieStore.delete(CART_COOKIE);
      return { success: true, data: undefined };
    }

    let customerCartId = await findCustomerCartId(customerId);
    if (!customerCartId) {
      const created = await db.cart.create({
        data: { customerId },
        select: { id: true },
      });
      customerCartId = created.id;
    }

    const targetCartId = customerCartId;

    await db.$transaction(async (tx) => {
      for (const guestLine of guestCart.items) {
        const product = await tx.product.findUnique({
          where: { sku: guestLine.productSku },
          select: {
            stockQuantity: true,
            publishStatus: true,
            deletedAt: true,
            category: { select: LIVE_CATEGORY_SELECT },
          },
        });

        if (
          !product ||
          product.deletedAt !== null ||
          product.publishStatus !== "PUBLISHED" ||
          !isLiveCategory(product.category) ||
          product.stockQuantity < 1
        ) {
          continue;
        }

        const inserted = await tx.cartItem.createMany({
          data: [
            {
              cartId: targetCartId,
              productSku: guestLine.productSku,
              quantity: Math.min(guestLine.quantity, product.stockQuantity),
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          await tx.cartItem.update({
            where: {
              cartId_productSku: {
                cartId: targetCartId,
                productSku: guestLine.productSku,
              },
            },
            data: { quantity: { increment: guestLine.quantity } },
          });
        }
        await tx.cartItem.updateMany({
          where: {
            cartId: targetCartId,
            productSku: guestLine.productSku,
            quantity: { gt: product.stockQuantity },
          },
          data: { quantity: product.stockQuantity },
        });
      }

      await tx.cart.delete({ where: { id: guestCart.id } });
      await tx.cart.update({
        where: { id: targetCartId },
        data: { updatedAt: new Date() },
      });
    });

    cookieStore.delete(CART_COOKIE);
    revalidatePath("/", "layout");

    return { success: true, data: undefined };
  } catch (err) {
    console.error("[mergeGuestCartAction]", err);
    return {
      success: false,
      error: "Something went wrong",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

async function assertCartOwnership(cart: {
  customerId: string | null;
  guestToken: string | null;
}): Promise<boolean> {
  const customerId = await getSessionCustomerId();

  if (customerId) return cart.customerId === customerId;

  if (cart.guestToken) {
    const cookieStore = await cookies();
    const token = cookieStore.get(CART_COOKIE)?.value;
    return token === cart.guestToken;
  }
  return false;
}
