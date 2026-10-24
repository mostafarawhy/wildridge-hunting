DROP INDEX "ShippingRate_country_emirate_idx";

ALTER TABLE "ShippingRate" ALTER COLUMN "shippingZoneId" SET NOT NULL;

ALTER TABLE "ShippingRate" DROP COLUMN "country";
ALTER TABLE "ShippingRate" DROP COLUMN "emirate";
ALTER TABLE "ShippingRate" DROP COLUMN "freeShippingThreshold";
