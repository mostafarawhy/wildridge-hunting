import "server-only";
import { db } from "@/lib/db/client";
import { getFreeShippingOffer } from "@/lib/db/queries/shipping";
import { getSetting } from "@/lib/db/queries/settings";
import { multiplyMoney, roundMoney } from "@/lib/utils/currency";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";
import {
  computeOrderPointsWithRules,
  effectiveLoyaltyRule,
  type EffectiveLoyaltyRule,
} from "@/lib/utils/loyalty-points";

/**
 * Cart projection — what the UI sees.
 * No raw Prisma types. No Decimal. Numbers only.
 * Live product/addon prices; cart never snapshots until checkout.
 */
export interface CartProjection {
  id: string;
  items: CartLineProjection[];
  totals: {
    itemCount: number;
    subtotalAed: number;
    grandTotalAed: number;
    freeShippingEnabled: boolean;
    freeShippingThresholdAed: number;
    freeShippingEligible: boolean;
    freeShippingRemainingAed: number;
    blocked: boolean;
  };
  hasRestrictedItems: boolean;
  loyalty: { enabled: boolean; earnRate: number; points: number };
}

export interface CartLineProjection {
  id: string;
  productSku: string;
  productSlug: string;
  productName: string;
  categorySlug: string;
  productImageUrl: string | null;
  unitPriceAed: number;
  compareAtPriceAed: number | null;
  quantity: number;
  stockQuantity: number;
  available: boolean;
  requiresIdVerification: boolean;
  lineSubtotalAed: number;
  loyaltyRule: EffectiveLoyaltyRule;
}

type Locale = "en" | "ar" | "ru";

function pickProductName(
  p: { nameEn: string; nameAr: string; nameRu: string | null },
  locale: Locale,
): string {
  if (locale === "ar") return p.nameAr;
  if (locale === "ru") return p.nameRu ?? p.nameEn;
  return p.nameEn;
}

/**
 * Fetch a cart by id with all relations needed for the UI.
 * Returns null if cart doesn't exist or has no items.
 */
export async function getCartProjection(
  cartId: string,
  locale: Locale,
): Promise<CartProjection | null> {
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            include: {
              category: {
                select: {
                  slug: true,
                  ...LIVE_CATEGORY_SELECT,
                },
              },
              images: {
                orderBy: { displayOrder: "asc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!cart) return null;

  const now = new Date();

  const lines: CartLineProjection[] = cart.items.map((item) => {
    const unitPrice = Number(item.product.price);
    const compareAt = item.product.compareAtPrice
      ? Number(item.product.compareAtPrice)
      : null;

    return {
      id: item.id,
      productSku: item.productSku,
      productSlug: item.product.slugEn,
      categorySlug: item.product.category.slug,
      productName: pickProductName(item.product, locale),
      productImageUrl: item.product.images[0]?.storageKey ?? null,
      unitPriceAed: unitPrice,
      compareAtPriceAed: compareAt,
      quantity: item.quantity,
      stockQuantity: item.product.stockQuantity,
      available:
        item.product.deletedAt === null &&
        item.product.publishStatus === "PUBLISHED" &&
        isLiveCategory(item.product.category),
      requiresIdVerification: item.product.requiresIdVerification,
      lineSubtotalAed: multiplyMoney(unitPrice, item.quantity),
      loyaltyRule: effectiveLoyaltyRule(
        {
          rule: item.product.loyaltyRule,
          multiplier: item.product.loyaltyMultiplier?.toNumber() ?? null,
          fixedPoints: item.product.loyaltyPointsEarn,
          startsAt: item.product.loyaltyRuleStartsAt?.toISOString() ?? null,
          endsAt: item.product.loyaltyRuleEndsAt?.toISOString() ?? null,
        },
        now,
      ),
    };
  });

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotalAed = lines.reduce(
    (sum, l) => sum + l.unitPriceAed * l.quantity,
    0,
  );
  const grandTotalAed = subtotalAed;
  const hasRestrictedItems = lines.some((l) => l.requiresIdVerification);
  const blocked = lines.some((l) => !l.available || l.stockQuantity < 1);

  const [offer, loyaltyProgram] = await Promise.all([
    getFreeShippingOffer(),
    getSetting("loyalty_program"),
  ]);
  const freeShippingEnabled = offer !== null;
  const freeShippingThresholdAed = offer?.thresholdAed ?? 0;
  const freeShippingEligible =
    freeShippingEnabled && grandTotalAed >= freeShippingThresholdAed;
  const freeShippingRemainingAed =
    freeShippingEnabled && !freeShippingEligible
      ? roundMoney(freeShippingThresholdAed - grandTotalAed)
      : 0;

  return {
    id: cart.id,
    items: lines,
    totals: {
      itemCount,
      subtotalAed,
      grandTotalAed,
      freeShippingEnabled,
      freeShippingThresholdAed,
      freeShippingEligible,
      freeShippingRemainingAed,
      blocked,
    },
    hasRestrictedItems,
    loyalty: {
      enabled: loyaltyProgram.enabled,
      earnRate: loyaltyProgram.earnRate,
      points: loyaltyProgram.enabled
        ? computeOrderPointsWithRules({
            lines: lines.map((l) => ({
              lineTotal: l.lineSubtotalAed.toFixed(2),
              quantity: l.quantity,
              rule: l.loyaltyRule,
            })),
            discountTotal: "0.00",
            earnRate: loyaltyProgram.earnRate,
          })
        : 0,
    },
  };
}

/**
 * Find the active cart for a customer.
 * Customer may have multiple cart rows historically; return most recent.
 */
export async function findCustomerCartId(
  customerId: string,
): Promise<string | null> {
  const cart = await db.cart.findFirst({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return cart?.id ?? null;
}

/**
 * Find a cart by guest token.
 */
export async function findGuestCartId(
  guestToken: string,
): Promise<string | null> {
  const cart = await db.cart.findUnique({
    where: { guestToken },
    select: { id: true },
  });
  return cart?.id ?? null;
}
