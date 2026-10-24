ALTER TABLE "ShippingMethod" ADD COLUMN "freeShippingEligible" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ShippingMethod" SET "freeShippingEligible" = true WHERE "code" = 'STANDARD_UAE';
