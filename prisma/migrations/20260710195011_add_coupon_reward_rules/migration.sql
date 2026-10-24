-- Admin-defined rule that mints a personal coupon when an order total
-- crosses a threshold. See lib/actions/order.ts (DELIVERED hook, Pass 2).
CREATE TABLE "CouponRewardRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minOrderTotal" DECIMAL(10,2) NOT NULL,
    "rewardType" "CouponType" NOT NULL,
    "rewardValue" DECIMAL(10,2) NOT NULL,
    "rewardMaxDiscountAmount" DECIMAL(10,2),
    "rewardMinOrderAmount" DECIMAL(10,2),
    "validityDays" INTEGER NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CouponRewardRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CouponRewardRule_isActive_idx" ON "CouponRewardRule"("isActive");

-- Personal-binding + provenance on Coupon. NULL customerId = general coupon
-- (existing behavior, unchanged). Set = bound to one customer.
ALTER TABLE "Coupon"
    ADD COLUMN "customerId" TEXT,
    ADD COLUMN "sourceRuleId" TEXT,
    ADD COLUMN "sourceOrderId" TEXT;

CREATE INDEX "Coupon_customerId_idx" ON "Coupon"("customerId");

-- Idempotency: a given rule mints at most one coupon per order.
-- (NULL,NULL) rows are all distinct in Postgres, so general coupons are uncapped.
CREATE UNIQUE INDEX "Coupon_sourceRuleId_sourceOrderId_key"
    ON "Coupon"("sourceRuleId", "sourceOrderId");

ALTER TABLE "Coupon"
    ADD CONSTRAINT "Coupon_customerId_fkey"
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Coupon_sourceRuleId_fkey"
        FOREIGN KEY ("sourceRuleId") REFERENCES "CouponRewardRule"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Coupon_sourceOrderId_fkey"
        FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
