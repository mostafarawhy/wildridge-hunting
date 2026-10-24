-- CreateEnum
CREATE TYPE "DocumentRequestScope" AS ENUM ('DOCUMENTS', 'DETAILS');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "b2bAccountId" TEXT NOT NULL,
    "scope" "DocumentRequestScope" NOT NULL DEFAULT 'DOCUMENTS',
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "B2BDocument" ADD COLUMN     "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "unique_open_document_request_per_account"
  ON "DocumentRequest"("b2bAccountId")
  WHERE ("status" = 'OPEN');

-- CreateIndex
CREATE INDEX "DocumentRequest_b2bAccountId_idx" ON "DocumentRequest"("b2bAccountId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_requestedById_idx" ON "DocumentRequest"("requestedById");

-- CreateIndex
CREATE INDEX "B2BDocument_requestId_idx" ON "B2BDocument"("requestId");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_b2bAccountId_fkey" FOREIGN KEY ("b2bAccountId") REFERENCES "B2BAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2BDocument" ADD CONSTRAINT "B2BDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
