"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import { updateLoyaltyProgramAction } from "@/lib/actions/loyalty-admin";
import { formatAED, roundMoney, sumMoney } from "@/lib/utils/currency";
import {
  computeOrderPointsWithRules,
  pointsToAed,
  redeemCapPoints,
  redeemMinGoodsAed,
} from "@/lib/utils/loyalty-points";

interface Props {
  initial: {
    enabled: boolean;
    earnRate: number;
    redeemPointsPerAed: number;
    redeemMinPoints: number;
    redeemMaxSharePercent: number;
  };
  vatRate: number;
}

interface FieldErrors {
  earnRate?: string;
  redeemPointsPerAed?: string;
  redeemMinPoints?: string;
  redeemMaxSharePercent?: string;
}

const RATE_ERROR = "Enter a number from 0 to 100.";
const WHOLE_ERROR = "Enter a whole number.";

function parseIntegerInRange(value: string, min: number, max: number): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function parseEarnRate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  return Number(trimmed);
}

const advisoryLineStyle: React.CSSProperties = {
  color: "#92400e",
  fontSize: "var(--text-body-sm)",
  lineHeight: "var(--leading-relaxed)",
  margin: 0,
};

function toggleStyle(selected: boolean, disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "2.5rem",
    paddingInline: "1.25rem",
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-bold)",
    letterSpacing: "var(--tracking-widest)",
    textTransform: "uppercase",
    backgroundColor: "#0b0b0b",
    color: "#ffffff",
    border: "none",
    borderRadius: "0",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: selected ? 1 : 0.45,
  };
}

const tryLineStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

const moneyStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

export default function LoyaltyProgramForm({ initial, vatRate }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [rateInput, setRateInput] = useState(String(initial.earnRate));
  const [redeemRateInput, setRedeemRateInput] = useState(
    String(initial.redeemPointsPerAed),
  );
  const [redeemMinInput, setRedeemMinInput] = useState(
    String(initial.redeemMinPoints),
  );
  const [redeemShareInput, setRedeemShareInput] = useState(
    String(initial.redeemMaxSharePercent),
  );
  const [tryItems, setTryItems] = useState("500");
  const [tryCoupon, setTryCoupon] = useState("0");
  const [tryBalance, setTryBalance] = useState("2000");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const liveRate = parseIntegerInRange(redeemRateInput, 10, 1000);
  const liveMin = parseIntegerInRange(redeemMinInput, 1, 100000);
  const liveShare = parseIntegerInRange(redeemShareInput, 1, 50);
  const liveEarn = parseEarnRate(rateInput);

  const minText = liveMin === null ? "—" : liveMin.toLocaleString("en-US");
  const shareText = liveShare === null ? "—" : `${liveShare}%`;
  const amountText =
    liveMin === null || liveRate === null
      ? "—"
      : formatAED(
          pointsToAed(liveMin, {
            pointsPerAed: liveRate,
            minPoints: liveMin,
            maxSharePercent: liveShare ?? 1,
          }),
          "en",
        );
  const backText =
    liveEarn === null || liveRate === null
      ? "—"
      : `${Number(((liveEarn / liveRate) * 100).toFixed(2))}%`;

  const tryItemsValue = parseMoney(tryItems);
  const tryCouponValue = parseMoney(tryCoupon);
  const tryBalanceValue = parseIntegerInRange(tryBalance, 0, 10000000);

  const tryResult = (() => {
    if (
      liveRate === null ||
      liveMin === null ||
      liveShare === null ||
      tryItemsValue === null ||
      tryCouponValue === null ||
      tryBalanceValue === null
    ) {
      return null;
    }
    const rule = {
      pointsPerAed: liveRate,
      minPoints: liveMin,
      maxSharePercent: liveShare,
    };
    const goodsAfterCoupon = roundMoney(
      Math.max(0, sumMoney([tryItemsValue, -tryCouponValue])),
    );
    const limitPoints = redeemCapPoints(goodsAfterCoupon.toFixed(2), rule);
    const cap = Math.min(tryBalanceValue, limitPoints);
    let used = 0;
    let note: string;
    if (tryBalanceValue < rule.minPoints) {
      note = `Points can't be used: the customer needs at least ${rule.minPoints.toLocaleString("en-US")} points.`;
    } else if (cap < rule.minPoints) {
      note = `Points can't be used: items after the coupon must reach ${formatAED(redeemMinGoodsAed(rule), "en")}.`;
    } else {
      used = cap;
      note = `Uses the most this order allows: ${used.toLocaleString("en-US")} points (limit ${limitPoints.toLocaleString("en-US")} at ${liveShare}%, balance ${tryBalanceValue.toLocaleString("en-US")}).`;
    }
    const pointsValue = used > 0 ? pointsToAed(used, rule) : 0;
    const itemsTotal = roundMoney(
      Math.max(0, sumMoney([tryItemsValue, -tryCouponValue, -pointsValue])),
    );
    const vat = roundMoney(itemsTotal - itemsTotal / (1 + vatRate));
    const earn =
      enabled && liveEarn !== null
        ? computeOrderPointsWithRules({
            lines: [
              {
                lineTotal: roundMoney(tryItemsValue).toFixed(2),
                quantity: 1,
                rule: { kind: "STANDARD" },
              },
            ],
            discountTotal: roundMoney(
              sumMoney([tryCouponValue, pointsValue]),
            ).toFixed(2),
            earnRate: liveEarn,
          })
        : null;
    return {
      items: tryItemsValue,
      coupon: tryCouponValue,
      used,
      pointsValue,
      itemsTotal,
      vat,
      earn,
      note,
    };
  })();

  const vatPct = Number((vatRate * 100).toFixed(2));
  const tryNote = tryResult?.note ?? "Fix the values above to see the order.";
  const tryEarnLine = !enabled
    ? "Earning is off, so this order earns nothing."
    : `Earns ${
        tryResult === null || tryResult.earn === null
          ? "—"
          : tryResult.earn.toLocaleString("en-US")
      } points at the standard rate when delivered. Products with their own points rule earn differently.`;

  async function handleSubmit() {
    setFieldErrors({});

    const trimmed = rateInput.trim();
    const earnRate = trimmed === "" ? NaN : Number(trimmed);
    if (!Number.isFinite(earnRate)) {
      setFieldErrors({ earnRate: RATE_ERROR });
      return;
    }

    const wholeErrors: FieldErrors = {};
    const redeemValues = {
      redeemPointsPerAed: redeemRateInput,
      redeemMinPoints: redeemMinInput,
      redeemMaxSharePercent: redeemShareInput,
    };
    const redeemNumbers = {
      redeemPointsPerAed: NaN,
      redeemMinPoints: NaN,
      redeemMaxSharePercent: NaN,
    };
    for (const name of Object.keys(redeemValues) as (keyof typeof redeemValues)[]) {
      const raw = redeemValues[name].trim();
      const n = raw === "" ? NaN : Number(raw);
      if (!Number.isInteger(n)) {
        wholeErrors[name] = WHOLE_ERROR;
      } else {
        redeemNumbers[name] = n;
      }
    }
    if (Object.keys(wholeErrors).length > 0) {
      setFieldErrors(wholeErrors);
      return;
    }

    setIsSubmitting(true);

    const result = await updateLoyaltyProgramAction({
      enabled,
      earnRate,
      redeemPointsPerAed: redeemNumbers.redeemPointsPerAed,
      redeemMinPoints: redeemNumbers.redeemMinPoints,
      redeemMaxSharePercent: redeemNumbers.redeemMaxSharePercent,
    });

    if (result.success) {
      toast.success("Loyalty program saved.");
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.earnRate) fe.earnRate = result.fieldErrors.earnRate[0];
      if (result.fieldErrors.redeemPointsPerAed)
        fe.redeemPointsPerAed = result.fieldErrors.redeemPointsPerAed[0];
      if (result.fieldErrors.redeemMinPoints)
        fe.redeemMinPoints = result.fieldErrors.redeemMinPoints[0];
      if (result.fieldErrors.redeemMaxSharePercent)
        fe.redeemMaxSharePercent = result.fieldErrors.redeemMaxSharePercent[0];
      setFieldErrors(fe);
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "0",
      }}
    >
      <div style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: "0 0 1.25rem",
          }}
        >
          Earning
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                aria-pressed={enabled}
                onClick={() => setEnabled(true)}
                disabled={isSubmitting}
                style={toggleStyle(enabled, isSubmitting)}
              >
                On
              </button>
              <button
                type="button"
                aria-pressed={!enabled}
                onClick={() => setEnabled(false)}
                disabled={isSubmitting}
                style={toggleStyle(!enabled, isSubmitting)}
              >
                Off
              </button>
            </div>
            <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b", margin: 0 }}>
              Off stops all earning. Balances are kept and customers still see them.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <Input
              id="loyalty-earn-rate"
              label="Points per AED 1 spent"
              type="text"
              dir="ltr"
              value={rateInput}
              onChange={(e) => {
                setRateInput(e.target.value);
                if (fieldErrors.earnRate)
                  setFieldErrors((fe) => ({ ...fe, earnRate: undefined }));
              }}
              disabled={isSubmitting}
              error={fieldErrors.earnRate}
              hint="From 0 to 100, up to two decimals."
            />

            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "0",
                padding: "0.875rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              <p
                style={{
                  color: "#92400e",
                  fontSize: "var(--text-body-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                  fontWeight: "var(--font-semibold)",
                }}
              >
                How earning works
              </p>
              <p
                style={{
                  color: "#92400e",
                  fontSize: "var(--text-body-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                }}
              >
                Earned on merchandise after discounts. Never on shipping or VAT. Rounded down.
              </p>
              <p
                style={{
                  color: "#92400e",
                  fontSize: "var(--text-body-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                }}
              >
                A product with its own points value earns that instead, per unit.
              </p>
              <p
                style={{
                  color: "#92400e",
                  fontSize: "var(--text-body-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                }}
              >
                Credited when the order is delivered. Quote orders don&apos;t earn.
              </p>
              <p
                style={{
                  color: "#92400e",
                  fontSize: "var(--text-body-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                }}
              >
                Example at 1 point per AED 1: AED 1,250 of goods with an AED 100 coupon earns 1,150 points.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-shop-divider)",
          padding: "1.5rem 1.5rem 1.25rem",
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: "0 0 1.25rem",
          }}
        >
          Spending
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b", margin: 0 }}>
            Customers spend points at checkout. Spending stays open while earning is off.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
              gap: "1rem",
            }}
          >
            <Input
              id="loyalty-redeem-rate"
              label="Points per AED 1 off"
              type="text"
              dir="ltr"
              value={redeemRateInput}
              onChange={(e) => {
                setRedeemRateInput(e.target.value);
                if (fieldErrors.redeemPointsPerAed)
                  setFieldErrors((fe) => ({ ...fe, redeemPointsPerAed: undefined }));
              }}
              disabled={isSubmitting}
              error={fieldErrors.redeemPointsPerAed}
              hint="10 to 1,000 points."
            />
            <Input
              id="loyalty-redeem-min"
              label="Minimum points to spend"
              type="text"
              dir="ltr"
              value={redeemMinInput}
              onChange={(e) => {
                setRedeemMinInput(e.target.value);
                if (fieldErrors.redeemMinPoints)
                  setFieldErrors((fe) => ({ ...fe, redeemMinPoints: undefined }));
              }}
              disabled={isSubmitting}
              error={fieldErrors.redeemMinPoints}
              hint="1 to 100,000 points."
            />
            <Input
              id="loyalty-redeem-share"
              label="Most of the items' value, %"
              type="text"
              dir="ltr"
              value={redeemShareInput}
              onChange={(e) => {
                setRedeemShareInput(e.target.value);
                if (fieldErrors.redeemMaxSharePercent)
                  setFieldErrors((fe) => ({ ...fe, redeemMaxSharePercent: undefined }));
              }}
              disabled={isSubmitting}
              error={fieldErrors.redeemMaxSharePercent}
              hint="1% to 50% of items after the coupon."
            />
          </div>

          <div
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "0",
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <p style={{ ...advisoryLineStyle, fontWeight: "var(--font-semibold)" }}>
              How spending works
            </p>
            <p style={advisoryLineStyle}>
              {`${minText} points take ${amountText} off; the most an order can use is ${shareText} of its items after the coupon.`}
            </p>
            <p style={advisoryLineStyle}>
              {`At these rates customers get back ${backText} of what they spend.`}
            </p>
            <p style={advisoryLineStyle}>
              Never on shipping. VAT is charged on the items after the coupon and points. Works alongside coupons.
            </p>
            <p style={advisoryLineStyle}>
              A change applies to new orders only; placed orders keep their discount.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
              borderRadius: "0",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              Try an order
            </p>
            <p style={tryLineStyle}>Uses the values above, saved or not.</p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
                gap: "1rem",
              }}
            >
              <Input
                id="loyalty-try-items"
                label="Items in the cart, AED"
                type="text"
                dir="ltr"
                value={tryItems}
                onChange={(e) => setTryItems(e.target.value)}
                hint="Prices include VAT."
              />
              <Input
                id="loyalty-try-coupon"
                label="Coupon discount, AED"
                type="text"
                dir="ltr"
                value={tryCoupon}
                onChange={(e) => setTryCoupon(e.target.value)}
                hint="Amount off the items."
              />
              <Input
                id="loyalty-try-balance"
                label="Customer's balance, points"
                type="text"
                dir="ltr"
                value={tryBalance}
                onChange={(e) => setTryBalance(e.target.value)}
                hint="Points the customer holds."
              />
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: "22rem",
                marginInlineStart: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                }}
              >
                <span>Items</span>
                <span dir="ltr" style={moneyStyle}>
                  {tryResult === null ? "—" : formatAED(tryResult.items, "en")}
                </span>
              </div>
              {tryResult !== null && tryResult.coupon > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    fontSize: "var(--text-body-sm)",
                    color: "#0b0b0b",
                  }}
                >
                  <span>Coupon</span>
                  <span dir="ltr" style={moneyStyle}>
                    {`−${formatAED(tryResult.coupon, "en")}`}
                  </span>
                </div>
              )}
              {tryResult !== null && tryResult.used > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    fontSize: "var(--text-body-sm)",
                    color: "#0b0b0b",
                  }}
                >
                  <span>{`Points · ${tryResult.used.toLocaleString("en-US")}`}</span>
                  <span dir="ltr" style={moneyStyle}>
                    {`−${formatAED(tryResult.pointsValue, "en")}`}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  borderTop: "1px solid #0b0b0b",
                  paddingTop: "0.5rem",
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                }}
              >
                <span>Items total</span>
                <span dir="ltr" style={moneyStyle}>
                  {tryResult === null ? "—" : formatAED(tryResult.itemsTotal, "en")}
                </span>
              </div>
            </div>

            <p style={tryLineStyle}>
              {`Includes VAT (${vatPct}%) of ${
                tryResult === null ? "—" : formatAED(tryResult.vat, "en")
              }. Shipping is added at checkout and never paid with points.`}
            </p>

            <div
              style={{
                borderTop: "1px solid var(--color-shop-divider)",
                paddingTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              <p style={tryLineStyle}>{tryNote}</p>
              <p style={tryLineStyle}>{tryEarnLine}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-shop-divider)",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={isSubmitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2.5rem",
            paddingInline: "1.25rem",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
            border: "none",
            borderRadius: "0",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
