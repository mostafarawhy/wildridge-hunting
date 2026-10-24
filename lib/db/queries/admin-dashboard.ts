import "server-only";
import { db } from "@/lib/db/client";
import { getSetting } from "@/lib/db/queries/settings";
import { refundOrderIds } from "@/lib/db/queries/order";
import {
  REVENUE_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/lib/utils/order-status";
import {
  dubaiDay,
  dubaiDayStartUtc,
  dubaiDaySequence,
} from "@/lib/utils/date";
import type { OrderStatus } from "@/app/generated/prisma/client";

export interface KpiMetric {
  value: number;
  previousValue: number;
  deltaPct: number | null;
}

export interface DashboardKpis {
  revenue: KpiMetric;
  orders: KpiMetric;
  aov: KpiMetric;
  customers: { value: number; newInPeriod: number };
}

export interface DailyBucket {
  date: string;
  value: number;
}

export interface DashboardTrends {
  revenue: DailyBucket[];
  revenuePrevious: DailyBucket[];
  orders: DailyBucket[];
  aov: DailyBucket[];
  newCustomers: DailyBucket[];
}

export interface DashboardQueues {
  newQuotes: number;
  openTickets: number;
  pendingB2B: number;
  staleShipped: number;
  staleShippedDays: number;
  ordersAwaitingAction: number;
  refundsOwed: number;
}

export interface PipelineEntry {
  status: OrderStatus;
  label: string;
  count: number;
}

function delta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const cutCurrent = dubaiDayStartUtc(30);
  const cutPrevious = dubaiDayStartUtc(60);

  const [currAgg, prevAgg, totalCustomers, newCustomers] = await Promise.all([
    db.order.aggregate({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: cutCurrent },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.order.aggregate({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: cutPrevious, lt: cutCurrent },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    db.customer.count({ where: { isActive: true, deletedAt: null } }),
    db.customer.count({
      where: { createdAt: { gte: cutCurrent }, deletedAt: null },
    }),
  ]);

  const currRevenue = Number(currAgg._sum.total ?? 0);
  const prevRevenue = Number(prevAgg._sum.total ?? 0);
  const currOrders = currAgg._count._all;
  const prevOrders = prevAgg._count._all;
  const currAov = currOrders > 0 ? currRevenue / currOrders : 0;
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  return {
    revenue: {
      value: currRevenue,
      previousValue: prevRevenue,
      deltaPct: delta(currRevenue, prevRevenue),
    },
    orders: {
      value: currOrders,
      previousValue: prevOrders,
      deltaPct: delta(currOrders, prevOrders),
    },
    aov: {
      value: currAov,
      previousValue: prevAov,
      deltaPct: delta(currAov, prevAov),
    },
    customers: { value: totalCustomers, newInPeriod: newCustomers },
  };
}

export async function getDashboardTrends(): Promise<DashboardTrends> {
  const cutCurrent = dubaiDayStartUtc(30);
  const cutPrevious = dubaiDayStartUtc(60);

  const [currOrders, prevOrders, newCusts] = await Promise.all([
    db.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: cutCurrent },
      },
      select: { createdAt: true, total: true },
    }),
    db.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: cutPrevious, lt: cutCurrent },
      },
      select: { createdAt: true, total: true },
    }),
    db.customer.findMany({
      where: { createdAt: { gte: cutCurrent }, deletedAt: null },
      select: { createdAt: true },
    }),
  ]);

  const currDays = dubaiDaySequence(29, 30);
  const prevDays = dubaiDaySequence(59, 30);

  function bucketRevenue(
    rows: { createdAt: Date; total: unknown }[],
    sequence: string[],
  ): DailyBucket[] {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const day = dubaiDay(row.createdAt);
      map[day] = (map[day] ?? 0) + Number(row.total);
    }
    return sequence.map((date) => ({ date, value: map[date] ?? 0 }));
  }

  function bucketCount(
    rows: { createdAt: Date }[],
    sequence: string[],
  ): DailyBucket[] {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const day = dubaiDay(row.createdAt);
      map[day] = (map[day] ?? 0) + 1;
    }
    return sequence.map((date) => ({ date, value: map[date] ?? 0 }));
  }

  const revenueByDay = bucketRevenue(currOrders, currDays);
  const ordersByDay = bucketCount(currOrders, currDays);
  const aovByDay: DailyBucket[] = revenueByDay.map((d, i) => ({
    date: d.date,
    value:
      (ordersByDay[i]?.value ?? 0) > 0
        ? d.value / (ordersByDay[i]?.value ?? 1)
        : 0,
  }));

  return {
    revenue: revenueByDay,
    revenuePrevious: bucketRevenue(prevOrders, prevDays),
    orders: ordersByDay,
    aov: aovByDay,
    newCustomers: bucketCount(newCusts, currDays),
  };
}

export async function getDashboardQueues(): Promise<DashboardQueues> {
  const { staleShippedDays } = await getSetting("delivery_config");
  const staleCutoff = new Date(Date.now() - staleShippedDays * 864e5);

  const [
    newQuotes,
    openTickets,
    pendingB2B,
    staleShipped,
    ordersAwaitingAction,
    refundsOwed,
  ] = await Promise.all([
    db.quoteRequest.count({ where: { status: "NEW" } }),
    db.ticket.count({ where: { status: { not: "CLOSED" } } }),
    db.b2BAccount.count({ where: { status: "PENDING" } }),
    db.order.count({
      where: { status: "SHIPPED", shippedAt: { lt: staleCutoff } },
    }),
    db.order.count({
      where: {
        status: { in: ["PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"] },
      },
    }),
    refundOrderIds("OWED").then((ids) => ids.length),
  ]);

  return {
    newQuotes,
    openTickets,
    pendingB2B,
    staleShipped,
    staleShippedDays,
    ordersAwaitingAction,
    refundsOwed,
  };
}

const PIPELINE_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
];

export async function getOrderPipeline(): Promise<PipelineEntry[]> {
  const groups = await db.order.groupBy({
    by: ["status"],
    where: { status: { in: PIPELINE_STATUSES } },
    _count: { _all: true },
  });

  const map: Record<string, number> = {};
  for (const g of groups) {
    map[g.status] = g._count._all;
  }

  return PIPELINE_STATUSES.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: map[status] ?? 0,
  }));
}
