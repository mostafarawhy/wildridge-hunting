"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";

export type CustomerActionErrorCode =
  | "NOT_FOUND"
  | "NO_OP"
  | "REASON_REQUIRED"
  | "INTERNAL_ERROR";

export type CustomerActionResult =
  | { success: true }
  | { success: false; error: string; errorCode: CustomerActionErrorCode };

export async function updateCustomerNoteAction(
  customerId: string,
  note: string,
): Promise<CustomerActionResult> {
  const { id: staffId } = await requireStaffAction("customer:manage");

  try {
    await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { internalNotes: true },
        });
        if (!customer) throw new Error("NOT_FOUND");

        const trimmed = note.trim() || null;

        await tx.customer.update({
          where: { id: customerId },
          data: { internalNotes: trimmed },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: "customer.note.update",
            entityType: "Customer",
            entityId: customerId,
            before: { internalNotes: customer.internalNotes },
            after: { internalNotes: trimmed },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/customers/${customerId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Customer not found.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function setCustomerActiveAction(
  customerId: string,
  active: boolean,
  reason?: string,
): Promise<CustomerActionResult> {
  const { id: staffId } = await requireStaffAction("customer:manage");

  if (!active && (!reason || !reason.trim())) {
    return {
      success: false,
      error: "A suspension reason is required.",
      errorCode: "REASON_REQUIRED",
    };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { isActive: true },
        });
        if (!customer) throw new Error("NOT_FOUND");
        if (customer.isActive === active) throw new Error("NO_OP");

        await tx.customer.update({
          where: { id: customerId },
          data: {
            isActive: active,
            ...(!active ? { tokenVersion: { increment: 1 } } : {}),
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: staffId,
            action: active ? "customer.reactivate" : "customer.suspend",
            entityType: "Customer",
            entityId: customerId,
            before: { isActive: !active },
            after: { isActive: active },
            ...(reason?.trim() ? { metadata: { reason: reason.trim() } } : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    revalidatePath(`/admin/customers/${customerId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Customer not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (err instanceof Error && err.message === "NO_OP") {
      return {
        success: false,
        error: "Customer is already in that state.",
        errorCode: "NO_OP",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
