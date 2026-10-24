-- CreateEnum
CREATE TYPE "NavGroup" AS ENUM ('RIFLES', 'OPTICS', 'ACCESSORIES');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "navGroup" "NavGroup";

-- CreateIndex
CREATE INDEX "Category_navGroup_idx" ON "Category"("navGroup");

-- Backfill nav group assignments from hardcoded NAV_GROUP_SLUGS
UPDATE "Category" SET "navGroup" = 'RIFLES'      WHERE "slug" IN ('air-rifles','pcp-rifles','co2-pistols');
UPDATE "Category" SET "navGroup" = 'OPTICS'      WHERE "slug" = 'optics';
UPDATE "Category" SET "navGroup" = 'ACCESSORIES' WHERE "slug" = 'accessories';
