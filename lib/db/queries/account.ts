import "server-only";
import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";
import { deriveB2BStatus } from "@/lib/db/queries/b2b";
import { deriveVerificationStatus } from "@/lib/db/queries/verification";
import type { OrderStatus } from "@/app/generated/prisma/client";

export interface AccountNavProjection {
  role: "B2C" | "B2B";
  hasB2BAccount: boolean;
  verificationStatus:
    | "NOT_REQUIRED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED";
  openB2BRequestCount: number;
  verificationActionCount: number;
  quotesAwaitingResponseCount: number;
  supportWaitingCount: number;
}

export interface AccountOverviewProjection {
  name: string;
  email: string;
  createdAt: string;
  role: "B2C" | "B2B";
  verificationStatus:
    | "NOT_REQUIRED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "EXPIRED";
  verifiedAt: string | null;
  loyaltyPoints: number;
  ordersCount: number;
  wishlistCount: number;
  b2bStatus:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED"
    | "EXPIRED"
    | null;
  latestOrder: {
    orderNumber: string;
    status: OrderStatus;
    createdAt: string;
    totalAed: number;
  } | null;
}

export interface CustomerAddressProjection {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  emirate: string;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export async function getAccountNavData(
  customerId: string,
): Promise<AccountNavProjection | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      role: true,
      verificationStatus: true,
      verificationExpiresAt: true,
      b2bAccount: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!customer) return null;

  const latestB2BAccountId = customer.b2bAccount[0]?.id ?? null;

  const [openB2BRequestCount, quotesAwaitingResponseCount, supportWaitingCount] =
    await Promise.all([
      latestB2BAccountId
        ? db.documentRequest.count({
            where: { b2bAccountId: latestB2BAccountId, status: "OPEN" },
          })
        : Promise.resolve(0),
      db.quoteRequest.count({ where: { customerId, status: "QUOTED" } }),
      db.ticket.count({
        where: { createdByCustomerId: customerId, status: "WAITING_ON_CUSTOMER" },
      }),
    ]);

  const derivedVerification = deriveVerificationStatus(
    customer.verificationStatus,
    customer.verificationExpiresAt,
  );
  const verificationActionCount =
    derivedVerification === "REJECTED" || derivedVerification === "EXPIRED" ? 1 : 0;

  return {
    role: customer.role,
    hasB2BAccount: customer.b2bAccount.length > 0,
    verificationStatus: customer.verificationStatus,
    openB2BRequestCount,
    verificationActionCount,
    quotesAwaitingResponseCount,
    supportWaitingCount,
  };
}

export async function getAccountOverview(
  customerId: string,
): Promise<AccountOverviewProjection | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      role: true,
      verificationStatus: true,
      verifiedAt: true,
      loyaltyPoints: true,
      b2bAccount: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, expiresAt: true },
      },
    },
  });

  if (!customer) return null;

  const [ordersCount, wishlistCount, latestOrder] = await Promise.all([
    db.order.count({ where: { customerId } }),
    db.wishlistItem.count({ where: { customerId } }),
    db.order.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: {
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    name: customer.name,
    email: customer.email,
    createdAt: toISOString(customer.createdAt),
    role: customer.role,
    verificationStatus: customer.verificationStatus,
    verifiedAt: customer.verifiedAt ? toISOString(customer.verifiedAt) : null,
    loyaltyPoints: customer.loyaltyPoints,
    ordersCount,
    wishlistCount,
    b2bStatus: customer.b2bAccount[0]
      ? deriveB2BStatus(
          customer.b2bAccount[0].status,
          customer.b2bAccount[0].expiresAt,
        )
      : null,
    latestOrder: latestOrder
      ? {
          orderNumber: latestOrder.orderNumber,
          status: latestOrder.status,
          createdAt: toISOString(latestOrder.createdAt),
          totalAed: Number(latestOrder.total),
        }
      : null,
  };
}

export async function getCustomerAddresses(
  customerId: string,
): Promise<CustomerAddressProjection[]> {
  const rows = await db.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      fullName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      emirate: true,
      postalCode: true,
      country: true,
      isDefault: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    createdAt: toISOString(r.createdAt),
  }));
}

const LOYALTY_PAGE_SIZE = 20;

export interface LoyaltyTransactionProjection {
  id: string;
  type:
    | "EARNED"
    | "REDEEMED"
    | "ADJUSTED"
    | "EXPIRED"
    | "REFUNDED"
    | "REVERSED";
  delta: number;
  balanceAfter: number;
  reason: string | null;
  orderNumber: string | null;
  createdAt: string;
}

export interface LoyaltySummaryProjection {
  balance: number;
  transactions: LoyaltyTransactionProjection[];
  totalCount: number;
  pending: { points: number; orders: number };
}

export async function getLoyaltySummary(
  customerId: string,
  page = 1,
): Promise<LoyaltySummaryProjection | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { loyaltyPoints: true },
  });
  if (!customer) return null;

  const [totalCount, pendingAggregate, rows] = await Promise.all([
    db.loyaltyTransaction.count({ where: { customerId } }),
    db.order.aggregate({
      where: {
        customerId,
        loyaltyPointsFrozenAt: { not: null },
        loyaltyPointsEarned: { gt: 0 },
        status: {
          in: ["PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED"],
        },
      },
      _sum: { loyaltyPointsEarned: true },
      _count: { _all: true },
    }),
    db.loyaltyTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * LOYALTY_PAGE_SIZE,
      take: LOYALTY_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        delta: true,
        balanceAfter: true,
        reason: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  return {
    balance: customer.loyaltyPoints,
    totalCount,
    pending: {
      points: pendingAggregate._sum.loyaltyPointsEarned ?? 0,
      orders: pendingAggregate._count._all,
    },
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
      reason: r.reason,
      orderNumber: r.order?.orderNumber ?? null,
      createdAt: toISOString(r.createdAt),
    })),
  };
}
