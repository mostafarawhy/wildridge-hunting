ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_stockQuantity_non_negative";
ALTER TABLE "Product" ADD CONSTRAINT "Product_stockQuantity_non_negative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_reservedQuantity_non_negative";
ALTER TABLE "Product" ADD CONSTRAINT "Product_reservedQuantity_non_negative" CHECK ("reservedQuantity" >= 0);

ALTER TABLE "Addon" DROP CONSTRAINT IF EXISTS "Addon_stockQuantity_non_negative";
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_stockQuantity_non_negative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "Addon" DROP CONSTRAINT IF EXISTS "Addon_reservedQuantity_non_negative";
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_reservedQuantity_non_negative" CHECK ("reservedQuantity" >= 0);
