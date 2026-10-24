ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS "Customer_loyaltyPoints_nonnegative_check";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_loyaltyPoints_nonnegative_check" CHECK ("loyaltyPoints" >= 0);
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_loyalty_redeem_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_loyalty_redeem_check" CHECK ("loyaltyPointsUsed" >= 0 AND "loyaltyDiscountAmount" >= 0 AND (("loyaltyPointsUsed" = 0) = ("loyaltyDiscountAmount" = 0)));
