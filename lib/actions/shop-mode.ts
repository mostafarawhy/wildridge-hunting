"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SHOP_MODE_COOKIE, type ShopMode } from "@/lib/utils/shop-mode";

export async function setShopModeAction(mode: ShopMode): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SHOP_MODE_COOKIE, mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  revalidatePath("/", "layout");
}
