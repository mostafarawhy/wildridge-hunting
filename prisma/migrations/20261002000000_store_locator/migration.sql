CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameRu" TEXT,
    "addressEn" TEXT NOT NULL,
    "addressAr" TEXT,
    "addressRu" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionRu" TEXT,
    "hoursNoteEn" TEXT,
    "hoursNoteAr" TEXT,
    "hoursNoteRu" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "openingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Store_isActive_displayOrder_idx" ON "Store"("isActive", "displayOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "Store_single_primary_key" ON "Store"("isPrimary") WHERE "isPrimary";

ALTER TABLE "Store" DROP CONSTRAINT IF EXISTS "Store_primary_active_check";
ALTER TABLE "Store" ADD CONSTRAINT "Store_primary_active_check" CHECK (NOT "isPrimary" OR "isActive");

ALTER TABLE "Store" DROP CONSTRAINT IF EXISTS "Store_coordinates_check";
ALTER TABLE "Store" ADD CONSTRAINT "Store_coordinates_check" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);
