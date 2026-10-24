import { z } from "zod";

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: optionalString,
  RESEND_FROM_EMAIL: optionalString,
  EMAIL_REDIRECT_TO: optionalString,
  PAYMENT_PROVIDER: optionalString,
  NGENIUS_API_KEY: optionalString,
  NGENIUS_OUTLET_REF: optionalString,
  NGENIUS_BASE_URL: optionalString,
  IDENTITY_PROVIDER: optionalString,
  UAE_PASS_CLIENT_ID: optionalString,
  UAE_PASS_CLIENT_SECRET: optionalString,
  UAE_PASS_BASE_URL: optionalString,
  UAE_PASS_REDIRECT_URI: optionalString,
  UAE_PASS_LIVE: optionalString,
  KLAVIYO_PRIVATE_API_KEY: optionalString,
  KLAVIYO_LIST_ID: optionalString,
  DEMO_STAFF_PASSWORD: optionalString,
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`[env] Invalid server environment variables: ${issues}`);
}

export const env = parsed.data;
