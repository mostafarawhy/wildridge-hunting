-- AlterTable
ALTER TABLE "B2BDocument" ADD COLUMN     "supersededAt" TIMESTAMP(3);
ALTER TABLE "B2BDocument" ADD COLUMN     "declaredNumber" TEXT;
ALTER TABLE "B2BDocument" ADD COLUMN     "label" TEXT;

-- CreateIndex
CREATE INDEX "B2BDocument_b2bAccountId_supersededAt_idx" ON "B2BDocument"("b2bAccountId", "supersededAt");
