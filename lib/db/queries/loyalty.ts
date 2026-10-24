import "server-only";
import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import type { LoyaltyActivityFilters } from "@/lib/validations/loyalty";
import type { Prisma } from "@/app/generated/prisma/client";

const LOYALTY_PAGE_SIZE = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LoyaltyOverview {
  pointsOutstanding: number;
  customersWithPoints: number;
  earnedLast30Days: number;
  adjustedLast30Days: number;
  spentLast30Days: number;
  returnedLast30Days: number;
}

export async function getLoyaltyOverview(): Promise<LoyaltyOverview> {
  const since = new Date(Date.now() - 30 * DAY_MS);

  const [outstanding, customersWithPoints, earned, adjusted, redeemed, refunded] =
    await Promise.all([
      db.customer.aggregate({
        where: { deletedAt: null },
        _sum: { loyaltyPoints: true },
      }),
      db.customer.count({
        where: { loyaltyPoints: { gt: 0 }, deletedAt: null },
      }),
      db.loyaltyTransaction.aggregate({
        where: { type: "EARNED", createdAt: { gte: since } },
        _sum: { delta: true },
      }),
      db.loyaltyTransaction.aggregate({
        where: { type: "ADJUSTED", createdAt: { gte: since } },
        _sum: { delta: true },
      }),
      db.loyaltyTransaction.aggregate({
        where: { type: "REDEEMED", createdAt: { gte: since } },
        _sum: { delta: true },
      }),
      db.loyaltyTransaction.aggregate({
        where: { type: "REFUNDED", createdAt: { gte: since } },
        _sum: { delta: true },
      }),
    ]);

  return {
    pointsOutstanding: outstanding._sum.loyaltyPoints ?? 0,
    customersWithPoints,
    earnedLast30Days: earned._sum.delta ?? 0,
    adjustedLast30Days: adjusted._sum.delta ?? 0,
    spentLast30Days: -((redeemed._sum.delta ?? 0) + (refunded._sum.delta ?? 0)),
    returnedLast30Days: refunded._sum.delta ?? 0,
  };
}

export function buildLoyaltyActivityWhere(
  f: LoyaltyActivityFilters,
): Prisma.LoyaltyTransactionWhereInput {
  const and: Prisma.LoyaltyTransactionWhereInput[] = [];

  if (f.search) {
    and.push({
      OR: [
        { customer: { email: { contains: f.search, mode: "insensitive" } } },
        { order: { orderNumber: { contains: f.search, mode: "insensitive" } } },
      ],
    });
  }
  if (f.type) and.push({ type: f.type });

  const fromBounds = f.from ? dubaiDayBoundsUtc(f.from) : null;
  if (fromBounds) and.push({ createdAt: { gte: fromBounds.start } });
  const toBounds = f.to ? dubaiDayBoundsUtc(f.to) : null;
  if (toBounds) and.push({ createdAt: { lt: toBounds.end } });

  return { AND: and };
}

export interface AdminLoyaltyActivityRow {
  id: string;
  createdAt: string;
  customerId: string;
  customerEmail: string;
  type:
    | "EARNED"
    | "REDEEMED"
    | "ADJUSTED"
    | "EXPIRED"
    | "REFUNDED"
    | "REVERSED";
  delta: number;
  balanceAfter: number;
  orderId: string | null;
  orderNumber: string | null;
  reason: string | null;
  adjustedBy: string | null;
}

function transactionIdOf(metadata: unknown): string | null {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).transactionId;
  return typeof value === "string" ? value : null;
}

export async function getAdminLoyaltyActivity(
  filters: LoyaltyActivityFilters,
  pageNumber: number,
  pageSize: number = LOYALTY_PAGE_SIZE,
): Promise<{
  rows: AdminLoyaltyActivityRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where = buildLoyaltyActivityWhere(filters);

  const page = Math.max(1, pageNumber);

  const [total, found] = await Promise.all([
    db.loyaltyTransaction.count({ where }),
    db.loyaltyTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        customerId: true,
        type: true,
        delta: true,
        balanceAfter: true,
        orderId: true,
        reason: true,
        customer: { select: { email: true } },
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  const adjustedRows = found.filter((r) => r.type === "ADJUSTED");
  const staffNameByTransactionId = new Map<string, string>();

  if (adjustedRows.length > 0) {
    const auditRows = await db.auditLog.findMany({
      where: {
        action: "loyalty.adjusted",
        entityType: "Customer",
        entityId: { in: [...new Set(adjustedRows.map((r) => r.customerId))] },
      },
      select: { actorId: true, metadata: true },
    });

    const actorIdByTransactionId = new Map<string, string>();
    for (const audit of auditRows) {
      const transactionId = transactionIdOf(audit.metadata);
      if (transactionId && audit.actorId) {
        actorIdByTransactionId.set(transactionId, audit.actorId);
      }
    }

    const actorIds = [
      ...new Set(
        adjustedRows
          .map((r) => actorIdByTransactionId.get(r.id))
          .filter((id): id is string => id !== undefined),
      ),
    ];

    if (actorIds.length > 0) {
      const staff = await db.staff.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      });
      const nameByActorId = new Map(staff.map((s) => [s.id, s.name]));
      for (const row of adjustedRows) {
        const actorId = actorIdByTransactionId.get(row.id);
        const name = actorId ? nameByActorId.get(actorId) : undefined;
        if (name) staffNameByTransactionId.set(row.id, name);
      }
    }
  }

  return {
    rows: found.map((r) => ({
      id: r.id,
      createdAt: toISOString(r.createdAt),
      customerId: r.customerId,
      customerEmail: r.customer.email,
      type: r.type,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      reason: r.reason,
      adjustedBy: staffNameByTransactionId.get(r.id) ?? null,
    })),
    total,
    page,
    pageSize,
  };
}
