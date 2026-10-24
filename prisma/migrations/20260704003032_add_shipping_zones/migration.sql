


-- AlterTable
ALTER TABLE "ShippingRate" ADD COLUMN     "shippingZoneId" TEXT;

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameRu" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeShippingThreshold" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingZoneCountry" (
    "id" TEXT NOT NULL,
    "shippingZoneId" TEXT NOT NULL,
    "country" TEXT NOT NULL,

    CONSTRAINT "ShippingZoneCountry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_code_key" ON "ShippingZone"("code");

-- CreateIndex
CREATE INDEX "ShippingZone_isActive_idx" ON "ShippingZone"("isActive");

-- CreateIndex
CREATE INDEX "ShippingZone_displayOrder_idx" ON "ShippingZone"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZoneCountry_country_key" ON "ShippingZoneCountry"("country");

-- CreateIndex
CREATE INDEX "ShippingZoneCountry_shippingZoneId_idx" ON "ShippingZoneCountry"("shippingZoneId");

-- CreateIndex
CREATE INDEX "ShippingRate_shippingZoneId_idx" ON "ShippingRate"("shippingZoneId");

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZoneCountry" ADD CONSTRAINT "ShippingZoneCountry_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: seed the UAE zone, adopt AE, link existing rates
INSERT INTO "ShippingZone"
  ("id", "code", "nameEn", "nameAr", "nameRu", "isActive", "displayOrder", "freeShippingEnabled", "freeShippingThreshold", "createdAt", "updatedAt")
VALUES
  ('zone_uae_default', 'UAE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'ОАЭ', true, 0, true, 500.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "ShippingZoneCountry" ("id", "shippingZoneId", "country")
VALUES ('zonecountry_uae_ae', 'zone_uae_default', 'AE');

UPDATE "ShippingRate" SET "shippingZoneId" = 'zone_uae_default' WHERE "country" = 'AE';