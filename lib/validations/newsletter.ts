import { z } from "zod";

export const NewsletterSubscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  source: z.enum(["HOME", "POPUP"]),
  website: z.string().max(200).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof NewsletterSubscribeSchema>;

export const SubscriberFiltersSchema = z.object({
  search: z.string().trim().max(254).optional().catch(undefined),
  status: z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]).optional().catch(undefined),
  klaviyo: z.enum(["SENT", "WAITING", "FAILED"]).optional().catch(undefined),
  source: z.enum(["HOME", "POPUP"]).optional().catch(undefined),
  locale: z.enum(["en", "ar", "ru"]).optional().catch(undefined),
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
  sort: z.enum(["newest", "oldest", "email"]).optional().catch(undefined),
});

export type SubscriberFilters = z.infer<typeof SubscriberFiltersSchema>;
