ALTER TABLE "OrderPayment" ADD COLUMN IF NOT EXISTS "methodOtherLabel" TEXT;

ALTER TABLE "OrderPayment" DROP CONSTRAINT IF EXISTS "OrderPayment_method_other_label_check";

ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_method_other_label_check"
  CHECK (
    ("method" = 'OTHER' AND "methodOtherLabel" IS NOT NULL AND btrim("methodOtherLabel") <> '')
    OR ("method" <> 'OTHER' AND "methodOtherLabel" IS NULL)
  );
