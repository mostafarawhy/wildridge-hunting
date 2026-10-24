import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { entityTypesForCategory, type AuditCategory } from "@/lib/utils/audit-taxonomy";
import type { AuditActorType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";

export interface AuditLogListItem {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  actions?: string[];
  excludeActions?: string[];
  actorType?: AuditActorType;
  actorId?: string;
  entityId?: string;
  search?: string;
  from?: string;
  to?: string;
  category?: AuditCategory;
  entityScopes?: { entityType: string; entityIds: string[] }[];
}

export interface AuditLogPage {
  items: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAuditLogList(
  opts?: AuditLogFilters & { page?: number; pageSize?: number },
): Promise<AuditLogPage> {
  const where: Prisma.AuditLogWhereInput = {};

  if (opts?.entityType) {
    where.entityType = opts.entityType;
  } else if (opts?.category) {
    const types = entityTypesForCategory(opts.category);
    if (types.length > 0) where.entityType = { in: types };
  }

  if (opts?.action) {
    where.action = opts.action;
  } else if (opts?.actions) {
    where.action = { in: opts.actions };
  } else if (opts?.excludeActions) {
    where.action = { notIn: opts.excludeActions };
  }

  if (opts?.actorType) {
    where.actorType = opts.actorType;
  }

  if (opts?.actorId) {
    where.actorId = opts.actorId;
  }

  if (opts?.entityId) {
    where.entityId = opts.entityId;
  }

  const term = opts?.search?.trim();
  if (term) {
    where.searchText = { contains: term, mode: "insensitive" };
  }

  const fromBounds = opts?.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts?.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    where.createdAt = {
      ...(fromBounds ? { gte: fromBounds.start } : {}),
      ...(toBounds ? { lt: toBounds.end } : {}),
    };
  }

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = opts?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  if (opts?.entityScopes) {
    const scopes = opts.entityScopes.filter((s) => s.entityIds.length > 0);
    if (scopes.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    where.OR = scopes.map((s) => ({
      entityType: s.entityType,
      entityId: { in: s.entityIds },
    }));
  }

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        actorType: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  const staffIds = [
    ...new Set(
      rows
        .filter((r) => r.actorType === "STAFF" && r.actorId != null)
        .map((r) => r.actorId as string),
    ),
  ];

  const customerIds = [
    ...new Set(
      rows
        .filter((r) => r.actorType === "CUSTOMER" && r.actorId != null)
        .map((r) => r.actorId as string),
    ),
  ];

  const [staffRows, customerRows] = await Promise.all([
    staffIds.length > 0
      ? db.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
    customerIds.length > 0
      ? db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));
  const staffRoleById = new Map(staffRows.map((s) => [s.id, s.role]));
  const customerNameById = new Map(customerRows.map((c) => [c.id, c.name]));

  const items = rows.map((row) => ({
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId,
    actorName:
      row.actorType === "STAFF" && row.actorId
        ? (staffNameById.get(row.actorId) ?? row.actorId)
        : row.actorType === "CUSTOMER" && row.actorId
          ? (customerNameById.get(row.actorId) ?? row.actorId)
          : "System",
    actorRole:
      row.actorType === "STAFF" && row.actorId
        ? (staffRoleById.get(row.actorId) ?? null)
        : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    metadata: row.metadata,
    createdAt: toISOString(row.createdAt),
  }));

  return { items, total, page, pageSize };
}

export interface AuditFilterFacets {
  entityTypes: string[];
  actions: string[];
  actors: { id: string; name: string; actorType: "STAFF" | "CUSTOMER" }[];
}

export async function getAuditFilterFacets(): Promise<AuditFilterFacets> {
  const [entityTypeRows, actionRows, actorRows] = await Promise.all([
    db.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    db.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    db.auditLog.findMany({
      where: { actorId: { not: null }, actorType: { in: ["STAFF", "CUSTOMER"] } },
      distinct: ["actorId"],
      select: { actorId: true, actorType: true },
    }),
  ]);

  const staffActorIds = actorRows
    .filter((r) => r.actorType === "STAFF" && r.actorId != null)
    .map((r) => r.actorId as string);

  const customerActorIds = actorRows
    .filter((r) => r.actorType === "CUSTOMER" && r.actorId != null)
    .map((r) => r.actorId as string);

  const [staffRows, customerRows] = await Promise.all([
    staffActorIds.length > 0
      ? db.staff.findMany({
          where: { id: { in: staffActorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    customerActorIds.length > 0
      ? db.customer.findMany({
          where: { id: { in: customerActorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));
  const customerNameById = new Map(customerRows.map((c) => [c.id, c.name]));

  const actors = [
    ...staffActorIds.map((id) => ({
      id,
      name: staffNameById.get(id) ?? id,
      actorType: "STAFF" as const,
    })),
    ...customerActorIds.map((id) => ({
      id,
      name: customerNameById.get(id) ?? id,
      actorType: "CUSTOMER" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return {
    entityTypes: entityTypeRows.map((r) => r.entityType),
    actions: actionRows.map((r) => r.action),
    actors,
  };
}
