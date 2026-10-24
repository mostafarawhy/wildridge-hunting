-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationDocumentRequest" (
    "id" TEXT NOT NULL,
    "verificationEventId" TEXT NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'OPEN',
    "roles" "VerificationDocumentRole"[] NOT NULL DEFAULT ARRAY[]::"VerificationDocumentRole"[],
    "message" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VerificationDocument"
    ADD COLUMN IF NOT EXISTS "supersededAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_open_verification_document_request"
  ON "VerificationDocumentRequest"("verificationEventId")
  WHERE ("status" = 'OPEN');

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocumentRequest_verificationEventId_idx" ON "VerificationDocumentRequest"("verificationEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocumentRequest_status_idx" ON "VerificationDocumentRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocumentRequest_requestedById_idx" ON "VerificationDocumentRequest"("requestedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocument_verificationEventId_supersededAt_idx" ON "VerificationDocument"("verificationEventId", "supersededAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationDocument_requestId_idx" ON "VerificationDocument"("requestId");

-- AddForeignKey
ALTER TABLE "VerificationDocumentRequest" DROP CONSTRAINT IF EXISTS "VerificationDocumentRequest_verificationEventId_fkey";
ALTER TABLE "VerificationDocumentRequest" ADD CONSTRAINT "VerificationDocumentRequest_verificationEventId_fkey" FOREIGN KEY ("verificationEventId") REFERENCES "VerificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocumentRequest" DROP CONSTRAINT IF EXISTS "VerificationDocumentRequest_requestedById_fkey";
ALTER TABLE "VerificationDocumentRequest" ADD CONSTRAINT "VerificationDocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" DROP CONSTRAINT IF EXISTS "VerificationDocument_requestId_fkey";
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationDocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
