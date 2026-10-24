DROP INDEX "B2BAccount_customerId_key";
DROP INDEX "B2BAccount_tradeLicenseNo_key";

CREATE UNIQUE INDEX "unique_active_b2b_per_customer"
  ON "B2BAccount"("customerId")
  WHERE ("status" IN ('PENDING', 'APPROVED', 'SUSPENDED'));

CREATE UNIQUE INDEX "unique_active_b2b_per_trade_license"
  ON "B2BAccount"("tradeLicenseNo")
  WHERE ("status" IN ('PENDING', 'APPROVED', 'SUSPENDED'));

CREATE INDEX "B2BAccount_customerId_idx" ON "B2BAccount"("customerId");
