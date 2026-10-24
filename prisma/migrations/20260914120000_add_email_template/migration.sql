CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_templateKey_locale_key" ON "EmailTemplate"("templateKey", "locale");

CREATE INDEX IF NOT EXISTS "EmailTemplate_templateKey_idx" ON "EmailTemplate"("templateKey");

ALTER TABLE "EmailTemplate" DROP CONSTRAINT IF EXISTS "EmailTemplate_locale_check";
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_locale_check" CHECK ("locale" IN ('en', 'ar', 'ru'));
