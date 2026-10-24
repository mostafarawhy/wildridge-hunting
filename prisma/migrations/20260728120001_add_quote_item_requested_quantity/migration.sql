ALTER TABLE "QuoteItem" ADD COLUMN "requestedQuantity" INTEGER;
UPDATE "QuoteItem" SET "requestedQuantity" = "quantity" WHERE "requestedQuantity" IS NULL;
