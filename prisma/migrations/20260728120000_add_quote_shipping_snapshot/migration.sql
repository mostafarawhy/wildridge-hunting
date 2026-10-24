ALTER TABLE "QuoteRequest" ADD COLUMN "sendNote" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "shippingCost" DECIMAL(10,2);
ALTER TABLE "QuoteRequest" ADD COLUMN "shippingMethodLabel" TEXT;
ALTER TABLE "QuoteRequest" ADD COLUMN "shippingAddressSnapshot" JSONB;
