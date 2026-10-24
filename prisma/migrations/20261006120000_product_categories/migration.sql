CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_productSku_categoryId_key" ON "ProductCategory"("productSku", "categoryId");
CREATE INDEX IF NOT EXISTS "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

ALTER TABLE "ProductCategory" DROP CONSTRAINT IF EXISTS "ProductCategory_productSku_fkey";
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productSku_fkey" FOREIGN KEY ("productSku") REFERENCES "Product"("sku") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" DROP CONSTRAINT IF EXISTS "ProductCategory_categoryId_fkey";
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
