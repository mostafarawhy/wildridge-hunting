"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { StoreSchema } from "@/lib/validations/store";
import { STORE_DAYS, parseMapPin } from "@/lib/utils/stores";

export type StoreActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PRIMARY_INACTIVE"
  | "IS_PRIMARY"
  | "PRIMARY_TAKEN"
  | "INTERNAL_ERROR";

export type StoreActionResult =
  | { success: true; data: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: StoreActionErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

function handleStoreError(err: unknown, tag: string): StoreActionResult {
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
    if (targets.includes("Store_single_primary_key") || targets.includes("isPrimary")) {
      return {
        success: false,
        error:
          "Another store became the main showroom at the same moment. Try again.",
        errorCode: "PRIMARY_TAKEN",
      };
    }
  }

  if (err instanceof Error) {
    switch (err.message) {
      case "NOT_FOUND":
        return {
          success: false,
          error: "Store not found.",
          errorCode: "NOT_FOUND",
        };
      case "IS_PRIMARY":
        return {
          success: false,
          error: "Make another store the main showroom first.",
          errorCode: "IS_PRIMARY",
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

function buildOpeningHours(
  data: z.infer<typeof StoreSchema>,
): Record<string, { open: string; close: string } | null> | null {
  if (!data.showHours) return null;
  return STORE_DAYS.reduce(
    (acc, day) => {
      const d = data.hours[day];
      acc[day] = d.closed ? null : { open: d.open, close: d.close };
      return acc;
    },
    {} as Record<string, { open: string; close: string } | null>,
  );
}

export async function createStoreAction(
  raw: unknown,
): Promise<StoreActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("content:manage");

  const parsed = StoreSchema.safeParse(raw);
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

  if (data.isPrimary && !data.isActive) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: {
        isPrimary: ["The main showroom must be shown on the site."],
      },
    };
  }

  const pin = parseMapPin(data.pin)!;
  const openingHours = buildOpeningHours(data);

  const rowFields = {
    nameEn: data.nameEn,
    nameAr: data.nameAr,
    nameRu: data.nameRu,
    addressEn: data.addressEn,
    addressAr: data.addressAr,
    addressRu: data.addressRu,
    descriptionEn: data.descriptionEn,
    descriptionAr: data.descriptionAr,
    descriptionRu: data.descriptionRu,
    hoursNoteEn: data.hoursNoteEn,
    hoursNoteAr: data.hoursNoteAr,
    hoursNoteRu: data.hoursNoteRu,
    latitude: pin.latitude,
    longitude: pin.longitude,
    phone: data.phone,
    email: data.email,
    isActive: data.isActive,
    isPrimary: data.isPrimary,
    displayOrder: data.displayOrder,
  };

  try {
    const store = await db.$transaction(
      async (tx) => {
        let replacedPrimaryId: string | undefined;

        if (data.isPrimary) {
          const previousPrimary = await tx.store.findFirst({
            where: { isPrimary: true },
            select: { id: true },
          });
          replacedPrimaryId = previousPrimary?.id;

          await tx.store.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false },
          });
        }

        const created = await tx.store.create({
          data: {
            ...rowFields,
            openingHours: openingHours ?? Prisma.JsonNull,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "store.create",
            entityType: "Store",
            entityId: created.id,
            before: Prisma.JsonNull,
            after: {
              ...rowFields,
              openingHours,
            } as unknown as Prisma.InputJsonValue,
            metadata: replacedPrimaryId
              ? ({ replacedPrimaryId } as unknown as Prisma.InputJsonValue)
              : undefined,
          },
        });

        return created;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");
    return { success: true, data: { id: store.id } };
  } catch (err) {
    return handleStoreError(err, "createStoreAction");
  }
}

export async function updateStoreAction(
  id: string,
  raw: unknown,
): Promise<StoreActionResult> {
  const demoRefusal = await demoGate("content:manage");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("content:manage");

  const parsed = StoreSchema.safeParse(raw);
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

  if (data.isPrimary && !data.isActive) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: {
        isPrimary: ["The main showroom must be shown on the site."],
      },
    };
  }

  const pin = parseMapPin(data.pin)!;
  const openingHours = buildOpeningHours(data);

  const rowFields = {
    nameEn: data.nameEn,
    nameAr: data.nameAr,
    nameRu: data.nameRu,
    addressEn: data.addressEn,
    addressAr: data.addressAr,
    addressRu: data.addressRu,
    descriptionEn: data.descriptionEn,
    descriptionAr: data.descriptionAr,
    descriptionRu: data.descriptionRu,
    hoursNoteEn: data.hoursNoteEn,
    hoursNoteAr: data.hoursNoteAr,
    hoursNoteRu: data.hoursNoteRu,
    latitude: pin.latitude,
    longitude: pin.longitude,
    phone: data.phone,
    email: data.email,
    isActive: data.isActive,
    isPrimary: data.isPrimary,
    displayOrder: data.displayOrder,
  };

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.store.findUnique({ where: { id } });
        if (!existing) throw new Error("NOT_FOUND");

        let replacedPrimaryId: string | undefined;

        if (data.isPrimary) {
          const previousPrimary = await tx.store.findFirst({
            where: { isPrimary: true, NOT: { id } },
            select: { id: true },
          });
          replacedPrimaryId = previousPrimary?.id;

          await tx.store.updateMany({
            where: { isPrimary: true, NOT: { id } },
            data: { isPrimary: false },
          });
        }

        await tx.store.update({
          where: { id },
          data: {
            ...rowFields,
            openingHours: openingHours ?? Prisma.JsonNull,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "store.update",
            entityType: "Store",
            entityId: id,
            metadata: replacedPrimaryId
              ? ({ replacedPrimaryId } as unknown as Prisma.InputJsonValue)
              : undefined,
            before: {
              nameEn: existing.nameEn,
              nameAr: existing.nameAr,
              nameRu: existing.nameRu,
              addressEn: existing.addressEn,
              addressAr: existing.addressAr,
              addressRu: existing.addressRu,
              descriptionEn: existing.descriptionEn,
              descriptionAr: existing.descriptionAr,
              descriptionRu: existing.descriptionRu,
              hoursNoteEn: existing.hoursNoteEn,
              hoursNoteAr: existing.hoursNoteAr,
              hoursNoteRu: existing.hoursNoteRu,
              latitude: existing.latitude,
              longitude: existing.longitude,
              phone: existing.phone,
              email: existing.email,
              openingHours: existing.openingHours,
              isActive: existing.isActive,
              isPrimary: existing.isPrimary,
              displayOrder: existing.displayOrder,
            } as unknown as Prisma.InputJsonValue,
            after: {
              ...rowFields,
              openingHours,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");
    return { success: true, data: { id } };
  } catch (err) {
    return handleStoreError(err, "updateStoreAction");
  }
}

export async function deleteStoreAction(
  id: string,
): Promise<StoreActionResult> {
  const demoRefusal = await demoGate("content:manage", "delete");
  if (demoRefusal) return demoRefusal;

  const { id: staffId } = await requireStaffAction("content:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.store.findUnique({ where: { id } });
        if (!existing) throw new Error("NOT_FOUND");
        if (existing.isPrimary) throw new Error("IS_PRIMARY");

        await tx.store.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "store.delete",
            entityType: "Store",
            entityId: id,
            before: {
              id: existing.id,
              nameEn: existing.nameEn,
              nameAr: existing.nameAr,
              nameRu: existing.nameRu,
              addressEn: existing.addressEn,
              addressAr: existing.addressAr,
              addressRu: existing.addressRu,
              descriptionEn: existing.descriptionEn,
              descriptionAr: existing.descriptionAr,
              descriptionRu: existing.descriptionRu,
              hoursNoteEn: existing.hoursNoteEn,
              hoursNoteAr: existing.hoursNoteAr,
              hoursNoteRu: existing.hoursNoteRu,
              latitude: existing.latitude,
              longitude: existing.longitude,
              phone: existing.phone,
              email: existing.email,
              openingHours: existing.openingHours,
              isActive: existing.isActive,
              isPrimary: existing.isPrimary,
              displayOrder: existing.displayOrder,
            } as unknown as Prisma.InputJsonValue,
            after: Prisma.JsonNull,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath("/", "layout");
    return { success: true, data: { id } };
  } catch (err) {
    return handleStoreError(err, "deleteStoreAction");
  }
}
