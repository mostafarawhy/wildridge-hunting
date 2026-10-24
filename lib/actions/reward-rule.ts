"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { CouponType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import {
  CreateRewardRuleSchema,
  UpdateRewardRuleSchema,
} from "@/lib/validations/reward-rule";

export type RewardRuleActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type RewardRuleActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: RewardRuleActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleRewardRuleError(
  err: unknown,
  tag: string,
): RewardRuleActionResult {
  if (err instanceof Error && err.message === "NOT_FOUND") {
    return {
      success: false,
      error: "Reward rule not found.",
      errorCode: "NOT_FOUND",
    };
  }

  console.error(`[${tag}]`, err);
  return {
    success: false,
    error: "An unexpected error occurred.",
    errorCode: "INTERNAL_ERROR",
  };
}

export async function createRewardRuleAction(
  raw: unknown,
): Promise<RewardRuleActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = CreateRewardRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;
  const codePrefix = data.codePrefix.trim().toUpperCase();
  const rewardValue =
    data.rewardType === CouponType.FREE_SHIPPING ? 0 : data.rewardValue;
  const rewardMaxDiscountAmount =
    data.rewardType === CouponType.PERCENTAGE
      ? data.rewardMaxDiscountAmount
      : null;

  try {
    const rule = await db.$transaction(
      async (tx) => {
        const created = await tx.couponRewardRule.create({
          data: {
            name: data.name,
            minOrderTotal: data.minOrderTotal,
            rewardType: data.rewardType,
            rewardValue,
            rewardMaxDiscountAmount,
            rewardMinOrderAmount: data.rewardMinOrderAmount,
            validityDays: data.validityDays,
            codePrefix,
            isActive: data.isActive,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "reward_rule.create",
            entityType: "CouponRewardRule",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: {
              ...data,
              codePrefix,
              rewardValue,
              rewardMaxDiscountAmount,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons/rewards");
    return { success: true, data: { id: rule.id } };
  } catch (err) {
    return handleRewardRuleError(err, "createRewardRuleAction");
  }
}

export async function updateRewardRuleAction(
  id: string,
  raw: unknown,
): Promise<RewardRuleActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = UpdateRewardRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;
  const codePrefix = data.codePrefix.trim().toUpperCase();
  const rewardValue =
    data.rewardType === CouponType.FREE_SHIPPING ? 0 : data.rewardValue;
  const rewardMaxDiscountAmount =
    data.rewardType === CouponType.PERCENTAGE
      ? data.rewardMaxDiscountAmount
      : null;

  try {
    await db.$transaction(
      async (tx) => {
        const rule = await tx.couponRewardRule.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            minOrderTotal: true,
            rewardType: true,
            rewardValue: true,
            rewardMaxDiscountAmount: true,
            rewardMinOrderAmount: true,
            validityDays: true,
            codePrefix: true,
            isActive: true,
          },
        });
        if (!rule) throw new Error("NOT_FOUND");

        await tx.couponRewardRule.update({
          where: { id },
          data: {
            name: data.name,
            minOrderTotal: data.minOrderTotal,
            rewardType: data.rewardType,
            rewardValue,
            rewardMaxDiscountAmount,
            rewardMinOrderAmount: data.rewardMinOrderAmount,
            validityDays: data.validityDays,
            codePrefix,
            isActive: data.isActive,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "reward_rule.update",
            entityType: "CouponRewardRule",
            entityId: id,
            before: {
              name: rule.name,
              minOrderTotal: rule.minOrderTotal,
              rewardType: rule.rewardType,
              rewardValue: rule.rewardValue,
              rewardMaxDiscountAmount: rule.rewardMaxDiscountAmount,
              rewardMinOrderAmount: rule.rewardMinOrderAmount,
              validityDays: rule.validityDays,
              codePrefix: rule.codePrefix,
              isActive: rule.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: {
              ...data,
              codePrefix,
              rewardValue,
              rewardMaxDiscountAmount,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons/rewards");
    return { success: true, data: { id } };
  } catch (err) {
    return handleRewardRuleError(err, "updateRewardRuleAction");
  }
}

export async function toggleRewardRuleAction(
  id: string,
): Promise<RewardRuleActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const rule = await tx.couponRewardRule.findUnique({
          where: { id },
          select: { id: true, isActive: true },
        });
        if (!rule) throw new Error("NOT_FOUND");

        await tx.couponRewardRule.update({
          where: { id },
          data: { isActive: !rule.isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "reward_rule.toggle",
            entityType: "CouponRewardRule",
            entityId: id,
            before: {
              isActive: rule.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: {
              isActive: !rule.isActive,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons/rewards");
    return { success: true, data: { id } };
  } catch (err) {
    return handleRewardRuleError(err, "toggleRewardRuleAction");
  }
}
