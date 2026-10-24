ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'LoyaltyTransactionType' AND e.enumlabel = 'RETURNED')
     AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'LoyaltyTransactionType' AND e.enumlabel = 'REVERSED') THEN
    ALTER TYPE "LoyaltyTransactionType" RENAME VALUE 'RETURNED' TO 'REVERSED';
  END IF;
END $$;
ALTER TYPE "LoyaltyTransactionType" ADD VALUE IF NOT EXISTS 'REVERSED';
DO $$ BEGIN CREATE TYPE "RefundMethod" AS ENUM ('ORIGINAL_PAYMENT','BANK_TRANSFER','CASH','CHEQUE','CARD_TERMINAL','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundDue" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_refund_due_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_refund_due_check" CHECK ("refundDue" >= 0 AND "refundDue" <= "total");
CREATE TABLE IF NOT EXISTS "OrderRefund" ("id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "method" "RefundMethod" NOT NULL, "methodOtherLabel" TEXT, "externalReference" TEXT NOT NULL, "amount" DECIMAL(10,2) NOT NULL, "refundedAt" TIMESTAMP(3) NOT NULL, "recordedById" TEXT NOT NULL, "notes" TEXT, "filename" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "OrderRefund_orderId_idx" ON "OrderRefund"("orderId");
CREATE INDEX IF NOT EXISTS "OrderRefund_recordedById_idx" ON "OrderRefund"("recordedById");
CREATE INDEX IF NOT EXISTS "OrderRefund_refundedAt_idx" ON "OrderRefund"("refundedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_refund_reference_per_order" ON "OrderRefund" ("orderId", lower("externalReference"));
ALTER TABLE "OrderRefund" DROP CONSTRAINT IF EXISTS "OrderRefund_orderId_fkey";
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderRefund" DROP CONSTRAINT IF EXISTS "OrderRefund_recordedById_fkey";
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRefund" DROP CONSTRAINT IF EXISTS "OrderRefund_amount_check";
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_amount_check" CHECK ("amount" > 0);
ALTER TABLE "OrderRefund" DROP CONSTRAINT IF EXISTS "OrderRefund_method_other_label_check";
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_method_other_label_check" CHECK (("method" = 'OTHER'::"RefundMethod" AND "methodOtherLabel" IS NOT NULL AND btrim("methodOtherLabel") <> '') OR ("method" <> 'OTHER'::"RefundMethod" AND "methodOtherLabel" IS NULL));
