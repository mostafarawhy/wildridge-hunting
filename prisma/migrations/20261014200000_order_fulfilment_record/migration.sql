DO $$ BEGIN CREATE TYPE "SerialTracking" AS ENUM ('NONE','SERIAL','LOT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ComplianceDocumentSource" AS ENUM ('VERIFICATION','B2B'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "serialTracking" "SerialTracking" NOT NULL DEFAULT 'NONE';
UPDATE "Product" p SET "serialTracking" = CASE WHEN coalesce(c."navGroup", pc."navGroup") = 'AMMO' THEN 'LOT'::"SerialTracking" ELSE 'SERIAL'::"SerialTracking" END
FROM "Category" c LEFT JOIN "Category" pc ON pc."id" = c."parentId"
WHERE c."id" = p."categoryId" AND p."requiresIdVerification" = true AND p."serialTracking" = 'NONE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "carrier" TEXT, ADD COLUMN IF NOT EXISTS "parcelCount" INTEGER, ADD COLUMN IF NOT EXISTS "shipmentNote" TEXT, ADD COLUMN IF NOT EXISTS "deliveryReceivedBy" TEXT, ADD COLUMN IF NOT EXISTS "deliveryIdChecked" BOOLEAN, ADD COLUMN IF NOT EXISTS "deliveryNote" TEXT, ADD COLUMN IF NOT EXISTS "deliveryProofKey" TEXT, ADD COLUMN IF NOT EXISTS "deliveryProofFilename" TEXT, ADD COLUMN IF NOT EXISTS "deliveryProofMimeType" TEXT;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_parcel_count_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_parcel_count_check" CHECK ("parcelCount" IS NULL OR ("parcelCount" >= 1 AND "parcelCount" <= 50));
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_delivery_proof_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_delivery_proof_check" CHECK (("deliveryProofKey" IS NULL) = ("deliveryProofFilename" IS NULL));
CREATE TABLE IF NOT EXISTS "OrderItemSerial" ("id" TEXT NOT NULL, "orderItemId" TEXT NOT NULL, "unitIndex" INTEGER NOT NULL, "value" TEXT, "overrideReason" TEXT, "recordedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrderItemSerial_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "OrderItemSerial_orderItemId_unitIndex_key" ON "OrderItemSerial"("orderItemId", "unitIndex");
CREATE INDEX IF NOT EXISTS "OrderItemSerial_value_idx" ON "OrderItemSerial"("value");
CREATE INDEX IF NOT EXISTS "OrderItemSerial_recordedById_idx" ON "OrderItemSerial"("recordedById");
ALTER TABLE "OrderItemSerial" DROP CONSTRAINT IF EXISTS "OrderItemSerial_orderItemId_fkey";
ALTER TABLE "OrderItemSerial" ADD CONSTRAINT "OrderItemSerial_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemSerial" DROP CONSTRAINT IF EXISTS "OrderItemSerial_recordedById_fkey";
ALTER TABLE "OrderItemSerial" ADD CONSTRAINT "OrderItemSerial_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItemSerial" DROP CONSTRAINT IF EXISTS "OrderItemSerial_unit_index_check";
ALTER TABLE "OrderItemSerial" ADD CONSTRAINT "OrderItemSerial_unit_index_check" CHECK ("unitIndex" >= 1);
ALTER TABLE "OrderItemSerial" DROP CONSTRAINT IF EXISTS "OrderItemSerial_value_or_override_check";
ALTER TABLE "OrderItemSerial" ADD CONSTRAINT "OrderItemSerial_value_or_override_check" CHECK (("value" IS NOT NULL AND btrim("value") <> '' AND "overrideReason" IS NULL) OR ("value" IS NULL AND "overrideReason" IS NOT NULL AND btrim("overrideReason") <> ''));
CREATE TABLE IF NOT EXISTS "OrderComplianceDocument" ("id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "source" "ComplianceDocumentSource" NOT NULL, "documentKind" TEXT NOT NULL, "documentType" TEXT, "filename" TEXT NOT NULL, "mimeType" TEXT, "declaredNumber" TEXT, "sourceKey" TEXT NOT NULL, "archiveKey" TEXT, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OrderComplianceDocument_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "OrderComplianceDocument_orderId_idx" ON "OrderComplianceDocument"("orderId");
ALTER TABLE "OrderComplianceDocument" DROP CONSTRAINT IF EXISTS "OrderComplianceDocument_orderId_fkey";
ALTER TABLE "OrderComplianceDocument" ADD CONSTRAINT "OrderComplianceDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderComplianceDocument" DROP CONSTRAINT IF EXISTS "OrderComplianceDocument_archive_check";
ALTER TABLE "OrderComplianceDocument" ADD CONSTRAINT "OrderComplianceDocument_archive_check" CHECK (("archiveKey" IS NULL) = ("archivedAt" IS NULL));
