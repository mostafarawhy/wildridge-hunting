"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { Prisma } from "@/app/generated/prisma/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import {
  SETTING_KEYS,
  isSequenceKey,
  isAllowedSettingKey,
  type LoyaltyProgramInput,
} from "@/lib/settings/keys";
import { getAdminLoyaltyActivity } from "@/lib/db/queries/loyalty";
import {
  LoyaltyActivityFiltersSchema,
  adjustLoyaltySchema,
} from "@/lib/validations/loyalty";
import type { AdjustLoyaltyInput } from "@/lib/validations/loyalty";
import type { AdminLoyaltyActivityRow } from "@/lib/db/queries/loyalty";

const EXPORT_ROW_CAP = 50_000;

export type LoyaltyProgramErrorCode = "VALIDATION_ERROR" | "INTERNAL_ERROR";

export type LoyaltyProgramResult =
  | { success: true }
  | {
      success: false;
      error: string;
      errorCode: LoyaltyProgramErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

export async function updateLoyaltyProgramAction(
  input: LoyaltyProgramInput,
): Promise<LoyaltyProgramResult> {
  const demoRefusal = await demoGate("settings:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("loyalty:manage");

  const key = "loyalty_program" as const;

  if (isSequenceKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }
  if (!isAllowedSettingKey(key)) {
    return { success: false, error: "Forbidden key.", errorCode: "INTERNAL_ERROR" };
  }

  const schema = SETTING_KEYS[key];
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data;

  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.projectConfig.findUnique({ where: { key } });
        const before: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
          existing == null
            ? undefined
            : existing.value === null
              ? Prisma.JsonNull
              : (existing.value as Prisma.InputJsonValue);

        await tx.projectConfig.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "settings.loyalty_program.update",
            entityType: "ProjectConfig",
            entityId: key,
            before,
            after: value,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type ExportLoyaltyActivityErrorCode =
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type LoyaltyActivityExportRow = AdminLoyaltyActivityRow;

export type ExportLoyaltyActivityResult =
  | { success: true; rows: LoyaltyActivityExportRow[] }
  | { success: false; error: string; errorCode: ExportLoyaltyActivityErrorCode };

export async function exportLoyaltyActivityAction(
  input: unknown,
): Promise<ExportLoyaltyActivityResult> {
  const { id: staffId } = await requireStaffAction("loyalty:manage");

  const parsed = LoyaltyActivityFiltersSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid filters",
      errorCode: "VALIDATION_ERROR",
    };
  }

  const filters = parsed.data;

  try {
    const { rows } = await getAdminLoyaltyActivity(filters, 1, EXPORT_ROW_CAP);

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "loyalty.exported",
        entityType: "LoyaltyTransaction",
        entityId: null,
        metadata: {
          count: rows.length,
          type: filters.type ?? "ALL",
          search: filters.search || null,
          from: filters.from ?? null,
          to: filters.to ?? null,
        },
      },
    });

    return {
      success: true,
      rows,
    };
  } catch (err) {
    console.error("[exportLoyaltyActivityAction]", err);
    return {
      success: false,
      error: "The export could not be recorded, so no file was produced.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export type AdjustLoyaltyErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "BALANCE_CHANGED"
  | "INSUFFICIENT_BALANCE"
  | "INTERNAL_ERROR";

export type AdjustLoyaltyResult =
  | { success: true; data: { newBalance: number } }
  | {
      success: false;
      error: string;
      errorCode: AdjustLoyaltyErrorCode;
      fieldErrors?: Record<string, string[]>;
    };

const ADJUST_SENTINELS = {
  NOT_FOUND: "Customer not found.",
  BALANCE_CHANGED:
    "The balance changed since you opened this page. Reload and try again.",
  INSUFFICIENT_BALANCE: "That would take the balance below zero.",
} as const;

export async function adjustLoyaltyPointsAction(
  input: AdjustLoyaltyInput,
): Promise<AdjustLoyaltyResult> {
  const acting = await requireStaffAction("loyalty:manage");

  const parsed = adjustLoyaltySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const { customerId, direction, points, reason, expectedBalance } = parsed.data;

  try {
    const newBalance = await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, deletedAt: null },
          select: { loyaltyPoints: true },
        });
        if (!customer) throw new Error("NOT_FOUND");
        if (customer.loyaltyPoints !== expectedBalance) {
          throw new Error("BALANCE_CHANGED");
        }

        const delta = direction === "ADD" ? points : -points;
        const next = customer.loyaltyPoints + delta;
        if (next < 0) throw new Error("INSUFFICIENT_BALANCE");

        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: next },
        });

        const transaction = await tx.loyaltyTransaction.create({
          data: {
            customerId,
            type: "ADJUSTED",
            delta,
            balanceAfter: next,
            reason,
            orderId: null,
            reference: null,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "loyalty.adjusted",
            entityType: "Customer",
            entityId: customerId,
            before: { loyaltyPoints: customer.loyaltyPoints },
            after: { loyaltyPoints: next },
            metadata: { delta, reason, transactionId: transaction.id },
          },
        });

        return next;
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/customers/${customerId}`);

    return { success: true, data: { newBalance } };
  } catch (err) {
    if (err instanceof Error && err.message in ADJUST_SENTINELS) {
      const code = err.message as keyof typeof ADJUST_SENTINELS;
      return { success: false, error: ADJUST_SENTINELS[code], errorCode: code };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
