import { z } from "zod";

export const submitQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        productSku: z.string().min(1),
        quantity: z.int().min(1).max(9999),
        addonIds: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  customerNote: z.string().max(1000).optional(),
  addressId: z.string().min(1),
});

export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>;

export const setQuotePricingSchema = z.object({
  quoteId: z.string().min(1),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quotedUnitPrice: z.number().positive().max(9_999_999),
        quantity: z.int().min(1).max(9999),
        addons: z
          .array(
            z.object({
              selectedAddonId: z.string().min(1),
              quantity: z.int().min(1).max(9999),
              quotedUnitPrice: z.number().positive().max(9_999_999),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
  internalNote: z.string().max(2000).optional(),
  shippingCost: z.number().min(0).max(9_999_999),
  shippingMethodLabel: z.string().min(1).max(200),
  sendNote: z.string().min(1).max(2000),
  stockAttestation: z.object({
    stockVerified: z.literal(true, {
      message: "Stock availability must be attested before sending a quote.",
    }),
  }),
});

export type SetQuotePricingInput = z.infer<typeof setQuotePricingSchema>;

export const transitionQuoteSchema = z.object({
  quoteId: z.string().min(1),
  toStatus: z.enum(["CONTACTED", "CLOSED", "CANCELLED"]),
  note: z.string().max(2000).optional(),
});

export type TransitionQuoteInput = z.infer<typeof transitionQuoteSchema>;

export const acceptQuoteSchema = z.object({
  quoteId: z.string().min(1),
  consent: z.literal(true),
  expectedTotal: z.number().min(0).max(99_999_999),
});

export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

export const cancelQuoteSchema = z.object({
  quoteId: z.string().min(1),
});

export type CancelQuoteInput = z.infer<typeof cancelQuoteSchema>;

export const requestQuoteContactSchema = z.object({
  quoteId: z.string().min(1),
  reason: z.enum(["PRICING", "SHIPPING", "QUANTITIES", "PAYMENT_TERMS", "OTHER"]),
  message: z.string().min(1).max(2000),
});

export type RequestQuoteContactInput = z.infer<
  typeof requestQuoteContactSchema
>;

export const finalizeQuoteSchema = z.object({
  quoteId: z.string().min(1),
});

export type FinalizeQuoteInput = z.infer<typeof finalizeQuoteSchema>;
