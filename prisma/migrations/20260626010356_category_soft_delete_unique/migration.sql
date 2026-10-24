-- DropIndex
DROP INDEX "Category_nameEn_key";

-- DropIndex
DROP INDEX "Category_slug_key";

-- CreateIndex
CREATE INDEX "Category_nameEn_idx" ON "Category"("nameEn");

-- Partial unique indexes: uniqueness only among non-deleted rows
CREATE UNIQUE INDEX "Category_slug_active_key" ON "Category"("slug") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Category_nameEn_active_key" ON "Category"("nameEn") WHERE "deletedAt" IS NULL;
