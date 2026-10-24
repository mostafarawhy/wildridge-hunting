import "server-only";

import { db } from "@/lib/db/client";
import { toISOString, dubaiDayBoundsUtc } from "@/lib/utils/date";
import { getSetting } from "@/lib/db/queries/settings";
import { serialProgress } from "@/lib/utils/order-serials";
import {
  deriveVerificationStatus,
  type VerificationStatusProjection,
} from "@/lib/db/queries/verification";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import { isRegulatedOrder } from "@/lib/utils/order-regulated";
import { refundStateOf, type RefundState } from "@/lib/utils/refund";
import type {
  OrderStatus,
  PaymentMethod,
  RefundMethod,
  Prisma,
  QuoteStatus,
  TicketStatus,
} from "@/app/generated/prisma/client";
import type {
  ComplianceSnapshot,
  ShippingAddressSnapshot,
  ShippingMethodSnapshot,
} from "@/types/order";

export type { OrderStatus };

export interface OrderItemProjection {
  id: string;
  itemType: "PRODUCT" | "ADDON";
  name: string;
  imageUrl: string | null;
  unitPriceAed: number;
  quantity: number;
  lineTotalAed: number;
  parentOrderItemId: string | null;
  serials: { kind: "SERIAL" | "LOT"; values: string[] } | null;
}

export interface OrderConfirmationProjection {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemProjection[];
  subtotalAed: number;
  addonTotalAed: number;
  shippingCostAed: number;
  discountAmountAed: number;
  couponCode: string | null;
  taxAmountAed: number;
  vatRate: number;
  totalAed: number;
  shippingAddress: ShippingAddressSnapshot;
  shippingMethod: ShippingMethodSnapshot | null;
  customerNote: string | null;
  customerEmail: string;
  estimatedDelivery: string | null;
  carrier: string | null;
  parcelCount: number | null;
  shipmentNote: string | null;
  deliveredAt: string | null;
  paymentRef: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingQuotedAt: string | null;
  quoteRequestId: string | null;
  quoteRequestNumber: string | null;
  loyaltyPointsEarned: number;
  loyaltyPointsFrozen: boolean;
  loyaltyPointsUsed: number;
  loyaltyDiscountAmountAed: number;
  refundDueAed: number;
  refunds: {
    amountAed: number;
    refundedAt: string;
    method: RefundMethod;
    methodOtherLabel: string | null;
  }[];
  paymentProvider: "NGENIUS" | "MANUAL";
  billingAddress: ShippingAddressSnapshot | null;
  settlements: {
    externalReference: string;
    paidAt: string;
    amountAed: number;
  }[];
  regulated: boolean;
  businessBuyer: {
    nameEn: string;
    nameAr: string | null;
    trn: string | null;
    tradeLicenceNo: string | null;
  } | null;
}

export interface OrderListItemProjection {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalAed: number;
  itemCount: number;
  firstItemName: string;
  firstItemImageUrl: string | null;
}

export async function getCustomerOrders(
  customerId: string,
  locale: "en" | "ar" | "ru",
  page: number,
  pageSize: number,
): Promise<{ orders: OrderListItemProjection[]; totalCount: number }> {
  const [rawOrders, totalCount] = await db.$transaction([
    db.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        items: {
          where: { itemType: "PRODUCT" },
          select: {
            itemNameEn: true,
            itemNameAr: true,
            itemNameRu: true,
            itemImageSnapshot: true,
          },
        },
      },
    }),
    db.order.count({ where: { customerId } }),
  ]);

  const orders = rawOrders.map((order) => {
    const productItems = order.items;
    const first = productItems[0] ?? null;

    const firstItemName = first
      ? locale === "ar"
        ? first.itemNameAr
        : locale === "ru"
          ? (first.itemNameRu ?? first.itemNameEn)
          : first.itemNameEn
      : "";

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: toISOString(order.createdAt),
      totalAed: Number(order.total),
      itemCount: productItems.length,
      firstItemName,
      firstItemImageUrl: first?.itemImageSnapshot ?? null,
    };
  });

  return { orders, totalCount };
}

export async function getOrderForConfirmation(
  orderId: string,
  customerId: string,
  locale: "en" | "ar" | "ru",
): Promise<OrderConfirmationProjection | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { serialTracking: true, requiresIdVerification: true },
          },
          serials: { orderBy: { unitIndex: "asc" }, select: { value: true } },
        },
      },
      customer: {
        select: {
          email: true,
          role: true,
          b2bAccount: {
            where: { status: "APPROVED" },
            take: 1,
            select: {
              companyNameEn: true,
              companyNameAr: true,
              vatNumber: true,
              tradeLicenseNo: true,
            },
          },
        },
      },
      convertedFromQuote: {
        select: {
          id: true,
          quoteNumber: true,
          customerId: true,
          snapshotLegalNameEn: true,
          snapshotLegalNameAr: true,
          snapshotVatNumber: true,
          snapshotTradeLicenseNo: true,
        },
      },
      refunds: {
        orderBy: { refundedAt: "asc" },
        select: {
          amount: true,
          refundedAt: true,
          method: true,
          methodOtherLabel: true,
        },
      },
      settlements: {
        orderBy: { paidAt: "asc" },
        select: { externalReference: true, paidAt: true, amount: true },
      },
    },
  });

  if (!order || order.customerId !== customerId) return null;

  const { vatRate } = await getSetting("tax_config");

  const items: OrderItemProjection[] = order.items.map((item) => {
    const name =
      locale === "ar"
        ? item.itemNameAr
        : locale === "ru"
          ? (item.itemNameRu ?? item.itemNameEn)
          : item.itemNameEn;

    return {
      id: item.id,
      itemType: item.itemType as "PRODUCT" | "ADDON",
      name,
      imageUrl: item.itemImageSnapshot ?? null,
      unitPriceAed: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotalAed: Number(item.lineTotal),
      parentOrderItemId: item.parentOrderItemId,
      serials: (() => {
        const values = item.serials
          .map((entry) => entry.value)
          .filter((value): value is string => value !== null && value !== "");
        const kind: "SERIAL" | "LOT" =
          item.product?.serialTracking === "LOT" ? "LOT" : "SERIAL";
        return values.length > 0 ? { kind, values } : null;
      })(),
    };
  });

  const snap = order.shippingMethodSnapshot as ShippingMethodSnapshot | null;

  const linkedQuote =
    order.convertedFromQuote &&
    order.convertedFromQuote.customerId === customerId
      ? order.convertedFromQuote
      : null;

  const quoteBuyerName = order.convertedFromQuote?.snapshotLegalNameEn?.trim();
  const approvedAccount =
    order.customer.role === "B2B" ? (order.customer.b2bAccount[0] ?? null) : null;
  const businessBuyer: OrderConfirmationProjection["businessBuyer"] =
    order.convertedFromQuote && quoteBuyerName
      ? {
          nameEn: quoteBuyerName,
          nameAr: order.convertedFromQuote.snapshotLegalNameAr,
          trn: order.convertedFromQuote.snapshotVatNumber,
          tradeLicenceNo: order.convertedFromQuote.snapshotTradeLicenseNo,
        }
      : approvedAccount
        ? {
            nameEn: approvedAccount.companyNameEn,
            nameAr: approvedAccount.companyNameAr,
            trn: approvedAccount.vatNumber,
            tradeLicenceNo: approvedAccount.tradeLicenseNo,
          }
        : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: toISOString(order.createdAt),
    paidAt: order.paidAt ? toISOString(order.paidAt) : null,
    items,
    subtotalAed: Number(order.subtotal),
    addonTotalAed: Number(order.addonTotal),
    shippingCostAed: Number(order.shippingCost),
    discountAmountAed: Number(order.discountAmount),
    loyaltyPointsEarned: order.loyaltyPointsEarned,
    loyaltyPointsFrozen: order.loyaltyPointsFrozenAt !== null,
    loyaltyPointsUsed: order.loyaltyPointsUsed,
    loyaltyDiscountAmountAed: Number(order.loyaltyDiscountAmount),
    couponCode: order.couponCode,
    taxAmountAed: Number(order.taxAmount),
    vatRate,
    totalAed: Number(order.total),
    shippingAddress: order.shippingAddressSnapshot as ShippingAddressSnapshot,
    shippingMethod: snap,
    customerNote: order.customerNote,
    customerEmail: order.customer.email,
    estimatedDelivery: order.estimatedDelivery
      ? toISOString(order.estimatedDelivery)
      : null,
    carrier: order.carrier,
    parcelCount: order.parcelCount,
    shipmentNote: order.shipmentNote,
    deliveredAt: order.deliveredAt ? toISOString(order.deliveredAt) : null,
    paymentRef: order.nGeniusOrderRef,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shippingQuotedAt: order.shippingQuotedAt
      ? toISOString(order.shippingQuotedAt)
      : null,
    quoteRequestId: linkedQuote?.id ?? null,
    quoteRequestNumber: linkedQuote?.quoteNumber ?? null,
    refundDueAed: roundMoney(Number(order.refundDue)),
    refunds: order.refunds.map((refund) => ({
      amountAed: Number(refund.amount),
      refundedAt: toISOString(refund.refundedAt),
      method: refund.method,
      methodOtherLabel: refund.methodOtherLabel ?? null,
    })),
    paymentProvider: order.paymentProvider,
    billingAddress:
      (order.billingAddressSnapshot as ShippingAddressSnapshot | null) ?? null,
    settlements: order.settlements.map((payment) => ({
      externalReference: payment.externalReference,
      paidAt: toISOString(payment.paidAt),
      amountAed: Number(payment.amount),
    })),
    regulated: isRegulatedOrder(order.complianceSnapshot, order.items),
    businessBuyer,
  };
}

export interface AdminOrderListItemProjection {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  shippedAt: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalAed: number;
  itemCount: number;
  firstItemName: string;
  paymentProvider: string;
  fromQuote: boolean;
  refundState: RefundState;
  owedAed: number;
  regulated: boolean;
}

export interface AdminOrderEventProjection {
  id: string;
  actor: string;
  staffName: string | null;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  rawPayload: Prisma.JsonValue | null;
  createdAt: string;
}

export interface AdminOrderSettlementProjection {
  id: string;
  method: PaymentMethod;
  methodOtherLabel: string | null;
  externalReference: string;
  amountAed: number;
  paidAt: string;
  recordedByName: string | null;
  notes: string | null;
  filename: string;
  mimeType: string | null;
}

export interface AdminOrderRefundProjection {
  id: string;
  method: RefundMethod;
  methodOtherLabel: string | null;
  externalReference: string;
  amountAed: number;
  refundedAt: string;
  recordedByName: string | null;
  notes: string | null;
  filename: string;
  mimeType: string | null;
}

export interface AdminOrderComplianceDocumentProjection {
  id: string;
  source: "VERIFICATION" | "B2B";
  documentKind: string;
  documentType: string | null;
  filename: string;
  mimeType: string | null;
  declaredNumber: string | null;
  archivedAt: string | null;
  createdAt: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseComplianceSnapshot(raw: unknown): ComplianceSnapshot | null {
  if (!isPlainRecord(raw) || typeof raw.snapshotAt !== "string") return null;

  const verification = isPlainRecord(raw.verification)
    ? ({
        ...raw.verification,
        documents: Array.isArray(raw.verification.documents)
          ? raw.verification.documents
          : [],
      } as unknown as ComplianceSnapshot["verification"])
    : null;

  const b2b = isPlainRecord(raw.b2b)
    ? ({
        ...raw.b2b,
        documents: Array.isArray(raw.b2b.documents) ? raw.b2b.documents : [],
      } as unknown as ComplianceSnapshot["b2b"])
    : null;

  return {
    snapshotAt: raw.snapshotAt,
    verification,
    b2b,
    restrictedSkus: Array.isArray(raw.restrictedSkus)
      ? raw.restrictedSkus.filter((s): s is string => typeof s === "string")
      : [],
  };
}

export interface AdminOrderDetailItemProjection {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPriceAed: number;
  quantity: number;
  lineTotalAed: number;
  itemType: "PRODUCT" | "ADDON";
  parentOrderItemId: string | null;
  productSku: string | null;
  serialTracking: "NONE" | "SERIAL" | "LOT";
  serials: {
    unitIndex: number;
    value: string | null;
    overrideReason: string | null;
    recordedByName: string;
    updatedAt: string;
  }[];
}

export interface AdminOrderDetailProjection {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  customerNote: string | null;
  internalNote: string | null;
  subtotalAed: number;
  addonTotalAed: number;
  shippingCostAed: number;
  discountAmountAed: number;
  loyaltyPointsUsed: number;
  loyaltyDiscountAmountAed: number;
  taxAmountAed: number;
  totalAed: number;
  paymentProvider: string;
  paymentRef: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  parcelCount: number | null;
  shipmentNote: string | null;
  estimatedDelivery: string | null;
  deliveryReceivedBy: string | null;
  deliveryIdChecked: boolean | null;
  deliveryNote: string | null;
  deliveryProofFilename: string | null;
  regulated: boolean;
  complianceSnapshot: ComplianceSnapshot | null;
  complianceDocuments: AdminOrderComplianceDocumentProjection[];
  shippingAddressSnapshot: ShippingAddressSnapshot;
  couponCode: string | null;
  loyaltyPointsEarned: number;
  loyaltyCreditedPoints: number;
  loyaltyPointsFrozenAt: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    verificationStatus: ReturnType<typeof deriveVerificationStatus>;
    latestVerificationEventId: string | null;
  };
  items: AdminOrderDetailItemProjection[];
  serialProgress: { required: number; recorded: number };
  events: AdminOrderEventProjection[];
  settlements: AdminOrderSettlementProjection[];
  receivedAed: number;
  refundDueAed: number;
  refunds: AdminOrderRefundProjection[];
  refundedAed: number;
  owedAed: number;
  refundState: RefundState;
  shippingQuotedAt: string | null;
  shippingQuotedBy: string | null;
  shippingQuotedByName: string | null;
  quoteRequestId: string | null;
  quoteRequestNumber: string | null;
  quoteRequestStatus: QuoteStatus | null;
  quoteRequestCreatedAt: string | null;
}

export interface AdminOrderLinkedRecords {
  tickets: {
    total: number;
    items: {
      id: string;
      ticketNumber: string;
      status: TicketStatus;
      createdAt: string;
    }[];
  };
  couponId: string | null;
}

export interface OrderPaymentMintSource {
  storageKey: string;
  filename: string;
  orderNumber: string;
}

export async function getOrderPaymentForMint(
  orderId: string,
  paymentId: string,
): Promise<OrderPaymentMintSource | null> {
  const payment = await db.orderPayment.findFirst({
    where: { id: paymentId, orderId },
    select: {
      storageKey: true,
      filename: true,
      order: { select: { orderNumber: true } },
    },
  });
  if (!payment) return null;
  return {
    storageKey: payment.storageKey,
    filename: payment.filename,
    orderNumber: payment.order.orderNumber,
  };
}

export const ADMIN_ORDER_VIEWS = {
  FULFIL: ["PAID", "CONFIRMED", "PROCESSING", "READY_TO_SHIP"],
  QUOTE: ["AWAITING_SHIPPING_QUOTE"],
  AWAITING: [
    "AWAITING_QUOTE_APPROVAL",
    "AWAITING_MANUAL_PAYMENT",
    "PAYMENT_PENDING",
    "PAYMENT_FAILED",
  ],
  SHIPPED: ["SHIPPED"],
  DELIVERED: ["DELIVERED"],
  CLOSED: ["CANCELLED", "RETURNED"],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type AdminOrderView = keyof typeof ADMIN_ORDER_VIEWS;

export interface AdminOrderFilters {
  view?: AdminOrderView;
  status?: OrderStatus;
  payment?: "ONLINE" | "OFFLINE";
  source?: "CHECKOUT" | "QUOTE";
  refund?: "OWED" | "PARTIAL" | "REFUNDED" | "NONE";
  stale?: boolean;
  from?: string;
  to?: string;
  search?: string;
  sort?: "newest" | "oldest" | "total_desc" | "total_asc";
}

export interface AdminOrdersSummary {
  all: number;
  fulfil: number;
  quote: number;
  awaiting: number;
  shipped: number;
  staleShipped: number;
  delivered: number;
  refundsOwed: number;
  closed: number;
}

export interface AdminOrdersPage {
  rows: AdminOrderListItemProjection[];
  total: number;
  page: number;
  totalPages: number;
  summary: AdminOrdersSummary;
}

const ADMIN_ORDER_ORDER_BY: Record<
  NonNullable<AdminOrderFilters["sort"]>,
  Prisma.OrderOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  total_desc: [{ total: "desc" }, { id: "asc" }],
  total_asc: [{ total: "asc" }, { id: "asc" }],
};

export async function refundOrderIds(
  kind: NonNullable<AdminOrderFilters["refund"]>,
): Promise<string[]> {
  let rows: { id: string }[];
  if (kind === "OWED") {
    rows = await db.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o
      LEFT JOIN (
        SELECT "orderId", SUM(amount) AS refunded FROM "OrderRefund" GROUP BY "orderId"
      ) r ON r."orderId" = o.id
      WHERE o."refundDue" - COALESCE(r.refunded, 0) > 0
    `;
  } else if (kind === "PARTIAL") {
    rows = await db.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o
      LEFT JOIN (
        SELECT "orderId", SUM(amount) AS refunded FROM "OrderRefund" GROUP BY "orderId"
      ) r ON r."orderId" = o.id
      WHERE o."refundDue" > 0
        AND COALESCE(r.refunded, 0) > 0
        AND COALESCE(r.refunded, 0) < o."refundDue"
    `;
  } else if (kind === "REFUNDED") {
    rows = await db.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o
      LEFT JOIN (
        SELECT "orderId", SUM(amount) AS refunded FROM "OrderRefund" GROUP BY "orderId"
      ) r ON r."orderId" = o.id
      WHERE o."refundDue" > 0 AND COALESCE(r.refunded, 0) >= o."refundDue"
    `;
  } else {
    rows = await db.$queryRaw<{ id: string }[]>`
      SELECT o.id FROM "Order" o WHERE o."refundDue" = 0
    `;
  }
  return rows.map((r) => r.id);
}

export async function buildAdminOrdersWhere(
  opts: AdminOrderFilters,
  staleCutoff: Date,
): Promise<Prisma.OrderWhereInput> {
  const and: Prisma.OrderWhereInput[] = [];

  if (opts.view) {
    and.push({ status: { in: [...ADMIN_ORDER_VIEWS[opts.view]] } });
  }
  if (opts.status) {
    and.push({ status: opts.status });
  }
  if (opts.stale) {
    and.push({ status: "SHIPPED", shippedAt: { lt: staleCutoff } });
  }
  if (opts.payment === "ONLINE") {
    and.push({ paymentProvider: "NGENIUS" });
  } else if (opts.payment === "OFFLINE") {
    and.push({ paymentProvider: "MANUAL" });
  }
  if (opts.source === "QUOTE") {
    and.push({ convertedFromQuote: { isNot: null } });
  } else if (opts.source === "CHECKOUT") {
    and.push({ convertedFromQuote: { is: null } });
  }
  if (opts.refund) {
    and.push({ id: { in: await refundOrderIds(opts.refund) } });
  }

  const term = opts.search?.trim();
  if (term) {
    and.push({
      OR: [
        { orderNumber: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
        { customer: { email: { contains: term, mode: "insensitive" } } },
        {
          items: {
            some: {
              serials: {
                some: { value: { contains: term, mode: "insensitive" } },
              },
            },
          },
        },
      ],
    });
  }

  const fromBounds = opts.from ? dubaiDayBoundsUtc(opts.from) : null;
  const toBounds = opts.to ? dubaiDayBoundsUtc(opts.to) : null;
  if (fromBounds || toBounds) {
    and.push({
      createdAt: {
        ...(fromBounds ? { gte: fromBounds.start } : {}),
        ...(toBounds ? { lt: toBounds.end } : {}),
      },
    });
  }

  return { AND: and };
}

export async function getAdminOrders(
  opts: AdminOrderFilters & { page: number; pageSize: number },
): Promise<AdminOrdersPage> {
  const { staleShippedDays } = await getSetting("delivery_config");
  const staleCutoff = new Date(Date.now() - staleShippedDays * 864e5);
  const where = await buildAdminOrdersWhere(opts, staleCutoff);

  const [
    total,
    summaryAll,
    summaryFulfil,
    summaryQuote,
    summaryAwaiting,
    summaryShipped,
    summaryStaleShipped,
    summaryDelivered,
    summaryRefundsOwed,
    summaryClosed,
  ] = await Promise.all([
    db.order.count({ where }),
    db.order.count(),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.FULFIL] } },
    }),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.QUOTE] } },
    }),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.AWAITING] } },
    }),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.SHIPPED] } },
    }),
    db.order.count({
      where: { status: "SHIPPED", shippedAt: { lt: staleCutoff } },
    }),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.DELIVERED] } },
    }),
    refundOrderIds("OWED").then((ids) => ids.length),
    db.order.count({
      where: { status: { in: [...ADMIN_ORDER_VIEWS.CLOSED] } },
    }),
  ]);

  const summary: AdminOrdersSummary = {
    all: summaryAll,
    fulfil: summaryFulfil,
    quote: summaryQuote,
    awaiting: summaryAwaiting,
    shipped: summaryShipped,
    staleShipped: summaryStaleShipped,
    delivered: summaryDelivered,
    refundsOwed: summaryRefundsOwed,
    closed: summaryClosed,
  };

  const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), totalPages);

  const rows = await db.order.findMany({
    where,
    orderBy: ADMIN_ORDER_ORDER_BY[opts.sort ?? "newest"],
    skip: (page - 1) * opts.pageSize,
    take: opts.pageSize,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      shippedAt: true,
      total: true,
      customerId: true,
      refundDue: true,
      paymentProvider: true,
      complianceSnapshot: true,
      convertedFromQuote: { select: { id: true } },
      refunds: { select: { amount: true } },
      customer: { select: { name: true, email: true } },
      items: {
        where: { itemType: "PRODUCT" },
        select: {
          itemNameEn: true,
          product: { select: { requiresIdVerification: true } },
        },
      },
    },
  });

  const items: AdminOrderListItemProjection[] = rows.map((row) => {
    const refundDueAed = roundMoney(Number(row.refundDue));
    const refundedAed = sumMoney(row.refunds.map((r) => Number(r.amount)));
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      createdAt: toISOString(row.createdAt),
      shippedAt: row.shippedAt ? toISOString(row.shippedAt) : null,
      customerId: row.customerId,
      customerName: row.customer.name,
      customerEmail: row.customer.email,
      totalAed: Number(row.total),
      itemCount: row.items.length,
      firstItemName: row.items[0]?.itemNameEn ?? "",
      paymentProvider: row.paymentProvider,
      fromQuote: row.convertedFromQuote !== null,
      refundState: refundStateOf(refundDueAed, refundedAed),
      owedAed: roundMoney(Math.max(refundDueAed - refundedAed, 0)),
      regulated: isRegulatedOrder(row.complianceSnapshot, row.items),
    };
  });

  return { rows: items, total, page, totalPages, summary };
}

export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetailProjection | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      paidAt: true,
      shippedAt: true,
      deliveredAt: true,
      customerNote: true,
      internalNote: true,
      subtotal: true,
      addonTotal: true,
      shippingCost: true,
      discountAmount: true,
      loyaltyPointsUsed: true,
      loyaltyDiscountAmount: true,
      loyaltyPointsEarned: true,
      loyaltyPointsFrozenAt: true,
      couponCode: true,
      taxAmount: true,
      total: true,
      refundDue: true,
      paymentProvider: true,
      nGeniusOrderRef: true,
      trackingNumber: true,
      trackingUrl: true,
      carrier: true,
      parcelCount: true,
      shipmentNote: true,
      estimatedDelivery: true,
      deliveryReceivedBy: true,
      deliveryIdChecked: true,
      deliveryNote: true,
      deliveryProofFilename: true,
      complianceSnapshot: true,
      shippingQuotedAt: true,
      shippingQuotedBy: true,
      shippingAddressSnapshot: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          verificationStatus: true,
          verificationExpiresAt: true,
        },
      },
      convertedFromQuote: {
        select: { id: true, quoteNumber: true, status: true, createdAt: true },
      },
      items: {
        select: {
          id: true,
          itemType: true,
          itemNameEn: true,
          itemImageSnapshot: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
          parentOrderItemId: true,
          productSku: true,
          product: {
            select: { serialTracking: true, requiresIdVerification: true },
          },
          serials: {
            orderBy: { unitIndex: "asc" },
            select: {
              unitIndex: true,
              value: true,
              overrideReason: true,
              updatedAt: true,
              recordedBy: { select: { name: true } },
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          actor: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          trackingNumber: true,
          trackingUrl: true,
          rawPayload: true,
          createdAt: true,
          staff: { select: { name: true } },
        },
      },
      complianceDocuments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          source: true,
          documentKind: true,
          documentType: true,
          filename: true,
          mimeType: true,
          declaredNumber: true,
          archivedAt: true,
          createdAt: true,
        },
      },
      settlements: {
        orderBy: { paidAt: "asc" },
        select: {
          id: true,
          method: true,
          methodOtherLabel: true,
          externalReference: true,
          amount: true,
          paidAt: true,
          notes: true,
          filename: true,
          mimeType: true,
          recordedBy: { select: { name: true } },
        },
      },
      refunds: {
        orderBy: { refundedAt: "asc" },
        select: {
          id: true,
          method: true,
          methodOtherLabel: true,
          externalReference: true,
          amount: true,
          refundedAt: true,
          notes: true,
          filename: true,
          mimeType: true,
          recordedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!order) return null;

  const latestVerificationEvent = await db.verificationEvent.findFirst({
    where: { customerId: order.customer.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const loyaltyCredited = await db.loyaltyTransaction.aggregate({
    where: { orderId: order.id, type: "EARNED" },
    _sum: { delta: true },
  });

  const items: AdminOrderDetailItemProjection[] = order.items.map((item) => ({
    id: item.id,
    name: item.itemNameEn,
    imageUrl: item.itemImageSnapshot ?? null,
    unitPriceAed: Number(item.unitPrice),
    quantity: item.quantity,
    lineTotalAed: Number(item.lineTotal),
    itemType: item.itemType as "PRODUCT" | "ADDON",
    parentOrderItemId: item.parentOrderItemId,
    productSku: item.productSku,
    serialTracking:
      item.itemType === "PRODUCT"
        ? (item.product?.serialTracking ?? "NONE")
        : "NONE",
    serials: item.serials.map((s) => ({
      unitIndex: s.unitIndex,
      value: s.value,
      overrideReason: s.overrideReason,
      recordedByName: s.recordedBy.name,
      updatedAt: toISOString(s.updatedAt),
    })),
  }));

  const serialProgressValue = serialProgress(
    items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      productSku: item.productSku,
      name: item.name,
      quantity: item.quantity,
      serialTracking: item.serialTracking,
      serials: item.serials,
    })),
  );

  const events: AdminOrderEventProjection[] = order.events.map((event) => ({
    id: event.id,
    actor: event.actor,
    staffName: event.staff?.name ?? null,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note ?? null,
    trackingNumber: event.trackingNumber ?? null,
    trackingUrl: event.trackingUrl ?? null,
    rawPayload: event.rawPayload ?? null,
    createdAt: toISOString(event.createdAt),
  }));

  const settlements: AdminOrderSettlementProjection[] = order.settlements.map(
    (settlement) => ({
      id: settlement.id,
      method: settlement.method,
      methodOtherLabel: settlement.methodOtherLabel ?? null,
      externalReference: settlement.externalReference,
      amountAed: Number(settlement.amount),
      paidAt: toISOString(settlement.paidAt),
      recordedByName: settlement.recordedBy?.name ?? null,
      notes: settlement.notes ?? null,
      filename: settlement.filename,
      mimeType: settlement.mimeType ?? null,
    }),
  );

  const refunds: AdminOrderRefundProjection[] = order.refunds.map((refund) => ({
    id: refund.id,
    method: refund.method,
    methodOtherLabel: refund.methodOtherLabel ?? null,
    externalReference: refund.externalReference,
    amountAed: Number(refund.amount),
    refundedAt: toISOString(refund.refundedAt),
    recordedByName: refund.recordedBy?.name ?? null,
    notes: refund.notes ?? null,
    filename: refund.filename,
    mimeType: refund.mimeType ?? null,
  }));

  const receivedAed =
    settlements.length > 0
      ? sumMoney(settlements.map((s) => s.amountAed))
      : order.paidAt
        ? roundMoney(Number(order.total))
        : 0;
  const refundDueAed = roundMoney(Number(order.refundDue));
  const refundedAed = sumMoney(refunds.map((r) => r.amountAed));
  const owedAed = roundMoney(Math.max(refundDueAed - refundedAed, 0));

  const quotedByName = order.shippingQuotedBy
    ? ((
        await db.staff.findUnique({
          where: { id: order.shippingQuotedBy },
          select: { name: true },
        })
      )?.name ?? null)
    : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: toISOString(order.createdAt),
    paidAt: order.paidAt ? toISOString(order.paidAt) : null,
    shippedAt: order.shippedAt ? toISOString(order.shippedAt) : null,
    deliveredAt: order.deliveredAt ? toISOString(order.deliveredAt) : null,
    customerNote: order.customerNote,
    internalNote: order.internalNote,
    subtotalAed: Number(order.subtotal),
    addonTotalAed: Number(order.addonTotal),
    shippingCostAed: Number(order.shippingCost),
    discountAmountAed: Number(order.discountAmount),
    loyaltyPointsUsed: order.loyaltyPointsUsed,
    loyaltyDiscountAmountAed: Number(order.loyaltyDiscountAmount),
    taxAmountAed: Number(order.taxAmount),
    totalAed: Number(order.total),
    paymentProvider: order.paymentProvider,
    paymentRef: order.nGeniusOrderRef,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    carrier: order.carrier,
    parcelCount: order.parcelCount,
    shipmentNote: order.shipmentNote,
    estimatedDelivery: order.estimatedDelivery
      ? toISOString(order.estimatedDelivery)
      : null,
    deliveryReceivedBy: order.deliveryReceivedBy,
    deliveryIdChecked: order.deliveryIdChecked,
    deliveryNote: order.deliveryNote,
    deliveryProofFilename: order.deliveryProofFilename,
    regulated:
      (Array.isArray(
        (order.complianceSnapshot as { restrictedSkus?: unknown } | null)
          ?.restrictedSkus,
      ) &&
        (
          (order.complianceSnapshot as { restrictedSkus: unknown[] })
            .restrictedSkus
        ).length > 0) ||
      order.items.some((item) => item.product?.requiresIdVerification === true),
    complianceSnapshot: parseComplianceSnapshot(order.complianceSnapshot),
    complianceDocuments: order.complianceDocuments.map((doc) => ({
      id: doc.id,
      source: doc.source,
      documentKind: doc.documentKind,
      documentType: doc.documentType,
      filename: doc.filename,
      mimeType: doc.mimeType,
      declaredNumber: doc.declaredNumber,
      archivedAt: doc.archivedAt ? toISOString(doc.archivedAt) : null,
      createdAt: toISOString(doc.createdAt),
    })),
    shippingAddressSnapshot:
      order.shippingAddressSnapshot as ShippingAddressSnapshot,
    couponCode: order.couponCode,
    loyaltyPointsEarned: order.loyaltyPointsEarned,
    loyaltyCreditedPoints: loyaltyCredited._sum.delta ?? 0,
    loyaltyPointsFrozenAt: order.loyaltyPointsFrozenAt
      ? toISOString(order.loyaltyPointsFrozenAt)
      : null,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      email: order.customer.email,
      verificationStatus: deriveVerificationStatus(
        order.customer
          .verificationStatus as VerificationStatusProjection["status"],
        order.customer.verificationExpiresAt,
      ),
      latestVerificationEventId: latestVerificationEvent?.id ?? null,
    },
    items,
    serialProgress: serialProgressValue,
    events,
    settlements,
    receivedAed,
    refundDueAed,
    refunds,
    refundedAed,
    owedAed,
    refundState: refundStateOf(refundDueAed, refundedAed),
    shippingQuotedAt: order.shippingQuotedAt
      ? toISOString(order.shippingQuotedAt)
      : null,
    shippingQuotedBy: order.shippingQuotedBy,
    shippingQuotedByName: quotedByName,
    quoteRequestId: order.convertedFromQuote?.id ?? null,
    quoteRequestNumber: order.convertedFromQuote?.quoteNumber ?? null,
    quoteRequestStatus: order.convertedFromQuote?.status ?? null,
    quoteRequestCreatedAt: order.convertedFromQuote
      ? toISOString(order.convertedFromQuote.createdAt)
      : null,
  };
}

export async function getAdminOrderLinkedRecords(
  orderId: string,
  couponCode: string | null,
): Promise<AdminOrderLinkedRecords> {
  const [ticketTotal, tickets, coupon] = await Promise.all([
    db.ticket.count({ where: { orderId } }),
    db.ticket.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        createdAt: true,
      },
    }),
    couponCode
      ? db.coupon.findUnique({
          where: { code: couponCode },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    tickets: {
      total: ticketTotal,
      items: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        status: t.status,
        createdAt: toISOString(t.createdAt),
      })),
    },
    couponId: coupon?.id ?? null,
  };
}

export interface OrderUnwindPreview {
  stock: { sku: string; name: string; units: number }[];
  pointsHeld: number;
  pointsEarnedNet: number;
  customerBalance: number;
  couponCode: string | null;
  rewardCouponCodes: string[];
  serialUnits: number;
  hasSaleRows: boolean;
}

export async function getOrderUnwindPreview(
  orderId: string,
): Promise<OrderUnwindPreview | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      customerId: true,
      convertedFromQuote: { select: { id: true } },
      customer: { select: { loyaltyPoints: true } },
    },
  });
  if (!order) return null;

  const [movements, held, earned, redemption, rewards, serialUnits, saleRows] =
    await Promise.all([
      order.convertedFromQuote
        ? Promise.resolve([])
        : db.stockMovement.groupBy({
            by: ["productSku"],
            where: { reference: orderId },
            _sum: { delta: true },
          }),
      db.loyaltyTransaction.aggregate({
        where: { orderId, type: { in: ["REDEEMED", "REFUNDED"] } },
        _sum: { delta: true },
      }),
      db.loyaltyTransaction.aggregate({
        where: { orderId, type: { in: ["EARNED", "REVERSED"] } },
        _sum: { delta: true },
      }),
      db.couponRedemption.findUnique({
        where: { orderId },
        select: { coupon: { select: { code: true } } },
      }),
      db.coupon.findMany({
        where: { sourceOrderId: orderId, usedCount: 0, isActive: true },
        select: { code: true },
        orderBy: { code: "asc" },
      }),
      db.orderItemSerial.count({ where: { orderItem: { orderId } } }),
      db.stockMovement.count({ where: { reference: orderId, type: "SALE" } }),
    ]);

  const returning = movements
    .map((m) => ({ sku: m.productSku, units: -(m._sum.delta ?? 0) }))
    .filter((m) => m.units > 0);

  const products = returning.length
    ? await db.product.findMany({
        where: { sku: { in: returning.map((m) => m.sku) } },
        select: { sku: true, nameEn: true },
      })
    : [];
  const names = new Map(products.map((p) => [p.sku, p.nameEn]));

  return {
    stock: returning
      .map((m) => ({
        sku: m.sku,
        name: names.get(m.sku) ?? m.sku,
        units: m.units,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    pointsHeld: Math.max(-(held._sum.delta ?? 0), 0),
    pointsEarnedNet: earned._sum.delta ?? 0,
    customerBalance: order.customer.loyaltyPoints,
    couponCode: redemption?.coupon.code ?? null,
    rewardCouponCodes: rewards.map((c) => c.code),
    serialUnits,
    hasSaleRows: saleRows > 0,
  };
}
