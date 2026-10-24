"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  CreateShippingRateSchema,
  UpdateShippingRateSchema,
} from "@/lib/validations/shipping";

export type ShippingRateActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_FOUND"
  | "RATE_EXISTS"
  | "INTERNAL_ERROR";

export type ShippingRateActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ShippingRateActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleShippingRateError(
  err: unknown,
  tag: string,
): ShippingRateActionResult {
  const prismaCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : undefined;

  if (prismaCode === "P2002") {
    const rawTarget = (err as { meta?: { target?: string[] | string } }).meta
      ?.target;
    const targets = Array.isArray(rawTarget)
      ? rawTarget.join(",")
      : (rawTarget ?? "");
    if (targets.includes("shippingMethodId")) {
      return {
        success: false,
        error: "A rate for this method already exists in this zone.",
        errorCode: "RATE_EXISTS",
      };
    }
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Shipping rate not found.",
          errorCode: "NOT_FOUND",
        };
      case "METHOD_NOT_FOUND":
        return {
          success: false,
          error: "Shipping method not found.",
          errorCode: "METHOD_NOT_FOUND",
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

export async function createShippingRateAction(
  zoneId: string,
  raw: unknown,
): Promise<ShippingRateActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = CreateShippingRateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { shippingMethodId, basePrice, estimatedDaysMin, estimatedDaysMax, isActive } =
    parsed.data;

  try {
    const rate = await db.$transaction(
      async (tx) => {
        const zone = await tx.shippingZone.findUnique({
          where: { id: zoneId },
          select: { id: true },
        });
        if (!zone) throw new Error("NOT_FOUND");

        const method = await tx.shippingMethod.findUnique({
          where: { id: shippingMethodId },
          select: { id: true },
        });
        if (!method) throw new Error("METHOD_NOT_FOUND");

        const created = await tx.shippingRate.create({
          data: { shippingZoneId: zoneId, shippingMethodId, basePrice, estimatedDaysMin, estimatedDaysMax, isActive },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_rate.create",
            entityType: "ShippingRate",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: { zoneId, shippingMethodId, basePrice, estimatedDaysMin, estimatedDaysMax, isActive } as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/shipping/${zoneId}`);
    revalidatePath("/admin/shipping");
    return { success: true, data: { id: rate.id } };
  } catch (err) {
    return handleShippingRateError(err, "createShippingRateAction");
  }
}

export async function updateShippingRateAction(
  rateId: string,
  raw: unknown,
): Promise<ShippingRateActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = UpdateShippingRateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { basePrice, estimatedDaysMin, estimatedDaysMax, isActive } = parsed.data;

  try {
    const zoneId = await db.$transaction(
      async (tx) => {
        const rate = await tx.shippingRate.findUnique({
          where: { id: rateId },
          select: {
            id: true,
            shippingZoneId: true,
            basePrice: true,
            estimatedDaysMin: true,
            estimatedDaysMax: true,
            isActive: true,
          },
        });
        if (!rate) throw new Error("NOT_FOUND");

        await tx.shippingRate.update({
          where: { id: rateId },
          data: { basePrice, estimatedDaysMin, estimatedDaysMax, isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_rate.update",
            entityType: "ShippingRate",
            entityId: rateId,
            before: {
              basePrice: rate.basePrice,
              estimatedDaysMin: rate.estimatedDaysMin,
              estimatedDaysMax: rate.estimatedDaysMax,
              isActive: rate.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: { basePrice, estimatedDaysMin, estimatedDaysMax, isActive } as unknown as Prisma.InputJsonValue,
          },
        });

        return rate.shippingZoneId;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/shipping/${zoneId}`);
    revalidatePath("/admin/shipping");
    return { success: true, data: { id: rateId } };
  } catch (err) {
    return handleShippingRateError(err, "updateShippingRateAction");
  }
}

export async function deleteShippingRateAction(
  rateId: string,
): Promise<ShippingRateActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    let zoneId: string | undefined;

    await db.$transaction(
      async (tx) => {
        const rate = await tx.shippingRate.findUnique({
          where: { id: rateId },
          select: { id: true, shippingZoneId: true },
        });
        if (!rate) throw new Error("NOT_FOUND");

        zoneId = rate.shippingZoneId;

        await tx.shippingRate.delete({ where: { id: rateId } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_rate.delete",
            entityType: "ShippingRate",
            entityId: rateId,
            before: { id: rateId, shippingZoneId: rate.shippingZoneId } as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (zoneId) {
      revalidatePath(`/admin/shipping/${zoneId}`);
    }
    revalidatePath("/admin/shipping");
    return { success: true, data: { id: rateId } };
  } catch (err) {
    return handleShippingRateError(err, "deleteShippingRateAction");
  }
}

export async function toggleShippingRateAction(
  rateId: string,
  isActive: boolean,
): Promise<ShippingRateActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    let zoneId: string | undefined;

    await db.$transaction(
      async (tx) => {
        const rate = await tx.shippingRate.findUnique({
          where: { id: rateId },
          select: { id: true, shippingZoneId: true, isActive: true },
        });
        if (!rate) throw new Error("NOT_FOUND");

        zoneId = rate.shippingZoneId;

        await tx.shippingRate.update({
          where: { id: rateId },
          data: { isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_rate.toggle",
            entityType: "ShippingRate",
            entityId: rateId,
            before: { isActive: rate.isActive } as unknown as Prisma.InputJsonValue,
            after: { isActive } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (zoneId) {
      revalidatePath(`/admin/shipping/${zoneId}`);
    }
    revalidatePath("/admin/shipping");
    return { success: true, data: { id: rateId } };
  } catch (err) {
    return handleShippingRateError(err, "toggleShippingRateAction");
  }
}
