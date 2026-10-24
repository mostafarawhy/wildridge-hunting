"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  CreateShippingMethodSchema,
  UpdateShippingMethodSchema,
} from "@/lib/validations/shipping";

export type ShippingMethodActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CODE_TAKEN"
  | "HAS_RATES"
  | "INTERNAL_ERROR";

export type ShippingMethodActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ShippingMethodActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleShippingMethodError(
  err: unknown,
  tag: string,
): ShippingMethodActionResult {
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
    if (targets.includes("code")) {
      return {
        success: false,
        error: "A method with this code already exists.",
        errorCode: "CODE_TAKEN",
      };
    }
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Shipping method not found.",
          errorCode: "NOT_FOUND",
        };
      case "HAS_RATES":
        return {
          success: false,
          error: "Cannot delete a method that has rates.",
          errorCode: "HAS_RATES",
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

export async function createShippingMethodAction(
  raw: unknown,
): Promise<ShippingMethodActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = CreateShippingMethodSchema.safeParse(raw);
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

  try {
    const method = await db.$transaction(
      async (tx) => {
        const created = await tx.shippingMethod.create({
          data: {
            code: data.code,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            nameRu: data.nameRu,
            isActive: data.isActive,
            freeShippingEligible: data.freeShippingEligible,
            displayOrder: data.displayOrder,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_method.create",
            entityType: "ShippingMethod",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: data as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id: method.id } };
  } catch (err) {
    return handleShippingMethodError(err, "createShippingMethodAction");
  }
}

export async function updateShippingMethodAction(
  id: string,
  raw: unknown,
): Promise<ShippingMethodActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = UpdateShippingMethodSchema.safeParse(raw);
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

  try {
    await db.$transaction(
      async (tx) => {
        const method = await tx.shippingMethod.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            isActive: true,
            freeShippingEligible: true,
            displayOrder: true,
          },
        });
        if (!method) throw new Error("NOT_FOUND");

        await tx.shippingMethod.update({
          where: { id },
          data: {
            code: data.code,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            nameRu: data.nameRu,
            isActive: data.isActive,
            freeShippingEligible: data.freeShippingEligible,
            displayOrder: data.displayOrder,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_method.update",
            entityType: "ShippingMethod",
            entityId: id,
            before: {
              code: method.code,
              nameEn: method.nameEn,
              nameAr: method.nameAr,
              nameRu: method.nameRu,
              isActive: method.isActive,
              freeShippingEligible: method.freeShippingEligible,
              displayOrder: method.displayOrder,
            } as unknown as Prisma.InputJsonValue,
            after: data as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id } };
  } catch (err) {
    return handleShippingMethodError(err, "updateShippingMethodAction");
  }
}

export async function toggleShippingMethodAction(
  id: string,
): Promise<ShippingMethodActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const method = await tx.shippingMethod.findUnique({
          where: { id },
          select: { id: true, isActive: true },
        });
        if (!method) throw new Error("NOT_FOUND");

        await tx.shippingMethod.update({
          where: { id },
          data: { isActive: !method.isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_method.toggle",
            entityType: "ShippingMethod",
            entityId: id,
            before: {
              isActive: method.isActive,
            } as unknown as Prisma.InputJsonValue,
            after: {
              isActive: !method.isActive,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id } };
  } catch (err) {
    return handleShippingMethodError(err, "toggleShippingMethodAction");
  }
}

export async function deleteShippingMethodAction(
  id: string,
): Promise<ShippingMethodActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const method = await tx.shippingMethod.findUnique({
          where: { id },
          select: { id: true, _count: { select: { rates: true } } },
        });
        if (!method) throw new Error("NOT_FOUND");
        if (method._count.rates > 0) throw new Error("HAS_RATES");

        await tx.shippingMethod.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_method.delete",
            entityType: "ShippingMethod",
            entityId: id,
            before: { id } as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id } };
  } catch (err) {
    return handleShippingMethodError(err, "deleteShippingMethodAction");
  }
}
