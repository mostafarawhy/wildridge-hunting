"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";

const noteSchema = z.object({
  note: z.string().trim().min(1, "A note is required.").max(2000),
});

export type AddNoteErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type AddNoteResult =
  | { success: true }
  | { success: false; error: string; errorCode: AddNoteErrorCode };

export async function addB2BNoteAction(
  accountId: string,
  note: string,
): Promise<AddNoteResult> {
  const { id: staffId } = await requireStaffAction("b2b:read");

  const parsed = noteSchema.safeParse({ note });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const account = await db.b2BAccount.findUnique({
      where: { id: accountId },
      select: { id: true },
    });
    if (!account) throw new Error("NOT_FOUND");

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "b2b.note",
        entityType: "B2BAccount",
        entityId: accountId,
        metadata: { note: parsed.data.note },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "B2B account not found.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "Failed to add note. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/b2b/${accountId}`);
  return { success: true };
}

export async function addVerificationNoteAction(
  eventId: string,
  note: string,
): Promise<AddNoteResult> {
  const { id: staffId } = await requireStaffAction("verification:review");

  const parsed = noteSchema.safeParse({ note });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const event = await db.verificationEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new Error("NOT_FOUND");

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "verification.note",
        entityType: "VerificationEvent",
        entityId: eventId,
        metadata: { note: parsed.data.note },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Verification event not found.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "Failed to add note. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/verification/${eventId}`);
  return { success: true };
}

export async function addCouponNoteAction(
  couponId: string,
  note: string,
): Promise<AddNoteResult> {
  const { id: staffId } = await requireStaffAction("coupon:manage");

  const parsed = noteSchema.safeParse({ note });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const coupon = await db.coupon.findUnique({
      where: { id: couponId },
      select: { id: true },
    });
    if (!coupon) throw new Error("NOT_FOUND");

    await db.auditLog.create({
      data: {
        actorType: "STAFF",
        actorId: staffId,
        action: "coupon.note",
        entityType: "Coupon",
        entityId: couponId,
        metadata: { note: parsed.data.note },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Coupon not found.",
        errorCode: "NOT_FOUND",
      };
    }
    return {
      success: false,
      error: "Failed to add note. Please try again.",
      errorCode: "INTERNAL_ERROR",
    };
  }

  revalidatePath(`/admin/coupons/${couponId}`);
  return { success: true };
}
