ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "fileSha256" TEXT;
ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER;
ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "createdCount" INTEGER;
ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "updatedCount" INTEGER;
ALTER TABLE "ImportBatch" ADD COLUMN IF NOT EXISTS "unchangedCount" INTEGER;

ALTER TABLE "ImportBatchError" ALTER COLUMN "rowNumber" DROP NOT NULL;
ALTER TABLE "ImportBatchError" ADD COLUMN IF NOT EXISTS "sheet" TEXT;
ALTER TABLE "ImportBatchError" ADD COLUMN IF NOT EXISTS "columnKey" TEXT;
ALTER TABLE "ImportBatchError" ADD COLUMN IF NOT EXISTS "found" TEXT;
ALTER TABLE "ImportBatchError" ADD COLUMN IF NOT EXISTS "fix" TEXT;

UPDATE "ImportBatch" b SET
  "createdCount" = (a.metadata->>'created')::int,
  "updatedCount" = (a.metadata->>'updated')::int,
  "unchangedCount" = (a.metadata->>'unchanged')::int,
  "fileSha256" = a.metadata->>'fileHash'
FROM "AuditLog" a
WHERE a.action = 'catalog.import'
  AND a."entityType" = 'ImportBatch'
  AND a."entityId" = b.id
  AND b."createdCount" IS NULL;
