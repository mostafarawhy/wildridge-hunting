import "server-only";

import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { buildRewardCode } from "@/lib/utils/coupon-code";

export type IssueRewardResult =
  | { success: true; data: { issued: boolean; couponId: string | null } }
  | { success: false; error: string };

const MAX_CODE_ATTEMPTS = 5;

export async function issueRewardCouponForOrder(
  orderId: string,
): Promise<IssueRewardResult> {
  try {
    return await db.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, customerId: true, total: true, deliveredAt: true },
        });
        if (!order) return { success: false as const, error: "Order not found." };

        const orderTotal = order.total.toNumber();

        const rule = await tx.couponRewardRule.findFirst({
          where: { isActive: true, minOrderTotal: { lte: order.total } },
          orderBy: { minOrderTotal: "desc" },
        });
        if (!rule) return { success: true as const, data: { issued: false, couponId: null } };

        const existing = await tx.coupon.findUnique({
          where: {
            sourceRuleId_sourceOrderId: {
              sourceRuleId: rule.id,
              sourceOrderId: order.id,
            },
          },
          select: { id: true },
        });
        if (existing) return { success: true as const, data: { issued: false, couponId: existing.id } };

        const issuedAt = order.deliveredAt ?? new Date();
        const endsAt = new Date(issuedAt);
        endsAt.setDate(endsAt.getDate() + rule.validityDays);

        let created: { id: string } | null = null;
        for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
          const code = buildRewardCode(rule.codePrefix);
          try {
            created = await tx.coupon.create({
              data: {
                code,
                type: rule.rewardType,
                value: rule.rewardValue,
                minOrderAmount: rule.rewardMinOrderAmount,
                maxDiscountAmount:
                  rule.rewardType === "PERCENTAGE"
                    ? rule.rewardMaxDiscountAmount
                    : null,
                usageLimit: 1,
                startsAt: issuedAt,
                endsAt,
                isActive: true,
                allowedRole: null,
                customerId: order.customerId,
                sourceRuleId: rule.id,
                sourceOrderId: order.id,
              },
              select: { id: true },
            });
            break;
          } catch (err) {
            const isDup =
              typeof err === "object" && err !== null && "code" in err &&
              (err as { code: string }).code === "P2002";
            const target =
              err instanceof Prisma.PrismaClientKnownRequestError
                ? (err.meta?.target as string[] | string | undefined)
                : undefined;
            const targetStr = Array.isArray(target) ? target.join(",") : String(target ?? "");
            if (isDup && targetStr.includes("sourceRuleId")) {
              const dup = await tx.coupon.findUnique({
                where: {
                  sourceRuleId_sourceOrderId: {
                    sourceRuleId: rule.id,
                    sourceOrderId: order.id,
                  },
                },
                select: { id: true },
              });
              return { success: true as const, data: { issued: false, couponId: dup?.id ?? null } };
            }
            if (isDup) continue;
            throw err;
          }
        }

        if (!created) {
          return { success: false as const, error: "Could not generate a unique code." };
        }

        await tx.auditLog.create({
          data: {
            actorType: "SYSTEM",
            actorId: null,
            action: "coupon.issue",
            entityType: "Coupon",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: {
              code: `${rule.codePrefix}-*****`,
              customerId: order.customerId,
              sourceRuleId: rule.id,
              sourceRuleName: rule.name,
              sourceOrderId: order.id,
              orderTotal,
              rewardType: rule.rewardType,
              rewardValue: rule.rewardValue.toNumber(),
              endsAt: endsAt.toISOString(),
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return { success: true as const, data: { issued: true, couponId: created.id } };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    console.error("[issueRewardCouponForOrder]", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
