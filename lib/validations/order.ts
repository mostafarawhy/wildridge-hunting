import { z } from "zod";
import { dubaiDay } from "@/lib/utils/date";
import { isHttpUrl } from "@/lib/utils/tracking-url";
import { OrderStatus } from "@/app/generated/prisma/enums";

export const transitionOrderSchema = z.object({
  orderId: z.string().min(1),
  expectedStatus: z.enum(OrderStatus),
  toStatus: z.enum([
    "CONFIRMED",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
  ]),
  note: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || isHttpUrl(v), {
      message: "Tracking URL must be a full link starting with https:// or http://.",
    })
    .optional(),
  carrier: z.string().trim().min(2).max(80).optional(),
  parcelCount: z.number().int().min(1).max(50).optional(),
  shippedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the shipped date.")
    .optional(),
  estimatedDelivery: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid estimated delivery date.")
    .optional(),
  shipmentNote: z.string().trim().max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.toStatus !== "SHIPPED") return;
  if (val.carrier === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["carrier"],
      message: "A carrier of 2 to 80 characters is required to mark this order as shipped.",
    });
  }
  if (val.parcelCount === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["parcelCount"],
      message: "The number of parcels (1 to 50) is required to mark this order as shipped.",
    });
  }
  if (val.shippedOn === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["shippedOn"],
      message: "The shipped date is required to mark this order as shipped.",
    });
  }
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  expectedStatus: z.enum(OrderStatus),
  reason: z.string().trim().min(5).max(1000),
  customerMessage: z.string().trim().max(1000).optional(),
  confirmOrderNumber: z.string().trim().max(40).optional(),
});

export const checkOrderPaymentSchema = z.object({ orderId: z.string().min(1) });

export const returnOrderSchema = z.object({
  orderId: z.string().min(1),
  expectedStatus: z.enum(OrderStatus),
  restock: z.boolean(),
  refundDue: z.coerce.number().min(0).max(9_999_999),
  refundShortReason: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(5).max(1000),
  customerMessage: z.string().trim().max(1000).optional(),
  confirmOrderNumber: z.string().trim().min(1).max(40),
});

export const quoteOrderShippingSchema = z.object({
  orderId: z.string().min(1),
  shippingQuoteAed: z.coerce.number().min(0).max(100000),
});

export const approveShippingQuoteSchema = z.object({
  orderId: z.string().min(1),
  expectedTotal: z.coerce.number().min(0),
});

export const declineShippingQuoteSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
});

export const retryOrderPaymentSchema = z.object({
  orderId: z.string().min(1),
  expectedTotal: z.coerce.number().min(0),
});

export const recordOrderContactSchema = z.object({
  orderId: z.string().min(1),
  note: z.string().trim().max(2000).optional(),
});

export const markOrderPaidSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum([
    "BANK_TRANSFER",
    "CASH",
    "CHEQUE",
    "CARD_TERMINAL",
    "OTHER",
  ]),
  externalReference: z.string().trim().min(1).max(200),
  amount: z.coerce.number().positive().max(9_999_999),
  paidAt: z.coerce.date(),
  expectedOutstanding: z.coerce.number().positive().max(9_999_999),
  notes: z.string().trim().max(2000).optional(),
  acknowledged: z.literal(true),
  methodOtherLabel: z.string().trim().min(1).max(200).optional(),
}).superRefine((val, ctx) => {
  if (val.method === "OTHER" && !val.methodOtherLabel) {
    ctx.addIssue({
      code: "custom",
      path: ["methodOtherLabel"],
      message: "MISSING_METHOD_LABEL",
    });
  }
  if (val.method !== "OTHER" && val.methodOtherLabel) {
    ctx.addIssue({
      code: "custom",
      path: ["methodOtherLabel"],
      message: "MISSING_METHOD_LABEL",
    });
  }
  if (dubaiDay(val.paidAt) > dubaiDay(new Date())) {
    ctx.addIssue({
      code: "custom",
      path: ["paidAt"],
      message: "FUTURE_PAID_DATE",
    });
  }
});

export const addRefundDueSchema = z.object({
  orderId: z.string().min(1),
  expectedRefundDue: z.coerce.number().min(0).max(9_999_999),
  amount: z.coerce
    .number()
    .positive()
    .max(9_999_999)
    .refine((v) => Math.round(v * 100) / 100 === v, {
      message: "Enter an amount with at most 2 decimal places.",
    }),
  reason: z.string().trim().min(5).max(1000),
});

export const recordRefundSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum([
    "ORIGINAL_PAYMENT",
    "BANK_TRANSFER",
    "CASH",
    "CHEQUE",
    "CARD_TERMINAL",
    "OTHER",
  ]),
  externalReference: z.string().trim().min(1).max(200),
  amount: z.coerce.number().positive().max(9_999_999),
  refundedAt: z.coerce.date(),
  expectedOwed: z.coerce.number().positive().max(9_999_999),
  notes: z.string().trim().max(2000).optional(),
  acknowledged: z.literal(true),
  methodOtherLabel: z.string().trim().min(1).max(200).optional(),
}).superRefine((val, ctx) => {
  if (val.method === "OTHER" && !val.methodOtherLabel) {
    ctx.addIssue({
      code: "custom",
      path: ["methodOtherLabel"],
      message: "MISSING_METHOD_LABEL",
    });
  }
  if (val.method !== "OTHER" && val.methodOtherLabel) {
    ctx.addIssue({
      code: "custom",
      path: ["methodOtherLabel"],
      message: "MISSING_METHOD_LABEL",
    });
  }
});

export const requestOrderContactSchema = z.object({
  orderId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export type RequestOrderContactInput = z.infer<
  typeof requestOrderContactSchema
>;

export const confirmOrderDeliverySchema = z.object({
  orderId: z.string().min(1),
});