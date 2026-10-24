ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_locale_check";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_locale_check" CHECK ("locale" IN ('en', 'ar', 'ru'));
