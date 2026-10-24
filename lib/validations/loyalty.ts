import { z } from "zod";

export const LoyaltyActivityFiltersSchema = z.object({
  search: z.string().trim().max(254).optional().catch(undefined),
  type: z
    .enum(["EARNED", "REDEEMED", "ADJUSTED", "EXPIRED", "REFUNDED", "REVERSED"])
    .optional()
    .catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export type LoyaltyActivityFilters = z.infer<typeof LoyaltyActivityFiltersSchema>;

export const adjustLoyaltySchema = z.object({
  customerId: z.string().min(1),
  direction: z.enum(["ADD", "REMOVE"]),
  points: z
    .number()
    .int("Enter whole points.")
    .min(1, "Enter at least 1 point.")
    .max(1000000, "Enter at most 1,000,000 points."),
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters.")
    .max(500, "Keep the reason under 500 characters."),
  expectedBalance: z.number().int().min(0),
});

export type AdjustLoyaltyInput = z.infer<typeof adjustLoyaltySchema>;
