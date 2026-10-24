ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_MANUAL_PAYMENT';
ALTER TABLE "QuoteRequest" ADD COLUMN "convertedOrderId" TEXT;
CREATE UNIQUE INDEX "QuoteRequest_convertedOrderId_key" ON "QuoteRequest"("convertedOrderId");
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
