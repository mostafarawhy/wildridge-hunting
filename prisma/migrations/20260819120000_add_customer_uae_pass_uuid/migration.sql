ALTER TABLE "Customer" ADD COLUMN "uaePassUuid" TEXT;
CREATE UNIQUE INDEX "Customer_uaePassUuid_key" ON "Customer"("uaePassUuid");
