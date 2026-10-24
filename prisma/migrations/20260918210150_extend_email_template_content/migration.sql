ALTER TABLE "EmailTemplate" DROP COLUMN "bodyHtml";
ALTER TABLE "EmailTemplate" ADD COLUMN "preheaderText" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "bodyParagraphs" JSONB;
ALTER TABLE "EmailTemplate" ADD COLUMN "ctaLabel" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
