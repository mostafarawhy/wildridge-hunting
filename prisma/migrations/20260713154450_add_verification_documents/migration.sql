CREATE TYPE "VerificationDocumentRole" AS ENUM ('IDENTITY', 'PROOF_OF_ADDRESS', 'PHOTO');

CREATE TYPE "VerificationDocumentType" AS ENUM ('EMIRATES_ID', 'PASSPORT', 'DRIVING_LICENSE', 'UTILITY_BILL', 'TENANCY_CONTRACT', 'RESIDENCE_VISA', 'BANK_STATEMENT', 'SELFIE');

CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationEventId" TEXT NOT NULL,
    "role" "VerificationDocumentRole" NOT NULL,
    "type" "VerificationDocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationDocument_verificationEventId_idx" ON "VerificationDocument"("verificationEventId");
CREATE INDEX "VerificationDocument_role_idx" ON "VerificationDocument"("role");

ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationEventId_fkey" FOREIGN KEY ("verificationEventId") REFERENCES "VerificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationEvent" DROP CONSTRAINT "VerificationEvent_customerId_fkey";
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer" DROP COLUMN "sumsubApplicantId";

ALTER TABLE "Order" ADD COLUMN "complianceSnapshot" JSONB;
