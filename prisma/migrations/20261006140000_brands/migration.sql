CREATE TABLE IF NOT EXISTS "Brand" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameRu" TEXT,
    "slug" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Brand_slug_key" ON "Brand"("slug");
CREATE INDEX IF NOT EXISTS "Brand_isVisible_idx" ON "Brand"("isVisible");
CREATE INDEX IF NOT EXISTS "Brand_deletedAt_idx" ON "Brand"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_nameEn_live_key" ON "Brand"(lower(btrim("nameEn"))) WHERE "deletedAt" IS NULL;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brandId" TEXT;
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_brandId_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ALTER COLUMN "brand" DROP NOT NULL;

INSERT INTO "Brand" ("id", "nameEn", "slug", "updatedAt")
SELECT gen_random_uuid()::text, d.n, d.s, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (lower(btrim("brand")))
        btrim("brand") AS n,
        btrim(regexp_replace(lower(replace(btrim("brand"), '&', ' and ')), '[^a-z0-9]+', '-', 'g'), '-') AS s
    FROM "Product"
    WHERE "brand" IS NOT NULL AND btrim("brand") <> ''
    ORDER BY lower(btrim("brand")), btrim("brand")
) d
WHERE d.s <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Brand" b
    WHERE b."deletedAt" IS NULL AND lower(btrim(b."nameEn")) = lower(d.n)
  );

UPDATE "Product" p
SET "brandId" = b."id"
FROM "Brand" b
WHERE p."brandId" IS NULL
  AND p."brand" IS NOT NULL
  AND b."deletedAt" IS NULL
  AND lower(btrim(b."nameEn")) = lower(btrim(p."brand"));
