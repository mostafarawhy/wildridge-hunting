DO $$ BEGIN
  CREATE TYPE "LoyaltyEarnRule" AS ENUM ('STANDARD', 'BOOSTED', 'FIXED', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "loyaltyRule" "LoyaltyEarnRule" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "loyaltyMultiplier" DECIMAL(4,1);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "loyaltyRuleStartsAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "loyaltyRuleEndsAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyPointsFrozenAt" TIMESTAMP(3);

UPDATE "Product" SET "loyaltyRule" = 'FIXED' WHERE "loyaltyPointsEarn" > 0 AND "loyaltyRule" = 'STANDARD';

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_loyalty_fixed_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_loyalty_fixed_check" CHECK ("loyaltyPointsEarn" >= 0 AND "loyaltyPointsEarn" <= 100000 AND (("loyaltyRule" = 'FIXED') = ("loyaltyPointsEarn" > 0)));

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_loyalty_multiplier_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_loyalty_multiplier_check" CHECK ((("loyaltyRule" = 'BOOSTED') = ("loyaltyMultiplier" IS NOT NULL)) AND ("loyaltyMultiplier" IS NULL OR ("loyaltyMultiplier" >= 1.1 AND "loyaltyMultiplier" <= 10)));

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_loyalty_window_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_loyalty_window_check" CHECK (("loyaltyRule" IN ('BOOSTED', 'FIXED') OR ("loyaltyRuleStartsAt" IS NULL AND "loyaltyRuleEndsAt" IS NULL)) AND ("loyaltyRuleStartsAt" IS NULL OR "loyaltyRuleEndsAt" IS NULL OR "loyaltyRuleEndsAt" > "loyaltyRuleStartsAt"));
