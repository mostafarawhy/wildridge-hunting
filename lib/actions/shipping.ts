"use server";

import { getSessionCustomerId } from "@/lib/auth-customer";
import { db } from "@/lib/db/client";
import { resolveShipping, type ResolvedShippingMethod } from "@/lib/db/queries/checkout";
import { findCustomerCartId, getCartProjection } from "@/lib/db/queries/cart";

export type GetShippingResult =
  | {
      success: true;
      data: {
        methods: ResolvedShippingMethod[];
        selectedMethodId: string | null;
        quoteRequired: boolean;
        freeShippingThresholdAed: number | null;
      };
    }
  | { success: false; error: string };

export async function getShippingForAddress(
  addressId: string,
): Promise<GetShippingResult> {
  const customerId = await getSessionCustomerId();
  if (!customerId) {
    return { success: false, error: "Unauthenticated." };
  }

  const address = await db.customerAddress.findUnique({
    where: { id: addressId },
    select: { id: true, customerId: true, country: true, emirate: true },
  });

  if (!address || address.customerId !== customerId) {
    return { success: false, error: "Address not found." };
  }

  const cartId = await findCustomerCartId(customerId);
  let cartSubtotal = 0;
  if (cartId) {
    const cart = await getCartProjection(cartId, "en");
    if (cart) {
      cartSubtotal = cart.totals.subtotalAed;
    }
  }

  const resolution = await resolveShipping({
    country: address.country,
    emirate: address.emirate,
    subtotal: cartSubtotal,
  });

  return {
    success: true,
    data: {
      methods: resolution.methods,
      selectedMethodId: resolution.quoteRequired ? null : (resolution.methods[0]?.id ?? null),
      quoteRequired: resolution.quoteRequired,
      freeShippingThresholdAed: resolution.freeShippingThresholdAed,
    },
  };
}
