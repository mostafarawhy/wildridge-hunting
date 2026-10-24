/*
  Warnings:

  - A unique constraint covering the columns `[productSku,customerId]` on the table `ProductReview` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "FeaturedCollection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameRu" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "placeholderImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedCollection_key_key" ON "FeaturedCollection"("key");

-- CreateIndex
CREATE INDEX "FeaturedCollection_key_idx" ON "FeaturedCollection"("key");

-- CreateIndex
CREATE INDEX "FeaturedCollection_isActive_idx" ON "FeaturedCollection"("isActive");

-- CreateIndex
CREATE INDEX "FeaturedCollection_displayOrder_idx" ON "FeaturedCollection"("displayOrder");

-- CreateIndex
CREATE INDEX "FeaturedCollectionItem_collectionId_idx" ON "FeaturedCollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "FeaturedCollectionItem_productSku_idx" ON "FeaturedCollectionItem"("productSku");

-- CreateIndex
CREATE INDEX "FeaturedCollectionItem_displayOrder_idx" ON "FeaturedCollectionItem"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedCollectionItem_collectionId_productSku_key" ON "FeaturedCollectionItem"("collectionId", "productSku");

-- CreateIndex
CREATE INDEX "idx_product_tags" ON "Product" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "unique_review_per_customer_per_product" ON "ProductReview"("productSku", "customerId") WHERE ("customerId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "FeaturedCollectionItem" ADD CONSTRAINT "FeaturedCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FeaturedCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedCollectionItem" ADD CONSTRAINT "FeaturedCollectionItem_productSku_fkey" FOREIGN KEY ("productSku") REFERENCES "Product"("sku") ON DELETE CASCADE ON UPDATE CASCADE;
