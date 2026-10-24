-- AlterTable
ALTER TABLE "DocumentRequest"
    ADD COLUMN IF NOT EXISTS "types" "DocumentType"[] NOT NULL DEFAULT ARRAY[]::"DocumentType"[];

-- AddCheckConstraint
ALTER TABLE "DocumentRequest" DROP CONSTRAINT IF EXISTS "DocumentRequest_types_scope_check";
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_types_scope_check"
    CHECK ("scope" = 'DOCUMENTS' OR cardinality("types") = 0);
