"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireStaffAction } from "@/lib/auth-staff";
import { can } from "@/lib/utils/staff-permissions";
import { getSetting } from "@/lib/db/queries/settings";
import { buildAdminOrdersWhere } from "@/lib/db/queries/order";
import { OrderStatus } from "@/app/generated/prisma/enums";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { REFUND_STATE_LABELS, refundStateOf } from "@/lib/utils/refund";
import { roundMoney, sumMoney } from "@/lib/utils/currency";
import { dubaiDay } from "@/lib/utils/date";
import type { Prisma } from "@/app/generated/prisma/client";

const EXPORT_ROW_CAP = 5000;

const filtersSchema = z.object({
  view: z
    .enum(["FULFIL", "QUOTE", "AWAITING", "SHIPPED", "DELIVERED", "CLOSED"])
    .optional(),
  status: z.enum(OrderStatus).optional(),
  payment: z.enum(["ONLINE", "OFFLINE"]).optional(),
  source: z.enum(["CHECKOUT", "QUOTE"]).optional(),
  refund: z.enum(["OWED", "PARTIAL", "REFUNDED", "NONE"]).optional(),
  stale: z.boolean().optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["newest", "oldest", "total_desc", "total_asc"]).optional(),
});

const exportInputSchema = z.union([
  z.object({ filters: filtersSchema }),
  z.object({ orderIds: z.array(z.string().min(1)).min(1).max(500) }),
]);

export interface OrderExportRow {
  orderNumber: string;
  placed: string;
  status: string;
  payment: string;
  source: string;
  customer: string;
  email: string;
  units: number;
  subtotal: number;
  shipping: number;
  discount: number;
  pointsDiscount: number;
  vat: number;
  total: number;
  received: number;
  refundDue: number;
  refunded: number;
  owed: number;
  refundState: string;
  coupon: string;
  carrier: string;
  tracking: string;
  shippedOn: string;
  deliveredOn: string;
}

export interface OrderExportLine {
  orderNumber: string;
  placed: string;
  status: string;
  type: "Product" | "Add-on";
  item: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  serials: string;
}

export type ExportOrdersErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type ExportOrdersResult =
  | {
      success: true;
      rows: OrderExportRow[];
      lines: OrderExportLine[];
      truncated: boolean;
    }
  | { success: false; error: string; errorCode: ExportOrdersErrorCode };

export async function exportOrdersAction(
  input: unknown,
): Promise<ExportOrdersResult> {
  const staff = await requireStaffAction("order:read");

  if (
    !can(staff.staffRole, "order:update") &&
    !can(staff.staffRole, "order:mark_paid")
  ) {
    return {
      success: false,
      error: "You do not have permission to export orders.",
      errorCode: "FORBIDDEN",
    };
  }

  const parsed = exportInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid export request.",
      errorCode: "VALIDATION_ERROR",
    };
  }

  try {
    const data = parsed.data;
    const mode: "filtered" | "selected" =
      "filters" in data ? "filtered" : "selected";

    let where: Prisma.OrderWhereInput;
    if ("filters" in data) {
      const { staleShippedDays } = await getSetting("delivery_config");
      where = await buildAdminOrdersWhere(
        data.filters,
        new Date(Date.now() - staleShippedDays * 864e5),
      );
    } else {
      where = { id: { in: data.orderIds } };
    }

    const sort = "filters" in data ? data.filters.sort : undefined;
    const orderBy: Prisma.OrderOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : sort === "total_desc"
          ? [{ total: "desc" }, { id: "asc" }]
          : sort === "total_asc"
            ? [{ total: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "asc" }];

    const result = await db.$transaction(async (tx) => {
      const matching = await tx.order.count({ where });

      const orders = await tx.order.findMany({
        where,
        orderBy,
        take: EXPORT_ROW_CAP,
        select: {
          orderNumber: true,
          createdAt: true,
          status: true,
          paymentProvider: true,
          paidAt: true,
          subtotal: true,
          addonTotal: true,
          shippingCost: true,
          discountAmount: true,
          loyaltyDiscountAmount: true,
          taxAmount: true,
          total: true,
          refundDue: true,
          couponCode: true,
          carrier: true,
          trackingNumber: true,
          shippedAt: true,
          deliveredAt: true,
          customer: { select: { name: true, email: true } },
          convertedFromQuote: { select: { id: true } },
          settlements: { select: { amount: true } },
          refunds: { select: { amount: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              parentOrderItemId: true,
              itemType: true,
              itemNameEn: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              serials: {
                orderBy: { unitIndex: "asc" },
                select: { value: true },
              },
            },
          },
        },
      });

      const rows: OrderExportRow[] = orders.map((order) => {
        const received =
          order.settlements.length > 0
            ? sumMoney(order.settlements.map((s) => Number(s.amount)))
            : order.paidAt
              ? roundMoney(Number(order.total))
              : 0;
        const refundDue = roundMoney(Number(order.refundDue));
        const refunded = sumMoney(order.refunds.map((r) => Number(r.amount)));
        const state = refundStateOf(refundDue, refunded);
        return {
          orderNumber: order.orderNumber,
          placed: dubaiDay(order.createdAt),
          status: ORDER_STATUS_LABELS[order.status],
          payment: order.paymentProvider === "MANUAL" ? "Offline" : "Card",
          source: order.convertedFromQuote ? "Quote" : "Checkout",
          customer: order.customer.name,
          email: order.customer.email,
          units: order.items
            .filter((item) => item.itemType === "PRODUCT")
            .reduce((sum, item) => sum + item.quantity, 0),
          subtotal: roundMoney(
            Number(order.subtotal) + Number(order.addonTotal),
          ),
          shipping: roundMoney(Number(order.shippingCost)),
          discount: roundMoney(Number(order.discountAmount)),
          pointsDiscount: roundMoney(Number(order.loyaltyDiscountAmount)),
          vat: roundMoney(Number(order.taxAmount)),
          total: roundMoney(Number(order.total)),
          received,
          refundDue,
          refunded,
          owed: roundMoney(Math.max(refundDue - refunded, 0)),
          refundState: state === "NONE" ? "" : REFUND_STATE_LABELS[state],
          coupon: order.couponCode ?? "",
          carrier: order.carrier ?? "",
          tracking: order.trackingNumber ?? "",
          shippedOn: order.shippedAt ? dubaiDay(order.shippedAt) : "",
          deliveredOn: order.deliveredAt ? dubaiDay(order.deliveredAt) : "",
        };
      });

      const lines: OrderExportLine[] = orders.flatMap((order) => {
        const placed = dubaiDay(order.createdAt);
        const status = ORDER_STATUS_LABELS[order.status];
        const products = order.items.filter(
          (item) => item.itemType === "PRODUCT",
        );
        const productIds = new Set(products.map((item) => item.id));
        const addons = order.items.filter((item) => item.itemType !== "PRODUCT");
        const toLine = (
          item: (typeof order.items)[number],
          type: "Product" | "Add-on",
        ): OrderExportLine => ({
          orderNumber: order.orderNumber,
          placed,
          status,
          type,
          item: item.itemNameEn,
          quantity: item.quantity,
          unitPrice: roundMoney(Number(item.unitPrice)),
          lineTotal: roundMoney(Number(item.lineTotal)),
          serials: item.serials
            .map((s) => s.value)
            .filter((v): v is string => v !== null && v !== "")
            .join(", "),
        });
        const ordered: OrderExportLine[] = [];
        for (const product of products) {
          ordered.push(toLine(product, "Product"));
          for (const addon of addons) {
            if (addon.parentOrderItemId === product.id) {
              ordered.push(toLine(addon, "Add-on"));
            }
          }
        }
        for (const addon of addons) {
          if (
            addon.parentOrderItemId === null ||
            !productIds.has(addon.parentOrderItemId)
          ) {
            ordered.push(toLine(addon, "Add-on"));
          }
        }
        return ordered;
      });

      await tx.auditLog.create({
        data: {
          actorType: "STAFF",
          actorId: staff.id,
          action: "order.exported",
          entityType: "Order",
          entityId: null,
          metadata: {
            count: rows.length,
            lineCount: lines.length,
            mode,
            filters: "filters" in data ? data.filters : null,
            capped: matching > EXPORT_ROW_CAP,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { rows, lines, truncated: matching > EXPORT_ROW_CAP };
    });

    return { success: true, ...result };
  } catch (err) {
    console.error("[exportOrdersAction]", err);
    return {
      success: false,
      error: "The export could not be recorded, so no file was produced.",
      errorCode: "INTERNAL_ERROR",
    };
  }
}
