DO $$ BEGIN
  CREATE TYPE "NewsletterSource" AS ENUM ('HOME', 'POPUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "source" "NewsletterSource" NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "klaviyoSyncedAt" TIMESTAMP(3),
    "klaviyoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_createdAt_idx" ON "NewsletterSubscriber"("createdAt");
CREATE INDEX IF NOT EXISTS "NewsletterSubscriber_unsubscribedAt_idx" ON "NewsletterSubscriber"("unsubscribedAt");

ALTER TABLE "NewsletterSubscriber" DROP CONSTRAINT IF EXISTS "NewsletterSubscriber_locale_check";
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_locale_check" CHECK ("locale" IN ('en', 'ar', 'ru'));

ALTER TABLE "NewsletterSubscriber" DROP CONSTRAINT IF EXISTS "NewsletterSubscriber_email_check";
ALTER TABLE "NewsletterSubscriber" ADD CONSTRAINT "NewsletterSubscriber_email_check" CHECK ("email" = lower(btrim("email")));
