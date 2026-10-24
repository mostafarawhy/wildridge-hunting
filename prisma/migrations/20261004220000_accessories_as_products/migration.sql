CREATE TABLE IF NOT EXISTS "ProductAccessory" (
    "id" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "accessorySku" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductAccessory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAccessory_productSku_accessorySku_key" ON "ProductAccessory"("productSku", "accessorySku");
CREATE INDEX IF NOT EXISTS "ProductAccessory_accessorySku_idx" ON "ProductAccessory"("accessorySku");

ALTER TABLE "ProductAccessory" DROP CONSTRAINT IF EXISTS "ProductAccessory_productSku_fkey";
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_productSku_fkey" FOREIGN KEY ("productSku") REFERENCES "Product"("sku") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAccessory" DROP CONSTRAINT IF EXISTS "ProductAccessory_accessorySku_fkey";
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_accessorySku_fkey" FOREIGN KEY ("accessorySku") REFERENCES "Product"("sku") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAccessory" DROP CONSTRAINT IF EXISTS "ProductAccessory_not_self_check";
ALTER TABLE "ProductAccessory" ADD CONSTRAINT "ProductAccessory_not_self_check" CHECK ("productSku" <> "accessorySku");

WITH src AS (
    SELECT
        a.*,
        trim(both '-' from regexp_replace(lower(a."nameEn"), '[^a-z0-9]+', '-', 'g')) AS base_slug,
        CASE
            WHEN a."addonId" IN ('ADN-001', 'ADN-002', 'ADN-006', 'ADN-007') THEN 'scopes-optics'
            WHEN a."addonId" IN ('ADN-008', 'ADN-009', 'ADN-013', 'ADN-015', 'ADN-018', 'ADN-019', 'ADN-020') THEN 'spare-parts'
            ELSE 'accessories'
        END AS category_slug
    FROM "Addon" a
    WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."sku" = a."addonId")
)
INSERT INTO "Product" (
    "id", "sku", "nameAr", "nameEn", "nameRu", "slugEn", "brand", "actionType",
    "descriptionAr", "descriptionEn", "descriptionRu", "categoryId", "tags",
    "price", "compareAtPrice", "stockQuantity", "reservedQuantity", "lowStockThreshold",
    "requiresIdVerification", "supportsAddons", "b2bAvailable", "minOrderQty",
    "isNewArrival", "isFeatured", "loyaltyPointsEarn", "publishStatus",
    "deletedAt", "createdAt", "updatedAt"
)
SELECT
    'acc_' || lower(s."addonId"),
    s."addonId",
    s."nameAr",
    s."nameEn",
    s."nameRu",
    CASE
        WHEN EXISTS (SELECT 1 FROM "Product" p WHERE p."slugEn" = s.base_slug)
            THEN s.base_slug || '-' || lower(s."addonId")
        ELSE s.base_slug
    END,
    'Generic',
    'N/A'::"ActionType",
    s."descriptionAr",
    s."descriptionEn",
    s."descriptionRu",
    (SELECT c."id" FROM "Category" c WHERE c."slug" = s.category_slug AND c."deletedAt" IS NULL ORDER BY c."createdAt" LIMIT 1),
    ARRAY[]::TEXT[],
    s."price",
    s."compareAtPrice",
    s."stockQuantity",
    s."reservedQuantity",
    s."lowStockThreshold",
    false,
    false,
    false,
    1,
    false,
    false,
    0,
    (CASE
        WHEN s."isActive" AND s."deletedAt" IS NULL AND s."addonId" <> 'WALK-B42-ADN-01' THEN 'PUBLISHED'
        ELSE 'ARCHIVED'
    END)::"PublishStatus",
    s."deletedAt",
    NOW(),
    NOW()
FROM src s;

INSERT INTO "StockMovement" ("id", "productSku", "delta", "quantityBefore", "quantityAfter", "type", "reason", "reference", "staffId", "createdAt")
SELECT
    'acc_mv_' || lower(a."addonId"),
    a."addonId",
    a."stockQuantity",
    0,
    a."stockQuantity",
    'MANUAL_ADJUSTMENT'::"StockMovementType",
    'Converted from add-on ' || a."addonId",
    a."addonId",
    NULL,
    NOW()
FROM "Addon" a
WHERE a."stockQuantity" > 0
  AND EXISTS (SELECT 1 FROM "Product" p WHERE p."sku" = a."addonId")
  AND NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."id" = 'acc_mv_' || lower(a."addonId"));

INSERT INTO "AuditLog" ("id", "actorType", "actorId", "action", "entityType", "entityId", "before", "after", "metadata", "createdAt")
SELECT
    'acc_audit_' || lower(a."addonId"),
    'SYSTEM'::"AuditActorType",
    NULL,
    'product.create',
    'Product',
    p."id",
    NULL,
    jsonb_build_object(
        'sku', p."sku",
        'nameEn', p."nameEn",
        'publishStatus', p."publishStatus"::TEXT,
        'price', p."price",
        'stockQuantity', p."stockQuantity",
        'reservedQuantity', p."reservedQuantity",
        'categoryId', p."categoryId"
    ),
    jsonb_build_object('convertedFromAddon', a."addonId", 'migration', '20261004220000_accessories_as_products'),
    NOW()
FROM "Addon" a
JOIN "Product" p ON p."sku" = a."addonId"
WHERE NOT EXISTS (SELECT 1 FROM "AuditLog" l WHERE l."id" = 'acc_audit_' || lower(a."addonId"));

INSERT INTO "ProductAccessory" ("id", "productSku", "accessorySku", "displayOrder", "createdAt", "updatedAt")
SELECT
    'acc_ln_' || l."id",
    l."productSku",
    l."addonId",
    l."displayOrder",
    l."createdAt",
    NOW()
FROM "AddonProductLink" l
JOIN "Product" parent ON parent."sku" = l."productSku"
JOIN "Product" acc ON acc."sku" = l."addonId"
WHERE parent."supportsAddons" = true
  AND l."productSku" <> l."addonId"
ON CONFLICT ("productSku", "accessorySku") DO NOTHING;

DELETE FROM "CartSelectedAddon";

WITH ranked AS (
    SELECT
        "id",
        row_number() OVER (PARTITION BY "cartId", "productSku" ORDER BY "createdAt", "id") AS rn,
        sum("quantity") OVER (PARTITION BY "cartId", "productSku") AS total
    FROM "CartItem"
)
UPDATE "CartItem" c
SET "quantity" = r.total, "updatedAt" = NOW()
FROM ranked r
WHERE c."id" = r."id" AND r.rn = 1 AND r.total <> c."quantity";

WITH ranked AS (
    SELECT
        "id",
        row_number() OVER (PARTITION BY "cartId", "productSku" ORDER BY "createdAt", "id") AS rn
    FROM "CartItem"
)
DELETE FROM "CartItem" c
USING ranked r
WHERE c."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productSku_key" ON "CartItem"("cartId", "productSku");
