CREATE TYPE "QuoteContactReason" AS ENUM ('PRICING', 'SHIPPING', 'QUANTITIES', 'PAYMENT_TERMS', 'OTHER');
ALTER TABLE "Ticket" ALTER COLUMN "createdByStaffId" DROP NOT NULL;
ALTER TABLE "Ticket" ADD COLUMN "createdByCustomerId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "quoteContactReason" "QuoteContactReason";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdByCustomerId_fkey" FOREIGN KEY ("createdByCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Ticket_createdByCustomerId_idx" ON "Ticket"("createdByCustomerId");
