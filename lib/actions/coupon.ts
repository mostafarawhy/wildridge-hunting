"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { Prisma } from "@/app/generated/prisma/client";
import { CouponType } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { findCustomerCartId, getCartProjection } from "@/lib/db/queries/cart";
import { resolveCoupon } from "@/lib/db/queries/coupon";
import { getEffectiveCouponRole } from "@/lib/utils/shop-mode";
import {
  CreateCouponSchema,
  RotateCouponSchema,
  UpdateCouponSchema,
} from "@/lib/validations/coupon";

export type ValidateCouponErrorCode =
  | "UNAUTHENTICATED"
  | "EMPTY_CART"
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "ROLE_NOT_ALLOWED"
  | "MIN_ORDER_NOT_MET"
  | "USAGE_LIMIT_REACHED"
  | "FREE_SHIPPING_NOT_APPLICABLE"
  | "INTERNAL_ERROR";

export type ValidateCouponResult =
  | {
      success: true;
      data: { code: string; discountAmount: number; freeShipping: boolean };
    }
  | { success: false; error: string; errorCode: ValidateCouponErrorCode };

export async function validateCouponAction(
  rawCode: string,
  locale: "en" | "ar" | "ru",
  quoteRequired: boolean = false,
): Promise<ValidateCouponResult> {
  try {
    const customerId = await getSessionCustomerId();
    if (!customerId) {
      return {
        success: false,
        error: "You must be logged in.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    if (!rawCode.trim()) {
      return { success: false, error: "Enter a code.", errorCode: "NOT_FOUND" };
    }

    const [customer, cartId] = await Promise.all([
      db.customer.findUnique({
        where: { id: customerId },
        select: { role: true },
      }),
      findCustomerCartId(customerId),
    ]);

    if (!customer) {
      return {
        success: false,
        error: "You must be logged in.",
        errorCode: "UNAUTHENTICATED",
      };
    }

    const cart = cartId ? await getCartProjection(cartId, locale) : null;
    if (!cart || cart.items.length === 0) {
      return {
        success: false,
        error: "Your cart is empty.",
        errorCode: "EMPTY_CART",
      };
    }

    const goodsTotal = cart.totals.subtotalAed;

    const effectiveRole = await getEffectiveCouponRole(customerId);

    const resolution = await resolveCoupon(rawCode, {
      customerId,
      role: effectiveRole,
      goodsTotal,
      shippingCost: 0,
    });

    if (!resolution.valid) {
      return {
        success: false,
        error: "This code can't be applied.",
        errorCode: resolution.reason,
      };
    }

    if (quoteRequired && resolution.freeShipping) {
      return {
        success: false,
        error: "Free shipping isn't available for this destination.",
        errorCode: "FREE_SHIPPING_NOT_APPLICABLE",
      };
    }

    return {
      success: true,
      data: {
        code: resolution.code,
        discountAmount: resolution.discountAmount,
        freeShipping: resolution.freeShipping,
      },
    };
  } catch (err) {
    console.error("[validateCouponAction]", err);
    return {
      success: false,
      error: "Something went wrong.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

// --- Admin mutations ---

export type CouponActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CODE_TAKEN"
  | "COUPON_HAS_REDEMPTIONS"
  | "CUSTOMER_BOUND"
  | "INTERNAL_ERROR";

export type CouponActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: CouponActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleCouponError(err: unknown, tag: string): CouponActionResult {
  const prismaCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : undefined;

  if (prismaCode === "P2002") {
    return {
      success: false,
      error: "A coupon with this code already exists.",
      errorCode: "CODE_TAKEN",
    };
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Coupon not found.",
          errorCode: "NOT_FOUND",
        };
      case "COUPON_HAS_REDEMPTIONS":
        return {
          success: false,
          error: "Cannot delete a coupon that has already been redeemed.",
          errorCode: "COUPON_HAS_REDEMPTIONS",
        };
      case "CUSTOMER_BOUND":
        return {
          success: false,
          error:
            "Codes issued to one customer can't be replaced. Pause it and create a new code instead.",
          errorCode: "CUSTOMER_BOUND",
        };
    }
  }

  console.error(`[${tag}]`, err);
  return {
    success: false,
    error: "An unexpected error occurred.",
    errorCode: "INTERNAL_ERROR",
  };
}

export async function createCouponAction(
  raw: unknown,
): Promise<CouponActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = CreateCouponSchema.safeParse(raw);
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
  const code = data.code.trim().toUpperCase();
  const value = data.type === CouponType.FREE_SHIPPING ? 0 : data.value;

  try {
    const coupon = await db.$transaction(
      async (tx) => {
        const created = await tx.coupon.create({
          data: {
            code,
            type: data.type,
            value,
            minOrderAmount: data.minOrderAmount,
            maxDiscountAmount:
              data.type === CouponType.PERCENTAGE
                ? data.maxDiscountAmount
                : null,
            usageLimit: data.usageLimit,
            startsAt: data.startsAt ? new Date(data.startsAt) : null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
            allowedRole: data.allowedRole,
            isActive: data.isActive,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.create",
            entityType: "Coupon",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: { ...data, code, value } as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons");
    return { success: true, data: { id: coupon.id } };
  } catch (err) {
    return handleCouponError(err, "createCouponAction");
  }
}

export async function updateCouponAction(
  id: string,
  raw: unknown,
): Promise<CouponActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = UpdateCouponSchema.safeParse(raw);
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
  const value = data.type === CouponType.FREE_SHIPPING ? 0 : data.value;

  try {
    await db.$transaction(
      async (tx) => {
        const coupon = await tx.coupon.findUnique({
          where: { id },
          select: {
            id: true,
            type: true,
            value: true,
            minOrderAmount: true,
            maxDiscountAmount: true,
            usageLimit: true,
            startsAt: true,
            endsAt: true,
            allowedRole: true,
            isActive: true,
          },
        });
        if (!coupon) throw new Error("NOT_FOUND");

        await tx.coupon.update({
          where: { id },
          data: {
            type: data.type,
            value,
            minOrderAmount: data.minOrderAmount,
            maxDiscountAmount:
              data.type === CouponType.PERCENTAGE
                ? data.maxDiscountAmount
                : null,
            usageLimit: data.usageLimit,
            startsAt: data.startsAt ? new Date(data.startsAt) : null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
            allowedRole: data.allowedRole,
            isActive: data.isActive,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.update",
            entityType: "Coupon",
            entityId: id,
            before: {
              type: coupon.type,
              value: coupon.value,
              minOrderAmount: coupon.minOrderAmount,
              maxDiscountAmount: coupon.maxDiscountAmount,
              usageLimit: coupon.usageLimit,
              startsAt: coupon.startsAt,
              endsAt: coupon.endsAt,
              allowedRole: coupon.allowedRole,
              isActive: coupon.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: { ...data, value } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons");
    return { success: true, data: { id } };
  } catch (err) {
    return handleCouponError(err, "updateCouponAction");
  }
}

export async function toggleCouponAction(
  id: string,
): Promise<CouponActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const coupon = await tx.coupon.findUnique({
          where: { id },
          select: { id: true, isActive: true },
        });
        if (!coupon) throw new Error("NOT_FOUND");

        await tx.coupon.update({
          where: { id },
          data: { isActive: !coupon.isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.toggle",
            entityType: "Coupon",
            entityId: id,
            before: {
              isActive: coupon.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: {
              isActive: !coupon.isActive,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons");
    return { success: true, data: { id } };
  } catch (err) {
    return handleCouponError(err, "toggleCouponAction");
  }
}

export async function deleteCouponAction(
  id: string,
): Promise<CouponActionResult> {
  const demoRefusal = await demoGate("delete");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("coupon:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const coupon = await tx.coupon.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
            minOrderAmount: true,
            maxDiscountAmount: true,
            usageLimit: true,
            usedCount: true,
            startsAt: true,
            endsAt: true,
            allowedRole: true,
            isActive: true,
            customerId: true,
            sourceRuleId: true,
            _count: { select: { redemptions: true } },
          },
        });
        if (!coupon) throw new Error("NOT_FOUND");
        if (coupon.usedCount > 0 || coupon._count.redemptions > 0)
          throw new Error("COUPON_HAS_REDEMPTIONS");

        await tx.coupon.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.delete",
            entityType: "Coupon",
            entityId: id,
            before: {
              id: coupon.id,
              code: coupon.code,
              type: coupon.type,
              value: coupon.value,
              minOrderAmount: coupon.minOrderAmount,
              maxDiscountAmount: coupon.maxDiscountAmount,
              usageLimit: coupon.usageLimit,
              usedCount: coupon.usedCount,
              startsAt: coupon.startsAt,
              endsAt: coupon.endsAt,
              allowedRole: coupon.allowedRole,
              isActive: coupon.isActive,
              customerId: coupon.customerId,
              sourceRuleId: coupon.sourceRuleId,
            } as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons");
    return { success: true, data: { id } };
  } catch (err) {
    return handleCouponError(err, "deleteCouponAction");
  }
}

export async function rotateCouponAction(
  sourceId: string,
  raw: unknown,
): Promise<CouponActionResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = RotateCouponSchema.safeParse(raw);
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
  const code = data.code.trim().toUpperCase();

  try {
    const created = await db.$transaction(
      async (tx) => {
        const source = await tx.coupon.findUnique({
          where: { id: sourceId },
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
            minOrderAmount: true,
            maxDiscountAmount: true,
            usageLimit: true,
            allowedRole: true,
            customerId: true,
          },
        });
        if (!source) throw new Error("NOT_FOUND");
        if (source.customerId != null) throw new Error("CUSTOMER_BOUND");

        const newCoupon = await tx.coupon.create({
          data: {
            code,
            type: source.type,
            value: source.value,
            minOrderAmount: source.minOrderAmount,
            maxDiscountAmount: source.maxDiscountAmount,
            usageLimit: source.usageLimit,
            allowedRole: source.allowedRole,
            startsAt: data.startsAt ? new Date(data.startsAt) : null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
            isActive: true,
          },
          select: { id: true },
        });

        await tx.coupon.update({
          where: { id: sourceId },
          data: { isActive: false },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.rotate_out",
            entityType: "Coupon",
            entityId: source.id,
            before: {
              isActive: true,
              code: source.code,
            } as unknown as Prisma.InputJsonValue,
            after: {
              isActive: false,
              rotatedToId: newCoupon.id,
              rotatedToCode: code,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "coupon.rotate",
            entityType: "Coupon",
            entityId: newCoupon.id,
            before: {
              sourceId: source.id,
              sourceCode: source.code,
            } as unknown as Prisma.InputJsonValue,
            after: {
              id: newCoupon.id,
              code,
              type: source.type,
              value: source.value,
              minOrderAmount: source.minOrderAmount,
              maxDiscountAmount: source.maxDiscountAmount,
              usageLimit: source.usageLimit,
              allowedRole: source.allowedRole,
              startsAt: data.startsAt,
              endsAt: data.endsAt,
              sourceId: source.id,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return newCoupon;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/coupons");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    return handleCouponError(err, "rotateCouponAction");
  }
}
