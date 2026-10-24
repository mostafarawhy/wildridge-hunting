import { z } from "zod";

export const SUPPORT_TOPICS = [
  "ORDER",
  "QUOTE",
  "ACCOUNT",
  "BUSINESS",
  "PRODUCT",
  "OTHER",
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const createSupportRequestSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS),
  orderId: z.string().min(1).optional(),
  quoteId: z.string().min(1).optional(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});

export type CreateSupportRequestInput = z.infer<
  typeof createSupportRequestSchema
>;
