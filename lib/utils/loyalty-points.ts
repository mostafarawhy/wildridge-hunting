const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const TEN = BigInt(10);
const SCALE = BigInt(100000);

export const LOYALTY_EARN_RULES = ["STANDARD", "BOOSTED", "FIXED", "NONE"] as const;

export type LoyaltyEarnRuleValue = (typeof LOYALTY_EARN_RULES)[number];

export interface ProductLoyaltyRule {
  rule: LoyaltyEarnRuleValue;
  multiplier: number | null;
  fixedPoints: number;
  startsAt: string | null;
  endsAt: string | null;
}

export type EffectiveLoyaltyRule =
  | { kind: "STANDARD" }
  | { kind: "BOOSTED"; multiplier: number }
  | { kind: "FIXED"; points: number }
  | { kind: "NONE" };

function parseCents(value: string): bigint {
  const match = MONEY_PATTERN.exec(value.trim());
  if (!match) throw new Error(`Invalid money value: ${value}`);
  const negative = match[1] === "-";
  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  const cents = whole * HUNDRED + fraction;
  return negative ? -cents : cents;
}

function formatCents(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const fraction = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function sumMoneyStrings(values: string[]): string {
  let total = ZERO;
  for (const value of values) total += parseCents(value);
  return formatCents(total);
}

export function effectiveLoyaltyRule(
  rule: ProductLoyaltyRule,
  at: Date,
): EffectiveLoyaltyRule {
  if (rule.rule === "NONE") return { kind: "NONE" };
  if (rule.rule !== "BOOSTED" && rule.rule !== "FIXED") return { kind: "STANDARD" };
  if (rule.startsAt && at < new Date(rule.startsAt)) return { kind: "STANDARD" };
  if (rule.endsAt && at > new Date(rule.endsAt)) return { kind: "STANDARD" };
  if (rule.rule === "BOOSTED") {
    if (rule.multiplier === null) return { kind: "STANDARD" };
    return { kind: "BOOSTED", multiplier: rule.multiplier };
  }
  if (rule.fixedPoints < 1) return { kind: "STANDARD" };
  return { kind: "FIXED", points: rule.fixedPoints };
}

export function computeOrderPointsWithRules(input: {
  lines: { lineTotal: string; quantity: number; rule: EffectiveLoyaltyRule }[];
  discountTotal: string;
  earnRate: number;
}): number {
  const rateHundredths = BigInt(Math.round(input.earnRate * 100));

  let raw = ZERO;
  let merchandiseCents = ZERO;

  for (const line of input.lines) {
    const cents = parseCents(line.lineTotal);
    merchandiseCents += cents;
    const rule = line.rule;
    if (rule.kind === "STANDARD") {
      raw += cents * rateHundredths * TEN;
    } else if (rule.kind === "BOOSTED") {
      raw += cents * rateHundredths * BigInt(Math.round(rule.multiplier * 10));
    } else if (rule.kind === "FIXED") {
      raw += BigInt(rule.points) * BigInt(line.quantity) * SCALE;
    }
  }

  if (merchandiseCents === ZERO) return 0;

  let discountCents = parseCents(input.discountTotal);
  if (discountCents < ZERO) discountCents = ZERO;
  if (discountCents > merchandiseCents) discountCents = merchandiseCents;

  const points =
    (raw * (merchandiseCents - discountCents)) / (merchandiseCents * SCALE);

  return Number(points);
}

export function computeOrderPoints(input: {
  lines: { lineTotal: string; quantity: number; fixedPoints: number }[];
  discountTotal: string;
  earnRate: number;
}): number {
  return computeOrderPointsWithRules({
    lines: input.lines.map((line) => ({
      lineTotal: line.lineTotal,
      quantity: line.quantity,
      rule:
        line.fixedPoints > 0
          ? { kind: "FIXED" as const, points: line.fixedPoints }
          : { kind: "STANDARD" as const },
    })),
    discountTotal: input.discountTotal,
    earnRate: input.earnRate,
  });
}

export interface RedeemRule {
  pointsPerAed: number;
  minPoints: number;
  maxSharePercent: number;
}

export function redeemRuleOf(program: {
  redeemPointsPerAed: number;
  redeemMinPoints: number;
  redeemMaxSharePercent: number;
}): RedeemRule {
  return {
    pointsPerAed: program.redeemPointsPerAed,
    minPoints: program.redeemMinPoints,
    maxSharePercent: program.redeemMaxSharePercent,
  };
}

export function pointsToAed(points: number, rule: RedeemRule): number {
  return Number(formatCents((BigInt(points) * HUNDRED) / BigInt(rule.pointsPerAed)));
}

export function redeemCapPoints(goodsAfterCoupon: string, rule: RedeemRule): number {
  const cents = parseCents(goodsAfterCoupon);
  if (cents <= ZERO) return 0;
  const capCents = (cents * BigInt(rule.maxSharePercent)) / HUNDRED;
  return Number((capCents * BigInt(rule.pointsPerAed)) / HUNDRED);
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - BigInt(1)) / b;
}

export function redeemMinGoodsAed(rule: RedeemRule): number {
  const capCents = ceilDiv(BigInt(rule.minPoints) * HUNDRED, BigInt(rule.pointsPerAed));
  return Number(formatCents(ceilDiv(capCents * HUNDRED, BigInt(rule.maxSharePercent))));
}

export type RedemptionCheck =
  | { ok: true; discountAed: number }
  | { ok: false; reason: "BELOW_MINIMUM" | "OVER_LIMIT" | "INSUFFICIENT_BALANCE" };

export function checkRedemption(input: {
  points: number;
  goodsAfterCoupon: string;
  balance: number;
  rule: RedeemRule;
}): RedemptionCheck {
  if (!Number.isInteger(input.points) || input.points < input.rule.minPoints) {
    return { ok: false, reason: "BELOW_MINIMUM" };
  }
  if (input.points > redeemCapPoints(input.goodsAfterCoupon, input.rule)) {
    return { ok: false, reason: "OVER_LIMIT" };
  }
  if (input.points > input.balance) {
    return { ok: false, reason: "INSUFFICIENT_BALANCE" };
  }
  return { ok: true, discountAed: pointsToAed(input.points, input.rule) };
}

export function normalizeLoyaltyRuleFields<
  T extends {
    loyaltyRule: LoyaltyEarnRuleValue;
    loyaltyMultiplier: number | null;
    loyaltyPointsEarn: number;
    loyaltyRuleStartsAt: string | null;
    loyaltyRuleEndsAt: string | null;
  },
>(d: T): T {
  const windowed = d.loyaltyRule === "BOOSTED" || d.loyaltyRule === "FIXED";
  return {
    ...d,
    loyaltyPointsEarn: d.loyaltyRule === "FIXED" ? d.loyaltyPointsEarn : 0,
    loyaltyMultiplier: d.loyaltyRule === "BOOSTED" ? d.loyaltyMultiplier : null,
    loyaltyRuleStartsAt: windowed ? d.loyaltyRuleStartsAt : null,
    loyaltyRuleEndsAt: windowed ? d.loyaltyRuleEndsAt : null,
  };
}

export function formatMultiplier(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
