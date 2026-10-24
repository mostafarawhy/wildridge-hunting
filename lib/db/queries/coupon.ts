import "server-only";
import { CustomerRole, Prisma } from "@/app/generated/prisma/client";
import type { CouponType, OrderStatus } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { roundMoney } from "@/lib/utils/currency";
import { dubaiDayStartUtc, toISOString } from "@/lib/utils/date";
import {
  COUPON_STATUSES,
  deriveCouponStatus,
  type CouponStatus,
} from "@/lib/utils/coupon-display";

export const ADMIN_COUPONS_PER_PAGE = 25;

export type CouponSourceFilter = "manual" | "reward";

export interface AdminCouponFilters {
  search?: string;
  type?: CouponType;
  source?: CouponSourceFilter;
}

function couponStatusWhere(
  status: CouponStatus,
  now: Date,
): Prisma.CouponWhereInput {
  const notExpired: Prisma.CouponWhereInput = {
    OR: [{ endsAt: null }, { endsAt: { gte: now } }],
  };
  const notUsedUp: Prisma.CouponWhereInput = {
    OR: [
      { usageLimit: null },
      { usedCount: { lt: db.coupon.fields.usageLimit } },
    ],
  };
  switch (status) {
    case "EXPIRED":
      return { endsAt: { lt: now } };
    case "USED_UP":
      return {
        AND: [
          notExpired,
          { usageLimit: { not: null } },
          { usedCount: { gte: db.coupon.fields.usageLimit } },
        ],
      };
    case "PAUSED":
      return { AND: [notExpired, notUsedUp, { isActive: false }] };
    case "SCHEDULED":
      return {
        AND: [
          notExpired,
          notUsedUp,
          { isActive: true },
          { startsAt: { gt: now } },
        ],
      };
    case "ACTIVE":
      return {
        AND: [
          notExpired,
          notUsedUp,
          { isActive: true },
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        ],
      };
  }
}

function buildCouponWhere(
  filters: AdminCouponFilters,
): Prisma.CouponWhereInput {
  const term = filters.search?.trim();
  return {
    ...(term
      ? {
          OR: [
            { code: { contains: term, mode: "insensitive" as const } },
            {
              customer: {
                is: { email: { contains: term, mode: "insensitive" as const } },
              },
            },
          ],
        }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.source === "manual" ? { sourceRuleId: null } : {}),
    ...(filters.source === "reward" ? { sourceRuleId: { not: null } } : {}),
  };
}

export interface AdminCouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  allowedRole: CustomerRole | null;
  status: CouponStatus;
  source: "manual" | "reward";
  sourceRuleName: string | null;
  customerId: string | null;
  customerEmail: string | null;
}

export async function getAdminCoupons(
  opts: AdminCouponFilters & {
    status?: CouponStatus;
    page: number;
    now: Date;
  },
): Promise<{ items: AdminCouponRow[]; totalCount: number }> {
  const where: Prisma.CouponWhereInput = {
    AND: [
      buildCouponWhere(opts),
      opts.status ? couponStatusWhere(opts.status, opts.now) : {},
    ],
  };

  const [rows, totalCount] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * ADMIN_COUPONS_PER_PAGE,
      take: ADMIN_COUPONS_PER_PAGE,
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscountAmount: true,
        usageLimit: true,
        usedCount: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
        allowedRole: true,
        sourceRuleId: true,
        sourceRule: { select: { name: true } },
        customer: { select: { id: true, email: true } },
      },
    }),
    db.coupon.count({ where }),
  ]);

  return {
    items: rows.map((r) => {
      const startsAt = r.startsAt != null ? toISOString(r.startsAt) : null;
      const endsAt = r.endsAt != null ? toISOString(r.endsAt) : null;
      return {
        id: r.id,
        code: r.code,
        type: r.type,
        value: Number(r.value),
        minOrderAmount:
          r.minOrderAmount != null ? Number(r.minOrderAmount) : null,
        maxDiscountAmount:
          r.maxDiscountAmount != null ? Number(r.maxDiscountAmount) : null,
        usageLimit: r.usageLimit,
        usedCount: r.usedCount,
        startsAt,
        endsAt,
        isActive: r.isActive,
        allowedRole: r.allowedRole,
        status: deriveCouponStatus(
          {
            isActive: r.isActive,
            startsAt,
            endsAt,
            usageLimit: r.usageLimit,
            usedCount: r.usedCount,
          },
          opts.now,
        ),
        source: r.sourceRuleId != null ? "reward" : "manual",
        sourceRuleName: r.sourceRule?.name ?? null,
        customerId: r.customer?.id ?? null,
        customerEmail: r.customer?.email ?? null,
      };
    }),
    totalCount,
  };
}

export async function getAdminCouponStatusCounts(
  filters: AdminCouponFilters,
  now: Date,
): Promise<Record<CouponStatus | "ALL", number>> {
  const base = buildCouponWhere(filters);
  const [all, ...perStatus] = await Promise.all([
    db.coupon.count({ where: base }),
    ...COUPON_STATUSES.map((s) =>
      db.coupon.count({ where: { AND: [base, couponStatusWhere(s, now)] } }),
    ),
  ]);

  const counts: Record<CouponStatus | "ALL", number> = {
    ALL: all,
    ACTIVE: 0,
    SCHEDULED: 0,
    PAUSED: 0,
    USED_UP: 0,
    EXPIRED: 0,
  };
  COUPON_STATUSES.forEach((s, i) => {
    counts[s] = perStatus[i];
  });
  return counts;
}

export const EXCLUDED_ORDER_STATUSES: OrderStatus[] = [
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
];

export const COUNTED_ORDER: Prisma.OrderWhereInput = {
  paidAt: { not: null },
  status: { notIn: EXCLUDED_ORDER_STATUSES },
};

export async function getCouponSummary(now: Date): Promise<{
  activeCount: number;
  redemptionCount: number;
  discountGiven: number;
  rewardCodesIssued: number;
}> {
  const start = dubaiDayStartUtc(29);
  const redemptionWhere: Prisma.CouponRedemptionWhereInput = {
    createdAt: { gte: start },
    order: COUNTED_ORDER,
  };

  const [activeCount, redemptionCount, sum, rewardCodesIssued] =
    await Promise.all([
      db.coupon.count({ where: couponStatusWhere("ACTIVE", now) }),
      db.couponRedemption.count({ where: redemptionWhere }),
      db.couponRedemption.aggregate({
        where: redemptionWhere,
        _sum: { discountAmount: true },
      }),
      db.coupon.count({
        where: { sourceRuleId: { not: null }, createdAt: { gte: start } },
      }),
    ]);

  return {
    activeCount,
    redemptionCount,
    discountGiven: roundMoney(Number(sum._sum.discountAmount ?? 0)),
    rewardCodesIssued,
  };
}

export interface AdminCouponDetail extends AdminCouponRow {
  createdAt: string;
  customer: { id: string; email: string } | null;
  sourceRule: { id: string; name: string } | null;
  sourceOrder: { id: string; orderNumber: string } | null;
  redemptionCount: number;
  discountGiven: number;
}

export async function getAdminCouponDetail(
  id: string,
  now: Date,
): Promise<AdminCouponDetail | null> {
  const r = await db.coupon.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      minOrderAmount: true,
      maxDiscountAmount: true,
      usageLimit: true,
      usedCount: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      allowedRole: true,
      createdAt: true,
      sourceRuleId: true,
      sourceRule: { select: { id: true, name: true } },
      customer: { select: { id: true, email: true } },
      sourceOrder: { select: { id: true, orderNumber: true } },
      _count: { select: { redemptions: true } },
    },
  });
  if (!r) return null;

  const sum = await db.couponRedemption.aggregate({
    where: { couponId: id, order: COUNTED_ORDER },
    _sum: { discountAmount: true },
  });

  const startsAt = r.startsAt != null ? toISOString(r.startsAt) : null;
  const endsAt = r.endsAt != null ? toISOString(r.endsAt) : null;

  return {
    id: r.id,
    code: r.code,
    type: r.type,
    value: Number(r.value),
    minOrderAmount: r.minOrderAmount != null ? Number(r.minOrderAmount) : null,
    maxDiscountAmount:
      r.maxDiscountAmount != null ? Number(r.maxDiscountAmount) : null,
    usageLimit: r.usageLimit,
    usedCount: r.usedCount,
    startsAt,
    endsAt,
    isActive: r.isActive,
    allowedRole: r.allowedRole,
    status: deriveCouponStatus(
      {
        isActive: r.isActive,
        startsAt,
        endsAt,
        usageLimit: r.usageLimit,
        usedCount: r.usedCount,
      },
      now,
    ),
    source: r.sourceRuleId != null ? "reward" : "manual",
    sourceRuleName: r.sourceRule?.name ?? null,
    customerId: r.customer?.id ?? null,
    customerEmail: r.customer?.email ?? null,
    createdAt: toISOString(r.createdAt),
    customer: r.customer,
    sourceRule: r.sourceRule,
    sourceOrder: r.sourceOrder,
    redemptionCount: r._count.redemptions,
    discountGiven: roundMoney(Number(sum._sum.discountAmount ?? 0)),
  };
}

export interface CouponRedemptionRow {
  id: string;
  createdAt: string;
  discountAmount: number;
  counted: boolean;
  order: { id: string; orderNumber: string; status: OrderStatus };
  customer: { id: string; email: string };
}

export async function getCouponRedemptions(
  couponId: string,
): Promise<CouponRedemptionRow[]> {
  const rows = await db.couponRedemption.findMany({
    where: { couponId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      discountAmount: true,
      order: {
        select: { id: true, orderNumber: true, status: true, paidAt: true },
      },
      customer: { select: { id: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: toISOString(r.createdAt),
    discountAmount: Number(r.discountAmount),
    counted:
      r.order.paidAt != null &&
      !EXCLUDED_ORDER_STATUSES.includes(r.order.status),
    order: {
      id: r.order.id,
      orderNumber: r.order.orderNumber,
      status: r.order.status,
    },
    customer: r.customer,
  }));
}

export interface AdminRewardRuleListItem {
  id: string;
  name: string;
  minOrderTotal: number;
  rewardType: CouponType;
  rewardValue: number;
  rewardMaxDiscountAmount: number | null;
  rewardMinOrderAmount: number | null;
  validityDays: number;
  codePrefix: string;
  isActive: boolean;
  createdAt: string;
}

export async function getAdminRewardRuleList(): Promise<
  AdminRewardRuleListItem[]
> {
  const rows = await db.couponRewardRule.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      minOrderTotal: true,
      rewardType: true,
      rewardValue: true,
      rewardMaxDiscountAmount: true,
      rewardMinOrderAmount: true,
      validityDays: true,
      codePrefix: true,
      isActive: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    minOrderTotal: Number(r.minOrderTotal),
    rewardType: r.rewardType,
    rewardValue: Number(r.rewardValue),
    rewardMaxDiscountAmount:
      r.rewardMaxDiscountAmount != null
        ? Number(r.rewardMaxDiscountAmount)
        : null,
    rewardMinOrderAmount:
      r.rewardMinOrderAmount != null ? Number(r.rewardMinOrderAmount) : null,
    validityDays: r.validityDays,
    codePrefix: r.codePrefix,
    isActive: r.isActive,
    createdAt: toISOString(r.createdAt),
  }));
}

export async function getAdminRewardRuleStats(): Promise<
  Record<string, { issued: number; redeemed: number; discountGiven: number }>
> {
  const [rules, issuedGroups, redemptions] = await Promise.all([
    db.couponRewardRule.findMany({ select: { id: true } }),
    db.coupon.groupBy({
      by: ["sourceRuleId"],
      where: { sourceRuleId: { not: null } },
      _count: { _all: true },
    }),
    db.couponRedemption.findMany({
      where: { coupon: { sourceRuleId: { not: null } }, order: COUNTED_ORDER },
      select: {
        discountAmount: true,
        coupon: { select: { sourceRuleId: true } },
      },
    }),
  ]);

  const stats: Record<
    string,
    { issued: number; redeemed: number; discountGiven: number }
  > = {};
  for (const r of rules) {
    stats[r.id] = { issued: 0, redeemed: 0, discountGiven: 0 };
  }
  for (const g of issuedGroups) {
    if (g.sourceRuleId == null) continue;
    const entry = (stats[g.sourceRuleId] ??= {
      issued: 0,
      redeemed: 0,
      discountGiven: 0,
    });
    entry.issued = g._count._all;
  }
  for (const r of redemptions) {
    const ruleId = r.coupon.sourceRuleId;
    if (ruleId == null) continue;
    const entry = (stats[ruleId] ??= { issued: 0, redeemed: 0, discountGiven: 0 });
    entry.redeemed += 1;
    entry.discountGiven += Number(r.discountAmount);
  }
  for (const entry of Object.values(stats)) {
    entry.discountGiven = roundMoney(entry.discountGiven);
  }
  return stats;
}

export interface AdminRewardRuleDetail extends AdminRewardRuleListItem {
  stats: { issued: number; redeemed: number; discountGiven: number };
}

export async function getAdminRewardRuleDetail(
  id: string,
): Promise<AdminRewardRuleDetail | null> {
  const r = await db.couponRewardRule.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      minOrderTotal: true,
      rewardType: true,
      rewardValue: true,
      rewardMaxDiscountAmount: true,
      rewardMinOrderAmount: true,
      validityDays: true,
      codePrefix: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!r) return null;

  const redeemedWhere: Prisma.CouponRedemptionWhereInput = {
    coupon: { sourceRuleId: id },
    order: COUNTED_ORDER,
  };
  const [issued, redeemed, sum] = await Promise.all([
    db.coupon.count({ where: { sourceRuleId: id } }),
    db.couponRedemption.count({ where: redeemedWhere }),
    db.couponRedemption.aggregate({
      where: redeemedWhere,
      _sum: { discountAmount: true },
    }),
  ]);

  return {
    id: r.id,
    name: r.name,
    minOrderTotal: Number(r.minOrderTotal),
    rewardType: r.rewardType,
    rewardValue: Number(r.rewardValue),
    rewardMaxDiscountAmount:
      r.rewardMaxDiscountAmount != null
        ? Number(r.rewardMaxDiscountAmount)
        : null,
    rewardMinOrderAmount:
      r.rewardMinOrderAmount != null ? Number(r.rewardMinOrderAmount) : null,
    validityDays: r.validityDays,
    codePrefix: r.codePrefix,
    isActive: r.isActive,
    createdAt: toISOString(r.createdAt),
    stats: {
      issued,
      redeemed,
      discountGiven: roundMoney(Number(sum._sum.discountAmount ?? 0)),
    },
  };
}

export interface RuleIssuedCouponRow {
  id: string;
  code: string;
  status: CouponStatus;
  usedCount: number;
  usageLimit: number | null;
  createdAt: string;
  customer: { id: string; email: string } | null;
  sourceOrder: { id: string; orderNumber: string } | null;
}

export async function getRuleIssuedCoupons(
  ruleId: string,
  now: Date,
): Promise<{ rows: RuleIssuedCouponRow[]; total: number }> {
  const where: Prisma.CouponWhereInput = { sourceRuleId: ruleId };
  const [rows, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        code: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        usageLimit: true,
        usedCount: true,
        createdAt: true,
        customer: { select: { id: true, email: true } },
        sourceOrder: { select: { id: true, orderNumber: true } },
      },
    }),
    db.coupon.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: deriveCouponStatus(
        {
          isActive: r.isActive,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
          usageLimit: r.usageLimit,
          usedCount: r.usedCount,
        },
        now,
      ),
      usedCount: r.usedCount,
      usageLimit: r.usageLimit,
      createdAt: toISOString(r.createdAt),
      customer: r.customer,
      sourceOrder: r.sourceOrder,
    })),
    total,
  };
}

export interface CustomerCouponListItem {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  endsAt: string | null;
  minOrderAmount: number | null;
}

export async function getCustomerActiveCoupons(
  customerId: string,
): Promise<CustomerCouponListItem[]> {
  const rows = await db.coupon.findMany({
    where: {
      customerId,
      isActive: true,
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    orderBy: { endsAt: "asc" },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      endsAt: true,
      minOrderAmount: true,
      usageLimit: true,
      usedCount: true,
    },
  });

  return rows
    .filter((r) => !(r.usageLimit != null && r.usedCount >= r.usageLimit))
    .map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      value: Number(r.value),
      endsAt: r.endsAt != null ? toISOString(r.endsAt) : null,
      minOrderAmount: r.minOrderAmount != null ? Number(r.minOrderAmount) : null,
    }));
}

type CouponRejectionCode =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "ROLE_NOT_ALLOWED"
  | "MIN_ORDER_NOT_MET"
  | "USAGE_LIMIT_REACHED";

interface ResolveCouponContext {
  customerId: string;
  role: CustomerRole;
  goodsTotal: number;
  shippingCost: number;
  now?: Date;
}

type CouponResolution =
  | {
      valid: true;
      couponId: string;
      code: string;
      discountAmount: number;
      freeShipping: boolean;
    }
  | { valid: false; reason: CouponRejectionCode };

export async function resolveCoupon(
  rawCode: string,
  ctx: ResolveCouponContext,
  client: Prisma.TransactionClient = db,
): Promise<CouponResolution> {
  const code = rawCode.trim().toUpperCase();
  const coupon = await client.coupon.findUnique({ where: { code } });
  if (!coupon) return { valid: false, reason: "NOT_FOUND" };

  if (coupon.customerId != null && coupon.customerId !== ctx.customerId)
    return { valid: false, reason: "NOT_FOUND" };

  const now = ctx.now ?? new Date();

  if (!coupon.isActive) return { valid: false, reason: "INACTIVE" };
  if (coupon.startsAt && now < coupon.startsAt)
    return { valid: false, reason: "NOT_STARTED" };
  if (coupon.endsAt && now > coupon.endsAt)
    return { valid: false, reason: "EXPIRED" };
  if (coupon.allowedRole && coupon.allowedRole !== ctx.role)
    return { valid: false, reason: "ROLE_NOT_ALLOWED" };
  if (
    coupon.minOrderAmount != null &&
    ctx.goodsTotal < Number(coupon.minOrderAmount)
  )
    return { valid: false, reason: "MIN_ORDER_NOT_MET" };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
    return { valid: false, reason: "USAGE_LIMIT_REACHED" };

  let d: number;
  if (coupon.type === "PERCENTAGE") {
    d = roundMoney((ctx.goodsTotal * Number(coupon.value)) / 100);
    if (coupon.maxDiscountAmount != null)
      d = Math.min(d, Number(coupon.maxDiscountAmount));
    d = Math.min(d, ctx.goodsTotal);
  } else if (coupon.type === "FIXED") {
    d = Math.min(roundMoney(Number(coupon.value)), ctx.goodsTotal);
  } else {
    d = Math.max(0, roundMoney(ctx.shippingCost));
  }

  const freeShipping = coupon.type === "FREE_SHIPPING";

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountAmount: d,
    freeShipping,
  };
}

export interface BestAvailableReward {
  code: string;
  discountAmount: number;
  freeShipping: boolean;
}

export async function getBestAvailableReward(
  customerId: string,
  role: CustomerRole,
  goodsTotal: number,
): Promise<BestAvailableReward | null> {
  const candidates = await db.coupon.findMany({
    where: {
      customerId,
      isActive: true,
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    select: { code: true },
  });

  let best: BestAvailableReward | null = null;

  for (const { code } of candidates) {
    const resolution = await resolveCoupon(code, {
      customerId,
      role,
      goodsTotal,
      shippingCost: 0,
    });
    if (!resolution.valid) continue;
    if (best === null || resolution.discountAmount > best.discountAmount) {
      best = {
        code: resolution.code,
        discountAmount: resolution.discountAmount,
        freeShipping: resolution.freeShipping,
      };
    }
  }

  return best;
}
