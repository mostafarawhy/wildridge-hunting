-- AlterTable
ALTER TABLE "VerificationDocumentRequest"
    ADD COLUMN IF NOT EXISTS "scope" "DocumentRequestScope" NOT NULL DEFAULT 'DOCUMENTS';

-- AddCheckConstraint
ALTER TABLE "VerificationDocumentRequest" DROP CONSTRAINT IF EXISTS "VerificationDocumentRequest_roles_scope_check";
ALTER TABLE "VerificationDocumentRequest" ADD CONSTRAINT "VerificationDocumentRequest_roles_scope_check"
    CHECK (("scope" = 'DOCUMENTS' AND cardinality("roles") > 0) OR ("scope" = 'DETAILS' AND cardinality("roles") = 0));
