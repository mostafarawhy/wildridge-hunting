import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  DEMO_RESTRICTED_MESSAGE,
  demoBlocks,
  type DemoGateToken,
} from "@/lib/config/demo";
import {
  can,
  canPerform,
  type StaffPermission,
} from "@/lib/utils/staff-permissions";
import type { StaffRole } from "@/app/generated/prisma/client";

type StaffIdentity = { id: string; staffRole: StaffRole };

async function resolveStaff(
  allows: (role: StaffRole, perm: StaffPermission) => boolean,
  required: StaffPermission[],
): Promise<StaffIdentity> {
  const session = await auth();

  if (
    !session?.user ||
    session.user.principal !== "staff" ||
    !session.user.staffRole
  ) {
    redirect("/admin/login");
  }

  const staffRole = session.user.staffRole;

  if (required.length > 0 && required.some((p) => !allows(staffRole, p))) {
    redirect("/admin");
  }

  return { id: session.user.id, staffRole };
}

export async function requireStaff(
  ...required: StaffPermission[]
): Promise<StaffIdentity> {
  return resolveStaff(can, required);
}

export async function requireStaffAction(
  ...required: StaffPermission[]
): Promise<StaffIdentity> {
  return resolveStaff(canPerform, required);
}

type DemoRefusal = never;

export async function demoGate(
  ...tokens: DemoGateToken[]
): Promise<DemoRefusal | null> {
  const session = await auth();
  const role =
    session?.user?.principal === "staff" ? (session.user.staffRole ?? null) : null;
  if (!role || !tokens.some((token) => demoBlocks(role, token))) return null;
  return {
    success: false,
    error: DEMO_RESTRICTED_MESSAGE,
    errorCode: "FORBIDDEN",
  } as unknown as DemoRefusal;
}
