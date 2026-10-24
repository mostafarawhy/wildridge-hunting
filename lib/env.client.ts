import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_USE_PLACEHOLDER_IMAGES: z.string().optional(),
  NEXT_PUBLIC_UAE_PASS_ENABLED: z.string().optional(),
});

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_USE_PLACEHOLDER_IMAGES: process.env.NEXT_PUBLIC_USE_PLACEHOLDER_IMAGES,
  NEXT_PUBLIC_UAE_PASS_ENABLED: process.env.NEXT_PUBLIC_UAE_PASS_ENABLED,
});

export const clientEnv = parsed.success ? parsed.data : {};

export function isUaePassEnabled(): boolean {
  return clientEnv.NEXT_PUBLIC_UAE_PASS_ENABLED === "true";
}
