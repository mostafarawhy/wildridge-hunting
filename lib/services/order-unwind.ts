import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import {
  LIVE_CATEGORY_SELECT,
  isLiveCategory,
} from "@/lib/utils/catalog-visibility";

export interface UnwoundStockLine {
  sku: string;
  units: number;
}

export class ItemUnavailableError extends Error {
  constructor(public readonly sku: string) {
    super(`Item unavailable: ${sku}`);
    this.name = "ItemUnavailableError";
  }
}

export async function holdOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<UnwoundStockLine[]> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      convertedFromQuote: { select: { id: true } },
      items: {
        select: {
          itemType: true,
          productSku: true,
          addonId: true,
          quantity: true,
        },
      },
    },
  });
  if (!order || order.convertedFromQuote) return [];

  const unitsBySku = new Map<string, number>();
  for (const item of order.items) {
    const sku =
      item.itemType === "PRODUCT"
        ? item.productSku
        : item.itemType === "ADDON"
          ? item.addonId
          : null;
    if (!sku) continue;
    unitsBySku.set(sku, (unitsBySku.get(sku) ?? 0) + item.quantity);
  }

  const reads: { sku: string; units: number; before: number }[] = [];
  for (const [sku, units] of unitsBySku) {
    const product = await tx.product.findUnique({
      where: { sku },
      select: {
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
      !isLiveCategory(product.category) ||
      product.stockQuantity < units
    ) {
      throw new ItemUnavailableError(sku);
    }
    reads.push({ sku, units, before: product.stockQuantity });
  }

  const lines: UnwoundStockLine[] = [];
  for (const { sku, units, before } of reads) {
    await tx.product.update({
      where: { sku },
      data: {
        stockQuantity: { decrement: units },
        reservedQuantity: { increment: units },
      },
    });

    await tx.stockMovement.create({
      data: {
        productSku: sku,
        delta: -units,
        quantityBefore: before,
        quantityAfter: before - units,
        type: "SALE",
        reference: orderId,
        staffId: null,
        reason: "Payment retried",
      },
    });

    lines.push({ sku, units });
  }
  return lines;
}

export async function orderReceived(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<number> {
  const rows = await tx.orderPayment.findMany({
    where: { orderId },
    select: { amount: true },
  });
  if (rows.length > 0) {
    return sumMoney(rows.map((row) => Number(row.amount)));
  }
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { total: true, paidAt: true },
  });
  if (order?.paidAt) return roundMoney(Number(order.total));
  return 0;
}

export async function unwindStock(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    staffId: string | null;
    reason: string;
    releaseReservation: boolean;
  },
): Promise<UnwoundStockLine[]> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { convertedFromQuote: { select: { id: true } } },
  });
  if (!order || order.convertedFromQuote) return [];

  const grouped = await tx.stockMovement.groupBy({
    by: ["productSku"],
    where: { reference: input.orderId },
    _sum: { delta: true },
  });

  const lines: UnwoundStockLine[] = [];
  for (const group of grouped) {
    const net = group._sum.delta ?? 0;
    if (net >= 0) continue;
    const units = -net;

    const snap = await tx.product.findUnique({
      where: { sku: group.productSku },
      select: { stockQuantity: true },
    });
    if (!snap) continue;
    const before = snap.stockQuantity;

    await tx.product.update({
      where: { sku: group.productSku },
      data: {
        stockQuantity: { increment: units },
        ...(input.releaseReservation
          ? { reservedQuantity: { decrement: units } }
          : {}),
      },
    });

    await tx.stockMovement.create({
      data: {
        productSku: group.productSku,
        delta: units,
        quantityBefore: before,
        quantityAfter: before + units,
        type: "RETURN",
        reference: input.orderId,
        staffId: input.staffId,
        reason: input.reason,
      },
    });

    lines.push({ sku: group.productSku, units });
  }
  return lines;
}

export async function reverseEarnedPoints(
  tx: Prisma.TransactionClient,
  input: { customerId: string; orderId: string; reason: string },
): Promise<{ reversed: number; shortfall: number }> {
  const agg = await tx.loyaltyTransaction.groupBy({
    by: ["type"],
    where: {
      orderId: input.orderId,
      type: { in: ["EARNED", "REVERSED"] },
    },
    _sum: { delta: true },
  });
  const earned = agg.reduce((acc, row) => acc + (row._sum.delta ?? 0), 0);
  if (earned <= 0) return { reversed: 0, shortfall: 0 };

  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { loyaltyPoints: true },
  });
  const take = Math.min(earned, Math.max(customer.loyaltyPoints, 0));

  if (take > 0) {
    await tx.customer.update({
      where: { id: input.customerId },
      data: { loyaltyPoints: { decrement: take } },
    });
    await tx.loyaltyTransaction.create({
      data: {
        customerId: input.customerId,
        orderId: input.orderId,
        type: "REVERSED",
        delta: -take,
        balanceAfter: customer.loyaltyPoints - take,
        reason:
          take < earned
            ? `${input.reason} (balance allowed ${take} of ${earned})`
            : input.reason,
        reference: input.orderId,
      },
    });
  }

  return { reversed: take, shortfall: earned - take };
}

export async function releaseCoupon(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<string | null> {
  const redemption = await tx.couponRedemption.findUnique({
    where: { orderId },
    select: { id: true, couponId: true, coupon: { select: { code: true } } },
  });
  if (!redemption) return null;

  await tx.coupon.updateMany({
    where: { id: redemption.couponId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
  await tx.couponRedemption.delete({ where: { id: redemption.id } });
  return redemption.coupon.code;
}

export async function deactivateRewardCoupons(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<number> {
  const result = await tx.coupon.updateMany({
    where: { sourceOrderId: orderId, usedCount: 0, isActive: true },
    data: { isActive: false },
  });
  return result.count;
}
