import "server-only";
import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";
import type { StaffRole, Prisma } from "@/app/generated/prisma/client";
import { canPerform } from "@/lib/utils/staff-permissions";

export type StaffAuthState = {
  isActive: boolean;
  role: StaffRole;
};

export type StaffProjection = {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export async function getStaffAuthState(
  id: string,
): Promise<StaffAuthState | null> {
  try {
    return await db.staff.findUnique({
      where: { id },
      select: { isActive: true, role: true },
    });
  } catch {
    return null;
  }
}

export async function getAssignableStaff(): Promise<
  { id: string; name: string; email: string; role: StaffRole }[]
> {
  const rows = await db.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return rows
    .filter((s) => canPerform(s.role, "ticket:manage"))
    .map(({ id, name, email, role }) => ({ id, name, email, role }));
}

export async function getStaffById(
  id: string,
): Promise<StaffProjection | null> {
  try {
    return await db.staff.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true },
    });
  } catch {
    return null;
  }
}

export interface AdminStaffListItemProjection {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function getAdminStaff(opts?: {
  search?: string;
  role?: StaffRole;
  status?: "ACTIVE" | "INACTIVE";
}): Promise<AdminStaffListItemProjection[]> {
  const where: Prisma.StaffWhereInput = {};

  if (opts?.role) {
    where.role = opts.role;
  }

  if (opts?.status === "ACTIVE") {
    where.isActive = true;
  } else if (opts?.status === "INACTIVE") {
    where.isActive = false;
  }

  const term = opts?.search?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const rows = await db.staff.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt ? toISOString(row.lastLoginAt) : null,
    createdAt: toISOString(row.createdAt),
  }));
}

export interface OwnStaffAccount {
  name: string;
  email: string;
  role: StaffRole;
  createdAt: string;
  lastLoginAt: string | null;
  previousLoginAt: string | null;
}

export async function getOwnStaffAccount(id: string): Promise<OwnStaffAccount | null> {
  try {
    const row = await db.staff.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, createdAt: true, lastLoginAt: true, previousLoginAt: true },
    });
    if (!row) return null;
    return {
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: toISOString(row.createdAt),
      lastLoginAt: row.lastLoginAt ? toISOString(row.lastLoginAt) : null,
      previousLoginAt: row.previousLoginAt ? toISOString(row.previousLoginAt) : null,
    };
  } catch {
    return null;
  }
}
