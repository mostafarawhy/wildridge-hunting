/*
  Warnings:

  - Added the required column `updatedAt` to the `VerificationEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VerificationEvent" ADD COLUMN     "documentStorageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "provider" SET DEFAULT 'MANUAL_REVIEW';

-- CreateIndex
CREATE INDEX "VerificationEvent_reviewedById_idx" ON "VerificationEvent"("reviewedById");

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
