import "server-only";

import { db } from "@/lib/db/client";
import { getSetting } from "@/lib/db/queries/settings";
import { clientEnv } from "@/lib/env.client";
import { getCountryName } from "@/lib/data/countries";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatAED, sumMoney } from "@/lib/utils/currency";
import {
  CUSTOMER_ORDER_NOTE,
  STAFF_ORDERS_NOTE,
  type EmailAddress,
  type EmailChromeBadge,
  type EmailChromeOptions,
  type EmailInfoRow,
  type EmailOrderSummary,
  type EmailSummaryItem,
} from "@/lib/email/chrome";
import type {
  ShippingAddressSnapshot,
  ShippingMethodSnapshot,
} from "@/types/order";

const APP_BASE_URL = clientEnv.NEXT_PUBLIC_APP_URL ?? "";

export interface OrderEmailData {
  id: string;
  orderNumber: string;
  orderDate: string;
  deliveredDate: string | null;
  deliveryReceivedBy: string | null;
  customerName: string;
  customerEmail: string;
  quoteNumber: string | null;
  shippingPending: boolean;
  total: number;
  paidToDate: number;
  itemsLabel: string;
  shipTo: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  summary: EmailOrderSummary;
  address: EmailAddress | null;
  orderUrl: string;
  adminUrl: string;
}

export function emailDate(value: Date): string {
  return formatDisplayDate(value.toISOString(), "en");
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export async function loadOrderEmailData(
  orderId: string,
): Promise<OrderEmailData | null> {
  try {
    const [order, taxConfig] = await Promise.all([
      db.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          deliveredAt: true,
          deliveryReceivedBy: true,
          subtotal: true,
          addonTotal: true,
          shippingCost: true,
          discountAmount: true,
          couponCode: true,
          loyaltyPointsUsed: true,
          loyaltyDiscountAmount: true,
          taxAmount: true,
          total: true,
          shippingAddressSnapshot: true,
          shippingMethodSnapshot: true,
          shippingQuotedAt: true,
          trackingNumber: true,
          trackingUrl: true,
          customer: { select: { name: true, email: true } },
          convertedFromQuote: { select: { quoteNumber: true } },
          settlements: { select: { amount: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              itemType: true,
              itemNameEn: true,
              quantity: true,
              lineTotal: true,
              parentOrderItemId: true,
              product: { select: { serialTracking: true } },
              serials: {
                orderBy: { unitIndex: "asc" },
                select: { value: true },
              },
            },
          },
        },
      }),
      getSetting("tax_config"),
    ]);

    if (!order) return null;

    const products = order.items.filter((item) => item.itemType === "PRODUCT");
    const addons = order.items.filter((item) => item.itemType === "ADDON");
    const productIds = new Set(products.map((product) => product.id));
    const toLine = (item: (typeof order.items)[number]) => ({
      name: item.itemNameEn,
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
    });

    const toSerials = (
      product: (typeof order.items)[number],
    ): EmailSummaryItem["serials"] => {
      const values = product.serials
        .map((entry) => entry.value)
        .filter((value): value is string => value !== null && value !== "");
      const kind: "SERIAL" | "LOT" =
        product.product?.serialTracking === "LOT" ? "LOT" : "SERIAL";
      return values.length > 0 ? { kind, values } : undefined;
    };

    const items: EmailSummaryItem[] = [
      ...products.map((product) => ({
        ...toLine(product),
        addons: addons
          .filter((addon) => addon.parentOrderItemId === product.id)
          .map(toLine),
        serials: toSerials(product),
      })),
      ...addons
        .filter(
          (addon) =>
            !addon.parentOrderItemId || !productIds.has(addon.parentOrderItemId),
        )
        .map((addon) => ({ ...toLine(addon), addons: [] })),
    ];

    const methodSnapshot =
      order.shippingMethodSnapshot as ShippingMethodSnapshot | null;
    const shippingPending =
      methodSnapshot === null &&
      order.shippingQuotedAt === null &&
      order.convertedFromQuote === null;

    const rawAddress = order.shippingAddressSnapshot as ShippingAddressSnapshot | null;
    const snapshot =
      rawAddress &&
      typeof rawAddress === "object" &&
      typeof rawAddress.fullName === "string"
        ? rawAddress
        : null;
    const countryName = snapshot?.country ? getCountryName(snapshot.country) : "";
    const address: EmailAddress | null = snapshot
      ? {
          fullName: snapshot.fullName,
          lines: [
            [snapshot.addressLine1, snapshot.addressLine2]
              .filter(Boolean)
              .join(", "),
            [
              Array.from(
                new Set([snapshot.city, snapshot.emirate].filter(Boolean)),
              ).join(", "),
              snapshot.postalCode,
            ]
              .filter(Boolean)
              .join(" "),
            countryName,
          ],
        }
      : null;
    const shipTo = snapshot
      ? [snapshot.emirate || snapshot.city, countryName].filter(Boolean).join(", ")
      : "";

    const summary: EmailOrderSummary = {
      items,
      subtotal: Number(order.subtotal),
      addonTotal: Number(order.addonTotal),
      shippingCost: Number(order.shippingCost),
      shippingMethodName: methodSnapshot?.nameEn ?? null,
      shippingPending,
      discountAmount: Number(order.discountAmount),
      couponCode: order.couponCode,
      loyaltyPointsUsed: order.loyaltyPointsUsed,
      loyaltyDiscountAmount: Number(order.loyaltyDiscountAmount),
      total: Number(order.total),
      taxAmount: Number(order.taxAmount),
      vatRate: taxConfig.vatRate,
    };

    const itemsLabel =
      addons.length > 0
        ? `${countLabel(products.length, "product")}, ${countLabel(addons.length, "add-on")}`
        : countLabel(products.length, "product");

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: emailDate(order.createdAt),
      deliveredDate: order.deliveredAt ? emailDate(order.deliveredAt) : null,
      deliveryReceivedBy: order.deliveryReceivedBy,
      customerName: order.customer.name.trim(),
      customerEmail: order.customer.email,
      quoteNumber: order.convertedFromQuote?.quoteNumber ?? null,
      shippingPending,
      total: Number(order.total),
      paidToDate: sumMoney(order.settlements.map((s) => Number(s.amount))),
      itemsLabel,
      shipTo,
      trackingNumber: order.trackingNumber,
      trackingUrl:
        order.trackingUrl && /^https?:\/\//i.test(order.trackingUrl)
          ? order.trackingUrl
          : null,
      summary,
      address,
      orderUrl: APP_BASE_URL
        ? `${APP_BASE_URL}/en/account/orders/${order.id}`
        : "",
      adminUrl: APP_BASE_URL ? `${APP_BASE_URL}/admin/orders/${order.id}` : "",
    };
  } catch (err) {
    console.error("[loadOrderEmailData]", orderId, err);
    return null;
  }
}

export function orderBaseRows(data: OrderEmailData): EmailInfoRow[] {
  return [
    { label: "Order", value: data.orderNumber },
    { label: "Order date", value: data.orderDate },
    ...(data.quoteNumber ? [{ label: "Quote", value: data.quoteNumber }] : []),
  ];
}

export function customerOrderChrome(
  data: OrderEmailData,
  opts: {
    badge: EmailChromeBadge;
    infoRows: EmailInfoRow[];
    withSummary?: boolean;
    withAddress?: boolean;
    ctaUrl?: string;
  },
): EmailChromeOptions {
  return {
    recipientName: data.customerName || undefined,
    badges: [opts.badge],
    infoRows: opts.infoRows,
    ctaUrl: opts.ctaUrl || data.orderUrl || undefined,
    orderSummary: opts.withSummary ? data.summary : undefined,
    shippingAddress: opts.withAddress && data.address ? data.address : undefined,
    showSupport: true,
    transparencyNote: CUSTOMER_ORDER_NOTE,
  };
}

export function staffOrderChrome(
  data: OrderEmailData,
  opts: { badge: EmailChromeBadge; extraRows?: EmailInfoRow[] },
): EmailChromeOptions {
  return {
    badges: [opts.badge],
    infoRows: [
      { label: "Order", value: data.orderNumber },
      {
        label: "Customer",
        value: data.customerName
          ? `${data.customerName} · ${data.customerEmail}`
          : data.customerEmail,
      },
      ...(data.quoteNumber ? [{ label: "Quote", value: data.quoteNumber }] : []),
      ...(data.shipTo ? [{ label: "Ship to", value: data.shipTo }] : []),
      { label: "Items", value: data.itemsLabel },
      {
        label: "Total",
        value: data.shippingPending
          ? "Pending shipping quote"
          : formatAED(data.total),
      },
      ...(opts.extraRows ?? []),
    ],
    ctaUrl: data.adminUrl || undefined,
    transparencyNote: STAFF_ORDERS_NOTE,
  };
}
