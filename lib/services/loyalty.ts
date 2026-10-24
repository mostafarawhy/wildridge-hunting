import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { getSetting } from "@/lib/db/queries/settings";
import { multiplyMoney, roundMoney } from "@/lib/utils/currency";
import {
  computeOrderPoints,
  computeOrderPointsWithRules,
  effectiveLoyaltyRule,
  sumMoneyStrings,
  type EffectiveLoyaltyRule,
} from "@/lib/utils/loyalty-points";

export async function freezeOrderPoints(
  tx: Prisma.TransactionClient,
  input: {
    items: { productSku: string; unitPriceAed: number; quantity: number }[];
    discountAmount: number;
    program: { enabled: boolean; earnRate: number };
    at: Date;
  },
): Promise<number> {
  if (!input.program.enabled) return 0;

  const products = await tx.product.findMany({
    where: { sku: { in: input.items.map((i) => i.productSku) } },
    select: {
      sku: true,
      loyaltyRule: true,
      loyaltyMultiplier: true,
      loyaltyPointsEarn: true,
      loyaltyRuleStartsAt: true,
      loyaltyRuleEndsAt: true,
    },
  });
  const bySku = new Map(products.map((p) => [p.sku, p] as const));

  const lines = input.items.map((item) => {
    const p = bySku.get(item.productSku);
    const rule: EffectiveLoyaltyRule = p
      ? effectiveLoyaltyRule(
          {
            rule: p.loyaltyRule,
            multiplier: p.loyaltyMultiplier?.toNumber() ?? null,
            fixedPoints: p.loyaltyPointsEarn,
            startsAt: p.loyaltyRuleStartsAt?.toISOString() ?? null,
            endsAt: p.loyaltyRuleEndsAt?.toISOString() ?? null,
          },
          input.at,
        )
      : { kind: "STANDARD" };
    return {
      lineTotal: multiplyMoney(item.unitPriceAed, item.quantity).toFixed(2),
      quantity: item.quantity,
      rule,
    };
  });

  return computeOrderPointsWithRules({
    lines,
    discountTotal: roundMoney(input.discountAmount).toFixed(2),
    earnRate: input.program.earnRate,
  });
}

export type AwardLoyaltyErrorCode =
  | "ORDER_NOT_FOUND"
  | "ALREADY_AWARDED"
  | "INTERNAL_ERROR";

export type AwardLoyaltyResult =
  | { success: true; data: { pointsAwarded: number; newBalance: number } }
  | { success: false; error: string; errorCode: AwardLoyaltyErrorCode };

export async function awardLoyaltyForOrder(
  orderId: string,
): Promise<AwardLoyaltyResult> {
  try {
    const program = await getSetting("loyalty_program");

    return await db.$transaction(
      async (tx) => {
        const existing = await tx.loyaltyTransaction.findFirst({
          where: { reference: orderId, type: "EARNED" },
          select: { id: true },
        });

        if (existing) {
          return {
            success: false,
            error: "Loyalty points already awarded for this order.",
            errorCode: "ALREADY_AWARDED" as const,
          };
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            discountAmount: true,
            loyaltyDiscountAmount: true,
            loyaltyPointsEarned: true,
            loyaltyPointsFrozenAt: true,
            items: {
              select: {
                itemType: true,
                quantity: true,
                lineTotal: true,
                product: { select: { loyaltyPointsEarn: true } },
              },
            },
            convertedFromQuote: { select: { id: true } },
          },
        });

        if (!order) {
          return {
            success: false,
            error: "Order not found.",
            errorCode: "ORDER_NOT_FOUND" as const,
          };
        }

        const customer = await tx.customer.findUniqueOrThrow({
          where: { id: order.customerId },
          select: { loyaltyPoints: true },
        });

        const frozen = order.loyaltyPointsFrozenAt !== null;

        if (!frozen && (!program.enabled || order.convertedFromQuote !== null)) {
          return {
            success: true,
            data: { pointsAwarded: 0, newBalance: customer.loyaltyPoints },
          };
        }

        const points = frozen
          ? order.loyaltyPointsEarned
          : computeOrderPoints({
              lines: order.items.map((item) => ({
                lineTotal: item.lineTotal.toFixed(2),
                quantity: item.quantity,
                fixedPoints:
                  item.itemType === "ADDON"
                    ? 0
                    : (item.product?.loyaltyPointsEarn ?? 0),
              })),
              discountTotal: sumMoneyStrings([
                order.discountAmount.toFixed(2),
                order.loyaltyDiscountAmount.toFixed(2),
              ]),
              earnRate: program.earnRate,
            });

        if (points === 0) {
          return {
            success: true,
            data: { pointsAwarded: 0, newBalance: customer.loyaltyPoints },
          };
        }

        const newBalance = customer.loyaltyPoints + points;

        await tx.customer.update({
          where: { id: order.customerId },
          data: { loyaltyPoints: { increment: points } },
        });

        await tx.loyaltyTransaction.create({
          data: {
            customerId: order.customerId,
            orderId: order.id,
            type: "EARNED",
            delta: points,
            balanceAfter: newBalance,
            reason: "Purchase reward",
            reference: orderId,
          },
        });

        if (!frozen) {
          await tx.order.update({
            where: { id: order.id },
            data: { loyaltyPointsEarned: points },
          });
        }

        return {
          success: true,
          data: { pointsAwarded: points, newBalance },
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    console.error("[awardLoyaltyForOrder]", err);
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export class InsufficientPointsError extends Error {
  constructor() {
    super("INSUFFICIENT_POINTS");
  }
}

async function heldOrderPoints(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<number> {
  const agg = await tx.loyaltyTransaction.aggregate({
    where: { orderId, type: { in: ["REDEEMED", "REFUNDED"] } },
    _sum: { delta: true },
  });
  return -(agg._sum.delta ?? 0);
}

export async function spendOrderPoints(
  tx: Prisma.TransactionClient,
  input: { customerId: string; orderId: string; points: number },
): Promise<void> {
  if (input.points <= 0) return;
  if ((await heldOrderPoints(tx, input.orderId)) > 0) return;
  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { loyaltyPoints: true },
  });
  if (customer.loyaltyPoints < input.points) throw new InsufficientPointsError();
  await tx.customer.update({
    where: { id: input.customerId },
    data: { loyaltyPoints: { decrement: input.points } },
  });
  await tx.loyaltyTransaction.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      type: "REDEEMED",
      delta: -input.points,
      balanceAfter: customer.loyaltyPoints - input.points,
      reason: "Spent at checkout",
      reference: input.orderId,
    },
  });
}

export async function returnOrderPoints(
  tx: Prisma.TransactionClient,
  input: { customerId: string; orderId: string; reason?: string },
): Promise<number> {
  const held = await heldOrderPoints(tx, input.orderId);
  if (held <= 0) return 0;
  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { loyaltyPoints: true },
  });
  await tx.customer.update({
    where: { id: input.customerId },
    data: { loyaltyPoints: { increment: held } },
  });
  await tx.loyaltyTransaction.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      type: "REFUNDED",
      delta: held,
      balanceAfter: customer.loyaltyPoints + held,
      reason: input.reason ?? "Returned after a failed payment",
      reference: input.orderId,
    },
  });
  return held;
}
