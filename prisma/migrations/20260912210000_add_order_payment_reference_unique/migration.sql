DROP INDEX IF EXISTS unique_payment_reference_per_order;
CREATE UNIQUE INDEX unique_payment_reference_per_order ON "OrderPayment" ("orderId", lower("externalReference"));
