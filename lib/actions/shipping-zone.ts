"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  CreateShippingZoneSchema,
  UpdateShippingZoneSchema,
  AddZoneCountrySchema,
} from "@/lib/validations/shipping";

export type ShippingZoneActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CODE_TAKEN"
  | "COUNTRY_TAKEN"
  | "COUNTRY_NOT_ALLOWED"
  | "HAS_COUNTRIES"
  | "HAS_RATES"
  | "INTERNAL_ERROR";

export type ShippingZoneActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: ShippingZoneActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleShippingZoneError(
  err: unknown,
  tag: string,
): ShippingZoneActionResult {
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
        error: "A zone with this code already exists.",
        errorCode: "CODE_TAKEN",
      };
    }
    if (targets.includes("country")) {
      return {
        success: false,
        error: "This country is already assigned to a zone.",
        errorCode: "COUNTRY_TAKEN",
      };
    }
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Shipping zone not found.",
          errorCode: "NOT_FOUND",
        };
      case "HAS_COUNTRIES":
        return {
          success: false,
          error: "Cannot delete a zone that has countries assigned.",
          errorCode: "HAS_COUNTRIES",
        };
      case "HAS_RATES":
        return {
          success: false,
          error: "Cannot delete a zone that has rates.",
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

export async function createShippingZoneAction(
  raw: unknown,
): Promise<ShippingZoneActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = CreateShippingZoneSchema.safeParse(raw);
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

  const freeShippingEnabled = data.quoteRequired ? false : data.freeShippingEnabled;
  const freeShippingThreshold = data.quoteRequired ? null : data.freeShippingThreshold;

  try {
    const zone = await db.$transaction(
      async (tx) => {
        const created = await tx.shippingZone.create({
          data: {
            code: data.code,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            nameRu: data.nameRu,
            isActive: data.isActive,
            displayOrder: data.displayOrder,
            freeShippingEnabled,
            freeShippingThreshold,
            quoteRequired: data.quoteRequired,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_zone.create",
            entityType: "ShippingZone",
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
    return { success: true, data: { id: zone.id } };
  } catch (err) {
    return handleShippingZoneError(err, "createShippingZoneAction");
  }
}

export async function updateShippingZoneAction(
  id: string,
  raw: unknown,
): Promise<ShippingZoneActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = UpdateShippingZoneSchema.safeParse(raw);
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

  const freeShippingEnabled = data.quoteRequired ? false : data.freeShippingEnabled;
  const freeShippingThreshold = data.quoteRequired ? null : data.freeShippingThreshold;

  try {
    await db.$transaction(
      async (tx) => {
        const zone = await tx.shippingZone.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            isActive: true,
            displayOrder: true,
            freeShippingEnabled: true,
            freeShippingThreshold: true,
            quoteRequired: true,
          },
        });
        if (!zone) throw new Error("NOT_FOUND");

        await tx.shippingZone.update({
          where: { id },
          data: {
            code: data.code,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            nameRu: data.nameRu,
            isActive: data.isActive,
            displayOrder: data.displayOrder,
            freeShippingEnabled,
            freeShippingThreshold,
            quoteRequired: data.quoteRequired,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_zone.update",
            entityType: "ShippingZone",
            entityId: id,
            before: {
              code: zone.code,
              nameEn: zone.nameEn,
              nameAr: zone.nameAr,
              nameRu: zone.nameRu,
              isActive: zone.isActive,
              displayOrder: zone.displayOrder,
              freeShippingEnabled: zone.freeShippingEnabled,
              freeShippingThreshold: zone.freeShippingThreshold,
              quoteRequired: zone.quoteRequired,
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
    return handleShippingZoneError(err, "updateShippingZoneAction");
  }
}

export async function deleteShippingZoneAction(
  id: string,
): Promise<ShippingZoneActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const zone = await tx.shippingZone.findUnique({
          where: { id },
          select: {
            id: true,
            _count: {
              select: {
                countries: true,
                rates: true,
              },
            },
          },
        });
        if (!zone) throw new Error("NOT_FOUND");
        if (zone._count.countries > 0) throw new Error("HAS_COUNTRIES");
        if (zone._count.rates > 0) throw new Error("HAS_RATES");

        await tx.shippingZone.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_zone.delete",
            entityType: "ShippingZone",
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
    return handleShippingZoneError(err, "deleteShippingZoneAction");
  }
}

export async function addZoneCountryAction(
  zoneId: string,
  raw: unknown,
): Promise<ShippingZoneActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  const parsed = AddZoneCountrySchema.safeParse(raw);
  if (!parsed.success) {
    const isCountryNotAllowed = parsed.error.issues.some(
      (issue) => issue.message === "Not a recognized country",
    );
    return {
      success: false,
      error: "Validation failed.",
      errorCode: isCountryNotAllowed ? "COUNTRY_NOT_ALLOWED" : "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const { country } = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const zone = await tx.shippingZone.findUnique({
          where: { id: zoneId },
          select: { id: true },
        });
        if (!zone) throw new Error("NOT_FOUND");

        await tx.shippingZoneCountry.create({
          data: { shippingZoneId: zoneId, country },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_zone.country.add",
            entityType: "ShippingZone",
            entityId: zoneId,
            before: Prisma.JsonNull,
            after: { country } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id: zoneId } };
  } catch (err) {
    return handleShippingZoneError(err, "addZoneCountryAction");
  }
}

export async function removeZoneCountryAction(
  zoneId: string,
  country: string,
): Promise<ShippingZoneActionResult> {
  const demoRefusal = await demoGate("shipping:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("shipping:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const membership = await tx.shippingZoneCountry.findFirst({
          where: { shippingZoneId: zoneId, country },
          select: { id: true },
        });
        if (!membership) throw new Error("NOT_FOUND");

        await tx.shippingZoneCountry.delete({ where: { id: membership.id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "shipping_zone.country.remove",
            entityType: "ShippingZone",
            entityId: zoneId,
            before: { country } as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/admin/shipping");
    return { success: true, data: { id: zoneId } };
  } catch (err) {
    return handleShippingZoneError(err, "removeZoneCountryAction");
  }
}
