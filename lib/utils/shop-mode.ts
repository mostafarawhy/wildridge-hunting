import "server-only";
import { BRAND } from "@/lib/config/brand";
import { cookies } from "next/headers";
import { hasActiveTradeAccount } from "@/lib/db/queries/b2b";

export const SHOP_MODE_COOKIE = `${BRAND.storageKeyPrefix}-shop-mode`;
export type ShopMode = "PERSONAL" | "BUSINESS";

export async function getShopMode(): Promise<ShopMode> {
  const v = (await cookies()).get(SHOP_MODE_COOKIE)?.value;
  return v === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

export async function getIsBusinessMode(
  customerId?: string | null,
): Promise<boolean> {
  if (!customerId) return false;
  return (
    (await hasActiveTradeAccount(customerId)) &&
    (await getShopMode()) === "BUSINESS"
  );
}

export async function getEffectiveCouponRole(
  customerId?: string | null,
): Promise<"B2C" | "B2B"> {
  return (await getIsBusinessMode(customerId)) ? "B2B" : "B2C";
}
