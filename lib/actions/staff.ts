"use server";

import { db } from "@/lib/db/client";
import { demoGate, requireStaffAction } from "@/lib/auth-staff";
import { signOut } from "@/auth";
import { can } from "@/lib/utils/staff-permissions";
import { StaffRole } from "@/app/generated/prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  createStaffSchema,
  setOwnPasswordSchema,
  staffPasswordSchema,
} from "@/lib/validations/auth";

type StaffActionResult =
  | { success: true; data?: { id: string } }
  | {
      success: false;
      error: string;
      errorCode: string;
      fieldErrors?: Record<string, string[]>;
    };

async function verifyActingPassword(
  actingStaffId: string,
  confirmPassword: string,
): Promise<boolean> {
  const actor = await db.staff.findUnique({
    where: { id: actingStaffId },
    select: { passwordHash: true },
  });
  if (!actor?.passwordHash) return false;
  return bcrypt.compare(confirmPassword, actor.passwordHash);
}

function roleHasStaffManage(role: StaffRole): boolean {
  return can(role, "staff:manage");
}

export async function createStaffAction(input: {
  name: string;
  email: string;
  role: string;
  password: string;
  confirmPassword: string;
}): Promise<StaffActionResult> {
  const demoRefusal = await demoGate("staff:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("staff:manage");

  try {
    const parsed = createStaffSchema
      .extend({
        confirmPassword: z.string().min(1, "Password confirmation is required"),
      })
      .safeParse(input);
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

    if (roleHasStaffManage(parsed.data.role) && acting.staffRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error: "You cannot assign a role with staff management permissions.",
        errorCode: "ESCALATION_FORBIDDEN",
      };
    }

    const passwordOk = await verifyActingPassword(
      acting.id,
      input.confirmPassword,
    );
    if (!passwordOk) {
      return {
        success: false,
        error: "Password confirmation failed.",
        errorCode: "PASSWORD_CONFIRM_FAILED",
      };
    }

    const { name, email: rawEmail, role, password } = parsed.data;
    const email = rawEmail.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const newId = await db.$transaction(
      async (tx) => {
        const staff = await tx.staff.create({
          data: {
            name,
            email,
            role,
            passwordHash,
            mustChangePassword: true,
            isActive: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "staff.create",
            entityType: "Staff",
            entityId: staff.id,
            after: { name, email, role },
          },
        });

        return staff.id;
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true, data: { id: newId } };
  } catch (err) {
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: string }).code
        : undefined;

    if (prismaCode === "P2002") {
      const targets =
        (err as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (targets.includes("email")) {
        return {
          success: false,
          error: "A staff member with this email already exists.",
          errorCode: "EMAIL_TAKEN",
        };
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function updateStaffRoleAction(input: {
  staffId: string;
  role: string;
  confirmPassword: string;
}): Promise<StaffActionResult> {
  const demoRefusal = await demoGate("staff:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("staff:manage");

  try {
    const roleResult = z.enum(StaffRole).safeParse(input.role);
    if (!roleResult.success) {
      return {
        success: false,
        error: "Invalid role.",
        errorCode: "VALIDATION_ERROR",
      };
    }
    const newRole = roleResult.data;

    if (input.staffId === acting.id) {
      return {
        success: false,
        error: "You cannot change your own role.",
        errorCode: "SELF_FORBIDDEN",
      };
    }

    const target = await db.staff.findUnique({
      where: { id: input.staffId },
      select: { role: true },
    });
    if (!target) {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (target.role === newRole) {
      return { success: true };
    }

    if (
      (roleHasStaffManage(target.role) || roleHasStaffManage(newRole)) &&
      acting.staffRole !== "SUPER_ADMIN"
    ) {
      return {
        success: false,
        error: "You cannot assign or change roles with staff management permissions.",
        errorCode: "ESCALATION_FORBIDDEN",
      };
    }

    if (roleHasStaffManage(target.role) || roleHasStaffManage(newRole)) {
      const passwordOk = await verifyActingPassword(
        acting.id,
        input.confirmPassword,
      );
      if (!passwordOk) {
        return {
          success: false,
          error: "Password confirmation failed.",
          errorCode: "PASSWORD_CONFIRM_FAILED",
        };
      }
    }

    let noOp = false;

    await db.$transaction(
      async (tx) => {
        const staff = await tx.staff.findUnique({
          where: { id: input.staffId },
          select: { role: true },
        });
        if (!staff) throw new Error("NOT_FOUND");
        if (staff.role === newRole) {
          noOp = true;
          return;
        }

        if (staff.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
          const count = await tx.staff.count({
            where: { role: "SUPER_ADMIN", isActive: true },
          });
          if (count <= 1) throw new Error("LAST_SUPER_ADMIN");
        }

        await tx.staff.update({
          where: { id: input.staffId },
          data: { role: newRole },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "staff.role_change",
            entityType: "Staff",
            entityId: input.staffId,
            before: { role: staff.role },
            after: { role: newRole },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (noOp) return { success: true };
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (err instanceof Error && err.message === "SELF_FORBIDDEN") {
      return {
        success: false,
        error: "You cannot change your own role.",
        errorCode: "SELF_FORBIDDEN",
      };
    }
    if (err instanceof Error && err.message === "LAST_SUPER_ADMIN") {
      return {
        success: false,
        error: "Cannot change the role of the last active Super Admin.",
        errorCode: "LAST_SUPER_ADMIN",
      };
    }
    if (err instanceof Error && err.message === "PASSWORD_CONFIRM_FAILED") {
      return {
        success: false,
        error: "Password confirmation failed.",
        errorCode: "PASSWORD_CONFIRM_FAILED",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function setStaffActiveAction(input: {
  staffId: string;
  isActive: boolean;
  confirmPassword?: string;
}): Promise<StaffActionResult> {
  const demoRefusal = await demoGate("staff:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("staff:manage");

  try {
    if (!input.isActive) {
      const passwordOk = await verifyActingPassword(
        acting.id,
        input.confirmPassword ?? "",
      );
      if (!passwordOk) {
        return {
          success: false,
          error: "Password confirmation failed.",
          errorCode: "PASSWORD_CONFIRM_FAILED",
        };
      }
    }

    let noOp = false;

    await db.$transaction(
      async (tx) => {
        const staff = await tx.staff.findUnique({
          where: { id: input.staffId },
          select: { isActive: true, role: true },
        });
        if (!staff) throw new Error("NOT_FOUND");

        if (staff.isActive === input.isActive) {
          noOp = true;
          return;
        }

        if (!input.isActive) {
          if (input.staffId === acting.id) throw new Error("SELF_FORBIDDEN");

          if (roleHasStaffManage(staff.role) && acting.staffRole !== "SUPER_ADMIN") {
            throw new Error("ESCALATION_FORBIDDEN");
          }

          if (staff.role === "SUPER_ADMIN") {
            const count = await tx.staff.count({
              where: { role: "SUPER_ADMIN", isActive: true },
            });
            if (count <= 1) throw new Error("LAST_SUPER_ADMIN");
          }
        }

        await tx.staff.update({
          where: { id: input.staffId },
          data: { isActive: input.isActive },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: input.isActive ? "staff.activate" : "staff.deactivate",
            entityType: "Staff",
            entityId: input.staffId,
            before: { isActive: !input.isActive },
            after: { isActive: input.isActive },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    if (noOp) return { success: true };
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (err instanceof Error && err.message === "SELF_FORBIDDEN") {
      return {
        success: false,
        error: "You cannot deactivate your own account.",
        errorCode: "SELF_FORBIDDEN",
      };
    }
    if (err instanceof Error && err.message === "ESCALATION_FORBIDDEN") {
      return {
        success: false,
        error: "You cannot deactivate an account with staff management permissions.",
        errorCode: "ESCALATION_FORBIDDEN",
      };
    }
    if (err instanceof Error && err.message === "LAST_SUPER_ADMIN") {
      return {
        success: false,
        error: "Cannot deactivate the last active Super Admin.",
        errorCode: "LAST_SUPER_ADMIN",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function resetStaffPasswordAction({
  staffId,
  newPassword,
  confirmPassword,
}: {
  staffId: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<StaffActionResult> {
  const demoRefusal = await demoGate("staff:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction("staff:manage");

  try {
    const parsed = staffPasswordSchema.safeParse(newPassword);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed.",
        errorCode: "VALIDATION_ERROR",
      };
    }

    if (staffId === acting.id) {
      return {
        success: false,
        error: "Use the account settings to change your own password.",
        errorCode: "SELF_FORBIDDEN",
      };
    }

    const target = await db.staff.findUnique({
      where: { id: staffId },
      select: { role: true },
    });
    if (!target) {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }

    if (roleHasStaffManage(target.role) && acting.staffRole !== "SUPER_ADMIN") {
      return {
        success: false,
        error:
          "You cannot reset the password of an account with staff management permissions.",
        errorCode: "ESCALATION_FORBIDDEN",
      };
    }

    const passwordOk = await verifyActingPassword(acting.id, confirmPassword);
    if (!passwordOk) {
      return {
        success: false,
        error: "Password confirmation failed.",
        errorCode: "PASSWORD_CONFIRM_FAILED",
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.$transaction(
      async (tx) => {
        await tx.staff.update({
          where: { id: staffId },
          data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "staff.password_reset",
            entityType: "Staff",
            entityId: staffId,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Staff member not found.",
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

export async function setOwnPasswordAction(input: {
  newPassword: string;
  currentPassword?: string;
}): Promise<StaffActionResult> {
  const demoRefusal = await demoGate("staff:manage");
  if (demoRefusal) return demoRefusal;

  const acting = await requireStaffAction();

  try {
    const parsed = setOwnPasswordSchema.safeParse(input);
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

    const { newPassword } = parsed.data;
    const currentPassword =
      typeof input.currentPassword === "string" ? input.currentPassword : "";

    const current = await db.staff.findUnique({
      where: { id: acting.id },
      select: { passwordHash: true, mustChangePassword: true },
    });
    if (!current) {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (!current.mustChangePassword) {
      const currentMatch = current.passwordHash
        ? await bcrypt.compare(currentPassword, current.passwordHash)
        : false;
      if (!currentMatch) {
        return {
          success: false,
          error: "Current password is incorrect.",
          errorCode: "INCORRECT_PASSWORD",
        };
      }
    }
    if (current.passwordHash) {
      const isSame = await bcrypt.compare(newPassword, current.passwordHash);
      if (isSame) {
        return {
          success: false,
          error: "New password must be different.",
          errorCode: "SAME_PASSWORD",
        };
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.$transaction(
      async (tx) => {
        await tx.staff.update({
          where: { id: acting.id },
          data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
        });

        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: acting.id,
            action: "staff.password_set",
            entityType: "Staff",
            entityId: acting.id,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    try { await signOut({ redirect: false }); } catch (err) { console.error("[staff] signOut after password change failed:", err); }
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return {
        success: false,
        error: "Staff member not found.",
        errorCode: "NOT_FOUND",
      };
    }
    if (err instanceof Error && err.message === "SAME_PASSWORD") {
      return {
        success: false,
        error: "New password must be different.",
        errorCode: "SAME_PASSWORD",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}

export async function signOutEverywhereAction(): Promise<
  { success: true } | { success: false; error: string; errorCode: string }
> {
  const { id } = await requireStaffAction();
  try {
    await db.$transaction(
      async (tx) => {
        await tx.staff.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
        await tx.auditLog.create({
          data: {
            actorType: "STAFF",
            actorId: id,
            action: "staff.sessions_revoked",
            entityType: "Staff",
            entityId: id,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (err) {
    console.error("[staff] signOutEverywhereAction failed:", err);
    return { success: false, error: "Couldn't sign you out everywhere. Please try again.", errorCode: "UNKNOWN" };
  }
  try { await signOut({ redirect: false }); } catch (err) { console.error("[staff] signOut after revoke failed:", err); }
  return { success: true };
}
