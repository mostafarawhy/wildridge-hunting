import { BRAND } from "../../lib/config/brand";
import { DEMO_PLACEHOLDER_DOCUMENT } from "../../lib/config/demo";
import { renderEmailSubject } from "../../lib/email/chrome";
import { EMAIL_DEFAULTS } from "../../lib/email/defaults";
import { getComplianceSnapshot } from "../../lib/db/queries/verification";
import { roundMoney, sumMoney } from "../../lib/utils/currency";
import {
  checkRedemption,
  computeOrderPoints,
  pointsToAed,
  redeemCapPoints,
  redeemRuleOf,
} from "../../lib/utils/loyalty-points";
import { Prisma, type PrismaClient } from "../../app/generated/prisma/client";
import { hashInt, logDone, logSection, mulberry32, uploadSeedAsset } from "./seed-utils";
import { STAFF_EMAILS } from "./06-staff.seed";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const VAT_RATE = 0.05;
const FREE_SHIPPING_THRESHOLD = 500;
const STANDARD_SHIPPING = 50;

// The database has no loyalty_program row, so the app runs on the schema defaults in lib/settings/keys.ts.
const LOYALTY_PROGRAM = {
  earnRate: 1,
  redeemPointsPerAed: 50,
  redeemMinPoints: 500,
  redeemMaxSharePercent: 20,
};
const REDEEM_RULE = redeemRuleOf(LOYALTY_PROGRAM);
const MAX_GENERATED_REDEMPTIONS = 16;
const MAX_POINTS_PER_ORDER = 1500;
const DEMO_RANDOM_SEED = 20260317;
const REWARD_CODE_SEED = 71013;
const REWARD_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const NOW = Date.now();
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS);
const r2 = (value: number) => Math.round(value * 100) / 100;

type Status =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "PAID"
  | "CONFIRMED"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "AWAITING_SHIPPING_QUOTE"
  | "AWAITING_QUOTE_APPROVAL"
  | "AWAITING_MANUAL_PAYMENT"
  | "RETURNED";

type Actor = "SYSTEM" | "CUSTOMER" | "STAFF";

interface CustomerSpec {
  key: string;
  name: string;
  locale: "en" | "ar" | "ru";
  phone: string;
  verification: "APPROVED" | "PENDING" | "REJECTED" | "NOT_REQUIRED";
  b2b?: "APPROVED" | "PENDING";
  joinedDaysAgo: number;
  street: string;
}

const CUSTOMERS: CustomerSpec[] = [
  { key: "layla.haddad", name: "Layla Haddad", locale: "en", phone: "+971500000101", verification: "APPROVED", joinedDaysAgo: 59, street: "Villa 3, Sample Street 4" },
  { key: "omar.khalil", name: "Omar Khalil", locale: "ar", phone: "+971500000102", verification: "APPROVED", joinedDaysAgo: 58, street: "Flat 210, Example Residence, Sample Street 7" },
  { key: "mariam.saeed", name: "Mariam Saeed", locale: "ar", phone: "+971500000103", verification: "PENDING", joinedDaysAgo: 8, street: "Villa 11, Sample Street 2" },
  { key: "yusuf.rahman", name: "Yusuf Rahman", locale: "en", phone: "+971500000104", verification: "REJECTED", joinedDaysAgo: 22, street: "Flat 54, Example Heights, Sample Street 9" },
  { key: "hana.mourad", name: "Hana Mourad", locale: "en", phone: "+971500000105", verification: "NOT_REQUIRED", joinedDaysAgo: 45, street: "Villa 8, Sample Street 5" },
  { key: "daniel.petrov", name: "Daniel Petrov", locale: "ru", phone: "+971500000106", verification: "APPROVED", joinedDaysAgo: 57, street: "Flat 18, Example Court, Sample Street 6" },
  { key: "karim.nasser", name: "Karim Nasser", locale: "en", phone: "+971500000107", verification: "APPROVED", b2b: "APPROVED", joinedDaysAgo: 56, street: "Unit 12, Sample Industrial Street 3" },
  { key: "sofia.almeida", name: "Sofia Almeida", locale: "en", phone: "+971500000108", verification: "NOT_REQUIRED", b2b: "PENDING", joinedDaysAgo: 6, street: "Unit 7, Sample Industrial Street 8" },
  { key: "ahmed.mansoori", name: "Ahmed Al Mansoori", locale: "ar", phone: "+971500000109", verification: "APPROVED", joinedDaysAgo: 94, street: "Villa 21, Sample Street 12" },
  { key: "fatima.alzaabi", name: "Fatima Al Zaabi", locale: "ar", phone: "+971500000110", verification: "APPROVED", joinedDaysAgo: 91, street: "Villa 5, Example Gardens, Sample Street 14" },
  { key: "rashid.alketbi", name: "Rashid Al Ketbi", locale: "ar", phone: "+971500000111", verification: "APPROVED", joinedDaysAgo: 88, street: "Villa 17, Sample Street 3" },
  { key: "priya.nair", name: "Priya Nair", locale: "en", phone: "+971500000112", verification: "APPROVED", joinedDaysAgo: 85, street: "Flat 903, Example Tower, Sample Street 10" },
  { key: "arjun.mehta", name: "Arjun Mehta", locale: "en", phone: "+971500000113", verification: "NOT_REQUIRED", joinedDaysAgo: 80, street: "Flat 412, Example Residence, Sample Street 15" },
  { key: "sergei.volkov", name: "Sergei Volkov", locale: "ru", phone: "+971500000114", verification: "APPROVED", joinedDaysAgo: 76, street: "Villa 9, Sample Street 8" },
  { key: "anastasia.ivanova", name: "Anastasia Ivanova", locale: "ru", phone: "+971500000115", verification: "APPROVED", joinedDaysAgo: 72, street: "Flat 27, Example Court, Sample Street 11" },
  { key: "james.whitfield", name: "James Whitfield", locale: "en", phone: "+971500000116", verification: "APPROVED", joinedDaysAgo: 70, street: "Villa 30, Example Gardens, Sample Street 6" },
  { key: "tariq.siddiqui", name: "Tariq Siddiqui", locale: "en", phone: "+971500000117", verification: "APPROVED", joinedDaysAgo: 25, street: "Flat 118, Example Heights, Sample Street 2" },
  { key: "noura.alfalasi", name: "Noura Al Falasi", locale: "ar", phone: "+971500000118", verification: "NOT_REQUIRED", joinedDaysAgo: 17, street: "Villa 14, Sample Street 9" },
  { key: "oliver.grant", name: "Oliver Grant", locale: "en", phone: "+971500000119", verification: "APPROVED", joinedDaysAgo: 9, street: "Flat 76, Example Residence, Sample Street 4" },
  { key: "irina.sokolova", name: "Irina Sokolova", locale: "ru", phone: "+971500000120", verification: "NOT_REQUIRED", joinedDaysAgo: 3, street: "Flat 8, Example Court, Sample Street 13" },
];

const SKU = {
  rifleA: "HLV-34-45",
  rifleB: "BRF-EMB-N1-45",
  rifleC: "HLV-KST80-55",
  rifleD: "BRF-SUM5-45",
  pistolA: "TRV-C17-45",
  pistolB: "TRV-TB9-45",
  pelletsA: "ASH-PDM-45-500",
  pelletsB: "ASH-HPX-55-200",
  pelletsC: "ASH-VAL-45-1000",
  scope: "ADN-001",
  sling: "ADN-005",
  co2: "CO2-12G-5PK",
  optic: "CRM-3940",
  knife: "FEN-FXD-HNT",
  pump: "PUMP-300-HCP",
  hardCase: "CASE-120-HARD",
  cleaning: "CLEAN-KIT-UNIV",
} as const;

interface OrderSpec {
  key: string;
  customer: number;
  status: Status;
  days: number;
  lines: [string, number][];
  coupon?: string;
  pointsUsed?: number;
  quote?: string;
  refundLine?: number;
  redeemPoints?: boolean;
  rewardOf?: string;
}

const ORDERS: OrderSpec[] = [
  { key: "o01", customer: 0, status: "DELIVERED", days: 55, lines: [[SKU.rifleA, 1], [SKU.pelletsA, 2]], coupon: "WELCOME10" },
  { key: "o02", customer: 5, status: "DELIVERED", days: 49, lines: [[SKU.pistolA, 1], [SKU.co2, 2]] },
  { key: "o03", customer: 1, status: "DELIVERED", days: 41, lines: [[SKU.rifleB, 1], [SKU.scope, 1], [SKU.sling, 1]], coupon: "SPRING50", pointsUsed: 500 },
  { key: "o04", customer: 4, status: "DELIVERED", days: 33, lines: [[SKU.pelletsB, 3], [SKU.cleaning, 1], [SKU.knife, 1]] },
  { key: "o05", customer: 0, status: "SHIPPED", days: 6, lines: [[SKU.rifleC, 1]] },
  { key: "o06", customer: 5, status: "READY_TO_SHIP", days: 4, lines: [[SKU.pistolB, 1], [SKU.pelletsA, 1]] },
  { key: "o07", customer: 1, status: "PROCESSING", days: 3, lines: [[SKU.pelletsC, 1], [SKU.pump, 1]] },
  { key: "o08", customer: 4, status: "CONFIRMED", days: 2, lines: [[SKU.optic, 1]] },
  { key: "o09", customer: 0, status: "PAID", days: 1, lines: [[SKU.hardCase, 1], [SKU.pelletsB, 2]] },
  { key: "o10", customer: 4, status: "PAYMENT_PENDING", days: 0.3, lines: [[SKU.knife, 2]] },
  { key: "o11", customer: 1, status: "PENDING", days: 0.1, lines: [[SKU.pelletsA, 1]] },
  { key: "o12", customer: 5, status: "PAYMENT_FAILED", days: 12, lines: [[SKU.rifleD, 1]] },
  { key: "o13", customer: 0, status: "CANCELLED", days: 20, lines: [[SKU.pistolA, 1]] },
  { key: "o14", customer: 1, status: "RETURNED", days: 28, lines: [[SKU.pistolB, 1]] },
  { key: "o15", customer: 5, status: "REFUNDED", days: 36, lines: [[SKU.rifleC, 1]] },
  { key: "o16", customer: 4, status: "PARTIALLY_REFUNDED", days: 26, lines: [[SKU.pelletsA, 2], [SKU.sling, 2]], refundLine: 1 },
  { key: "o17", customer: 1, status: "AWAITING_SHIPPING_QUOTE", days: 1, lines: [[SKU.rifleA, 1]] },
  { key: "o18", customer: 5, status: "AWAITING_QUOTE_APPROVAL", days: 2, lines: [[SKU.pelletsC, 2]] },
  { key: "o19", customer: 6, status: "AWAITING_MANUAL_PAYMENT", days: 5, lines: [], quote: "q3" },
];

interface CouponDef {
  code: string;
  type: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  usageLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  customer?: number;
  sourceOrderKey?: string;
}

const COUPONS: CouponDef[] = [
  { code: "WELCOME10", type: "PERCENTAGE", value: 10, minOrderAmount: null, maxDiscountAmount: 150, usageLimit: 500, startsAt: daysAgo(70), endsAt: null, isActive: true, createdAt: daysAgo(71) },
  { code: "SPRING50", type: "FIXED", value: 50, minOrderAmount: 300, maxDiscountAmount: null, usageLimit: 200, startsAt: daysAgo(70), endsAt: null, isActive: true, createdAt: daysAgo(71) },
  { code: "FREESHIP", type: "FREE_SHIPPING", value: 0, minOrderAmount: 150, maxDiscountAmount: null, usageLimit: null, startsAt: daysAgo(70), endsAt: null, isActive: true, createdAt: daysAgo(71) },
  { code: "SUMMER15", type: "PERCENTAGE", value: 15, minOrderAmount: null, maxDiscountAmount: 200, usageLimit: null, startsAt: daysAgo(85), endsAt: daysAgo(40), isActive: true, createdAt: daysAgo(86) },
  { code: "FIRSTSHOT", type: "FIXED", value: 75, minOrderAmount: 400, maxDiscountAmount: null, usageLimit: 10, startsAt: daysAgo(90), endsAt: null, isActive: true, createdAt: daysAgo(91) },
  { code: "AUTUMN20", type: "PERCENTAGE", value: 20, minOrderAmount: null, maxDiscountAmount: null, usageLimit: null, startsAt: daysAgo(-10), endsAt: null, isActive: true, createdAt: daysAgo(12) },
  { code: "TEAMDAY", type: "FIXED", value: 30, minOrderAmount: null, maxDiscountAmount: null, usageLimit: null, startsAt: daysAgo(30), endsAt: null, isActive: false, createdAt: daysAgo(32) },
];

const REWARD_RULE = {
  name: "Big order reward",
  minOrderTotal: 1500,
  rewardValue: 100,
  rewardMinOrderAmount: 500,
  validityDays: 30,
  codePrefix: "THANKS",
  createdAt: daysAgo(70),
};

const LADDER: Status[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
];
const LADDER_HOURS: Record<string, number> = {
  PENDING: 0,
  PAYMENT_PENDING: 0.02,
  PAID: 0.1,
  CONFIRMED: 2,
  PROCESSING: 6,
  READY_TO_SHIP: 20,
  SHIPPED: 26,
  DELIVERED: 74,
};
const LADDER_NOTES: Record<string, string> = {
  PAYMENT_PENDING: "Payment started",
  PAID: "Payment captured",
  CONFIRMED: "Order confirmed",
  PROCESSING: "Picked and packed",
  READY_TO_SHIP: "Packed and waiting for the courier",
  SHIPPED: "Handed to the courier",
  DELIVERED: "Delivered",
};
const PAID_STATUSES: Status[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];
const SHIPPED_STATUSES: Status[] = [
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];
const STOCK_OUT_STATUSES: Status[] = [
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

interface ProductInfo {
  sku: string;
  nameEn: string;
  nameAr: string;
  price: number;
  requiresId: boolean;
  stock: number;
  loyaltyPointsEarn: number;
  image: string | null;
}

interface EventSpec {
  from: Status | null;
  to: Status;
  hours: number;
  actor: Actor;
  note: string;
}

function eventsFor(status: Status): EventSpec[] {
  const events: EventSpec[] = [
    { from: null, to: "PENDING", hours: 0, actor: "CUSTOMER", note: "Order placed" },
  ];
  const push = (from: Status, to: Status, hours: number, actor: Actor, note: string) =>
    events.push({ from, to, hours, actor, note });

  const ladderTo = (target: Status) => {
    const end = LADDER.indexOf(target);
    for (let i = 1; i <= end; i++) {
      const to = LADDER[i];
      const staffStep = ["CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(to);
      push(LADDER[i - 1], to, LADDER_HOURS[to], staffStep ? "STAFF" : "SYSTEM", LADDER_NOTES[to]);
    }
  };

  switch (status) {
    case "PENDING":
      break;
    case "PAYMENT_FAILED":
      push("PENDING", "PAYMENT_PENDING", 0.02, "SYSTEM", "Payment started");
      push("PAYMENT_PENDING", "PAYMENT_FAILED", 0.05, "SYSTEM", "Card declined by the issuer");
      break;
    case "CANCELLED":
      push("PENDING", "PAYMENT_PENDING", 0.02, "SYSTEM", "Payment started");
      push("PAYMENT_PENDING", "CANCELLED", 30, "STAFF", "Cancelled after the payment window expired");
      break;
    case "AWAITING_SHIPPING_QUOTE":
      push("PENDING", "AWAITING_SHIPPING_QUOTE", 0.01, "SYSTEM", "Waiting for a shipping quote");
      break;
    case "AWAITING_QUOTE_APPROVAL":
      push("PENDING", "AWAITING_SHIPPING_QUOTE", 0.01, "SYSTEM", "Waiting for a shipping quote");
      push("AWAITING_SHIPPING_QUOTE", "AWAITING_QUOTE_APPROVAL", 5, "STAFF", "Shipping quoted, waiting for the customer");
      break;
    case "AWAITING_MANUAL_PAYMENT":
      push("PENDING", "AWAITING_MANUAL_PAYMENT", 0.01, "SYSTEM", "Created from an accepted quote");
      break;
    case "RETURNED":
      ladderTo("DELIVERED");
      push("DELIVERED", "RETURNED", 74 + 96, "STAFF", "Goods returned by the customer");
      break;
    case "REFUNDED":
      ladderTo("DELIVERED");
      push("DELIVERED", "RETURNED", 74 + 96, "STAFF", "Goods returned by the customer");
      push("RETURNED", "REFUNDED", 74 + 120, "STAFF", "Refund sent");
      break;
    case "PARTIALLY_REFUNDED":
      ladderTo("DELIVERED");
      push("DELIVERED", "PARTIALLY_REFUNDED", 74 + 96, "STAFF", "Partial refund sent");
      break;
    default:
      ladderTo(status);
  }
  return events;
}

const DELIVERED_STATUSES: Status[] = ["DELIVERED", "RETURNED", "REFUNDED", "PARTIALLY_REFUNDED"];

const EMAIL_FOR_STATUS: Partial<Record<Status, string>> = {
  PAID: "order_paid",
  SHIPPED: "order_shipped",
  DELIVERED: "order_delivered",
  CANCELLED: "order_cancelled",
  PAYMENT_FAILED: "payment_failed",
  REFUNDED: "order_refunded",
  PARTIALLY_REFUNDED: "order_refunded",
  RETURNED: "order_returned",
  AWAITING_MANUAL_PAYMENT: "order_awaiting_payment",
  AWAITING_QUOTE_APPROVAL: "order_shipping_quoted",
};

const dubaiDay = (date: Date) => new Date(date.getTime() + 4 * HOUR_MS).toISOString().slice(0, 10);

type ProductLookup = (sku: string) => ProductInfo;

interface QuotePlan {
  shipping: number;
  items: { sku: string; qty: number; unit: number }[];
}

interface CouponResolution {
  discountAmount: number;
  freeShipping: boolean;
}

// Mirrors resolveCoupon in lib/db/queries/coupon.ts.
function resolveSeedCoupon(
  coupon: CouponDef,
  ctx: { customer: number; goodsTotal: number; shippingCost: number; at: Date; usedCount: number },
): CouponResolution | null {
  if (coupon.customer !== undefined && coupon.customer !== ctx.customer) return null;
  if (!coupon.isActive) return null;
  if (coupon.startsAt && ctx.at < coupon.startsAt) return null;
  if (coupon.endsAt && ctx.at > coupon.endsAt) return null;
  if (coupon.minOrderAmount !== null && ctx.goodsTotal < coupon.minOrderAmount) return null;
  if (coupon.usageLimit !== null && ctx.usedCount >= coupon.usageLimit) return null;

  let discount: number;
  if (coupon.type === "PERCENTAGE") {
    discount = roundMoney((ctx.goodsTotal * coupon.value) / 100);
    if (coupon.maxDiscountAmount !== null) discount = Math.min(discount, coupon.maxDiscountAmount);
    discount = Math.min(discount, ctx.goodsTotal);
  } else if (coupon.type === "FIXED") {
    discount = Math.min(roundMoney(coupon.value), ctx.goodsTotal);
  } else {
    discount = Math.max(0, roundMoney(ctx.shippingCost));
  }
  return { discountAmount: discount, freeShipping: coupon.type === "FREE_SHIPPING" };
}

interface BigOrderSpec {
  tag: string;
  customer: number;
  days: number;
  lines: [string, number][];
  followUp?: { tag: string; days: number; lines: [string, number][] };
}

const BIG_ORDERS: BigOrderSpec[] = [
  { tag: "big1", customer: 8, days: 64, lines: [[SKU.rifleB, 1]], followUp: { tag: "fol1", days: 41, lines: [[SKU.pistolB, 1], [SKU.pelletsA, 2]] } },
  { tag: "big2", customer: 10, days: 62, lines: [[SKU.rifleC, 1], [SKU.pistolA, 1]], followUp: { tag: "fol2", days: 44, lines: [[SKU.optic, 1], [SKU.scope, 1]] } },
  { tag: "big3", customer: 13, days: 20, lines: [[SKU.rifleD, 1]] },
  { tag: "big4", customer: 14, days: 26, lines: [[SKU.rifleB, 1], [SKU.scope, 1]], followUp: { tag: "fol3", days: 13, lines: [[SKU.pump, 1], [SKU.hardCase, 1]] } },
  { tag: "big5", customer: 11, days: 18, lines: [[SKU.rifleA, 1], [SKU.rifleB, 1]] },
  { tag: "big6", customer: 9, days: 66, lines: [[SKU.rifleC, 1], [SKU.rifleA, 1]] },
];

const FIREARMS: [string, number][] = [
  [SKU.rifleA, 45],
  [SKU.rifleB, 25],
  [SKU.rifleC, 20],
  [SKU.rifleD, 2],
  [SKU.pistolA, 30],
  [SKU.pistolB, 28],
];
const OPTICS: string[] = [SKU.optic, SKU.scope];
const CONSUMABLES: [string, number][] = [
  [SKU.pelletsA, 5],
  [SKU.pelletsB, 4],
  [SKU.pelletsC, 4],
  [SKU.co2, 5],
  [SKU.cleaning, 3],
  [SKU.sling, 2],
];
const GEAR: string[] = [SKU.knife, SKU.pump, SKU.hardCase];
const MULTI_QUANTITY_SKUS = new Set<string>(CONSUMABLES.map(([sku]) => sku));

function buildGeneratedOrders(productOf: ProductLookup): OrderSpec[] {
  const rng = mulberry32(DEMO_RANDOM_SEED);
  const chance = (probability: number) => rng() < probability;
  const between = (low: number, high: number) => low + Math.floor(rng() * (high - low + 1));
  const pickOne = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const pickWeighted = <T>(items: readonly (readonly [T, number])[]): T => {
    const total = items.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;
    for (const [item, weight] of items) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1][0];
  };

  const canBuyRestricted = (customer: number, days: number) =>
    CUSTOMERS[customer].verification === "APPROVED" && days < CUSTOMERS[customer].joinedDaysAgo - 3;
  const allowedFor = (customer: number, days: number) => (sku: string) =>
    !productOf(sku).requiresId || canBuyRestricted(customer, days);
  const quantityOf = (sku: string) => (MULTI_QUANTITY_SKUS.has(sku) ? between(1, 4) : 1);

  const pickLines = (customer: number, days: number): [string, number][] => {
    const count = pickWeighted<number>([[1, 50], [2, 33], [3, 17]]);
    const allowed = allowedFor(customer, days);
    const lines: [string, number][] = [];
    const chosen = new Set<string>();
    const add = (sku: string) => {
      if (chosen.has(sku)) return;
      chosen.add(sku);
      lines.push([sku, quantityOf(sku)]);
    };
    const lead = rng();
    if (lead < 0.3) {
      const pool = FIREARMS.filter(([sku]) => allowed(sku));
      if (pool.length > 0) add(pickWeighted(pool));
    } else if (lead < 0.45) {
      const pool = OPTICS.filter(allowed);
      if (pool.length > 0) add(pickOne(pool));
    } else if (lead < 0.55) {
      add(pickOne(GEAR));
    }
    while (lines.length < count) add(pickWeighted(CONSUMABLES));
    return lines;
  };

  const statusForAge = (days: number): Status => {
    if (days > 10) {
      const roll = rng();
      return roll < 0.88 ? "DELIVERED" : roll < 0.94 ? "CANCELLED" : "PAYMENT_FAILED";
    }
    if (days >= 6) return "DELIVERED";
    const options: [Status, number][] = [["SHIPPED", 8]];
    if (days < 3) options.push(["PAID", 1], ["CONFIRMED", 2], ["PROCESSING", 3], ["READY_TO_SHIP", 3]);
    return pickWeighted(options.filter(([status]) => LADDER_HOURS[status] <= days * 24 - 1));
  };

  const drafts: OrderSpec[] = [];
  for (let day = 88; day >= 0; day--) {
    const rate = day <= 30 ? 1.75 : 1.15;
    const whole = Math.floor(rate);
    const count = whole + (chance(rate - whole) ? 1 : 0);
    for (let n = 0; n < count; n++) {
      const days = Math.max(0.2, Math.round((day + rng()) * 10000) / 10000);
      const candidates: [number, number][] = CUSTOMERS.flatMap((customer, index): [number, number][] =>
        customer.joinedDaysAgo > days + 0.25 ? [[index, customer.verification === "APPROVED" ? 3 : 1.5]] : [],
      );
      const customer = pickWeighted(candidates);
      drafts.push({
        key: `draft${drafts.length}`,
        customer,
        status: statusForAge(days),
        days,
        lines: pickLines(customer, days),
      });
    }
  }

  const ascending = [...drafts].sort((a, b) => b.days - a.days);
  const subtotalOf = (spec: OrderSpec) =>
    sumMoney(spec.lines.map(([sku, qty]) => roundMoney(productOf(sku).price * qty)));
  const payable = (spec: OrderSpec) => PAID_STATUSES.includes(spec.status);

  const firstShotPool = ascending.filter((spec) => payable(spec) && subtotalOf(spec) >= 400);
  const firstShotCustomers = new Set<number>();
  let firstShotUses = 0;
  const claimFirstShot = (spec: OrderSpec) => {
    spec.coupon = "FIRSTSHOT";
    firstShotCustomers.add(spec.customer);
    firstShotUses++;
  };
  const pickRate = 12 / Math.max(1, firstShotPool.length);
  for (const spec of firstShotPool) {
    if (firstShotUses >= 10) break;
    if (!firstShotCustomers.has(spec.customer) && chance(pickRate)) claimFirstShot(spec);
  }
  for (const spec of firstShotPool) {
    if (firstShotUses >= 10) break;
    if (!spec.coupon && !firstShotCustomers.has(spec.customer)) claimFirstShot(spec);
  }
  for (const spec of firstShotPool) {
    if (firstShotUses >= 10) break;
    if (!spec.coupon) claimFirstShot(spec);
  }
  if (firstShotUses < 10) throw new Error("Not enough generated orders to use FIRSTSHOT ten times.");

  for (const spec of ascending) {
    if (!payable(spec) || spec.coupon) continue;
    const subtotal = subtotalOf(spec);
    if (spec.days >= 41 && spec.days <= 84 && subtotal >= 100 && chance(0.3)) {
      spec.coupon = "SUMMER15";
    } else if (spec.days <= 69) {
      const roll = rng();
      if (roll < 0.1) spec.coupon = "WELCOME10";
      else if (roll < 0.22 && subtotal >= 300) spec.coupon = "SPRING50";
      else if (roll < 0.34 && subtotal >= 150 && subtotal < FREE_SHIPPING_THRESHOLD) spec.coupon = "FREESHIP";
    }
  }
  for (const spec of ascending) {
    if (payable(spec) && ![0, 1, 5].includes(spec.customer) && subtotalOf(spec) >= 300 && chance(0.5)) {
      spec.redeemPoints = true;
    }
  }

  for (const big of BIG_ORDERS) {
    drafts.push({ key: big.tag, customer: big.customer, status: "DELIVERED", days: big.days, lines: big.lines });
    if (big.followUp) {
      drafts.push({
        key: big.followUp.tag,
        customer: big.customer,
        status: "DELIVERED",
        days: big.followUp.days,
        lines: big.followUp.lines,
        rewardOf: big.tag,
      });
    }
  }

  const ordered = [...drafts].sort((a, b) => b.days - a.days);
  const finalKey = new Map<string, string>();
  ordered.forEach((spec, index) => finalKey.set(spec.key, `g${String(index + 1).padStart(3, "0")}`));
  return ordered.map((spec) => ({
    ...spec,
    key: finalKey.get(spec.key)!,
    rewardOf: spec.rewardOf ? finalKey.get(spec.rewardOf) : undefined,
  }));
}

interface LoyaltyEvent {
  customer: number;
  at: Date;
  type: "EARNED" | "REDEEMED" | "ADJUSTED" | "EXPIRED" | "REVERSED" | "REFUNDED";
  delta: number;
  reason: string;
  orderKey?: string;
  balanceAfter?: number;
}

interface StockMove {
  sku: string;
  delta: number;
  type: "SALE" | "RETURN";
  reference: string;
  at: Date;
}

interface StockRow {
  sku: string;
  delta: number;
  before: number;
  after: number;
  type: "PURCHASE" | "SALE" | "RETURN" | "MANUAL_ADJUSTMENT";
  reason: string;
  reference: string | null;
  at: Date;
}

interface OrderPlan {
  spec: OrderSpec;
  created: Date;
  lines: { sku: string; qty: number; unit: number }[];
  subtotal: number;
  discount: number;
  redemptionDiscount: number;
  coupon: CouponDef | null;
  pointsUsed: number;
  loyaltyDiscount: number;
  shippingCost: number;
  total: number;
  taxAmount: number;
  earned: number;
  events: (EventSpec & { at: Date })[];
  reward: CouponDef | null;
}

interface DemoPlan {
  plans: OrderPlan[];
  loyaltyEvents: LoyaltyEvent[];
  stockMoves: StockMove[];
  couponUses: Map<string, number>;
}

function planOrders(specs: OrderSpec[], productOf: ProductLookup, quotes: Map<string, QuotePlan>): DemoPlan {
  const codeRng = mulberry32(REWARD_CODE_SEED);
  const issuedCodes = new Set<string>();
  const newRewardCode = () => {
    for (;;) {
      let suffix = "";
      for (let i = 0; i < 5; i++) suffix += REWARD_CODE_ALPHABET[Math.floor(codeRng() * REWARD_CODE_ALPHABET.length)];
      const code = `${REWARD_RULE.codePrefix}-${suffix}`;
      if (!issuedCodes.has(code)) {
        issuedCodes.add(code);
        return code;
      }
    }
  };

  const loyaltyEvents: LoyaltyEvent[] = [
    ...[0, 1, 5].map((customer): LoyaltyEvent => ({ customer, at: daysAgo(59), type: "ADJUSTED", delta: 1200, reason: "Welcome bonus" })),
    { customer: 0, at: daysAgo(10), type: "EXPIRED", delta: -30, reason: "Points expired" },
    { customer: 4, at: daysAgo(30), type: "ADJUSTED", delta: 100, reason: "Goodwill gesture" },
  ];
  const balanceAt = (customer: number, at: Date) =>
    loyaltyEvents.reduce(
      (sum, event) =>
        event.customer !== customer ? sum : sum + (event.at <= at ? event.delta : Math.min(0, event.delta)),
      0,
    );

  const stockMoves: StockMove[] = [];
  const couponUses = new Map<string, number>();
  const rewardByOrder = new Map<string, CouponDef>();
  const plans: OrderPlan[] = [];
  let generatedRedemptions = 0;

  for (const spec of [...specs].sort((a, b) => b.days - a.days)) {
    const created = daysAgo(spec.days);
    const quote = spec.quote ? quotes.get(spec.quote) : undefined;
    const lines = quote
      ? quote.items.map((i) => ({ sku: i.sku, qty: i.qty, unit: i.unit }))
      : spec.lines.map(([sku, qty]) => ({ sku, qty, unit: productOf(sku).price }));
    const subtotal = sumMoney(lines.map((l) => roundMoney(l.unit * l.qty)));
    const paid = PAID_STATUSES.includes(spec.status);
    const delivered = DELIVERED_STATUSES.includes(spec.status);
    const events = eventsFor(spec.status).map((e) => ({
      ...e,
      at: new Date(Math.min(NOW - 60_000, created.getTime() + e.hours * HOUR_MS)),
    }));
    const timeOf = (status: Status) => events.find((e) => e.to === status)?.at ?? null;

    let coupon: CouponDef | null = null;
    let resolution: CouponResolution | null = null;
    const wanted = spec.rewardOf
      ? rewardByOrder.get(spec.rewardOf)
      : spec.coupon
        ? COUPONS.find((c) => c.code === spec.coupon)
        : undefined;
    if ((spec.rewardOf || spec.coupon) && !wanted) {
      throw new Error(`Seed coupon for order ${spec.key} was not issued.`);
    }
    if (wanted) {
      resolution = resolveSeedCoupon(wanted, {
        customer: spec.customer,
        goodsTotal: subtotal,
        shippingCost: STANDARD_SHIPPING,
        at: created,
        usedCount: couponUses.get(wanted.code) ?? 0,
      });
      if (!resolution) throw new Error(`Seed coupon ${wanted.code} is not valid for order ${spec.key}.`);
      if (resolution.discountAmount > 0) {
        coupon = wanted;
      } else {
        resolution = null;
      }
    }
    const discount = coupon && resolution && !resolution.freeShipping ? resolution.discountAmount : 0;
    const freeShippingCoupon = Boolean(resolution?.freeShipping);
    const goodsAfterCoupon = Math.max(0, sumMoney([subtotal, -discount])).toFixed(2);

    let pointsUsed = spec.pointsUsed ?? 0;
    if (pointsUsed > 0) {
      const check = checkRedemption({
        points: pointsUsed,
        goodsAfterCoupon,
        balance: balanceAt(spec.customer, created),
        rule: REDEEM_RULE,
      });
      if (!check.ok) throw new Error(`Seed points for order ${spec.key} are not redeemable: ${check.reason}.`);
    } else if (spec.redeemPoints && generatedRedemptions < MAX_GENERATED_REDEMPTIONS) {
      const balance = balanceAt(spec.customer, created);
      const wantedPoints = Math.min(redeemCapPoints(goodsAfterCoupon, REDEEM_RULE), balance, MAX_POINTS_PER_ORDER);
      const points = Math.floor(wantedPoints / REDEEM_RULE.pointsPerAed) * REDEEM_RULE.pointsPerAed;
      const check = checkRedemption({ points, goodsAfterCoupon, balance, rule: REDEEM_RULE });
      if (check.ok) {
        pointsUsed = points;
        generatedRedemptions++;
      }
    }
    const loyaltyDiscount = pointsUsed > 0 ? pointsToAed(pointsUsed, REDEEM_RULE) : 0;

    const goodsBase = Math.max(0, sumMoney([subtotal, -discount, -loyaltyDiscount]));
    const shippingCost = quote
      ? quote.shipping
      : spec.status === "AWAITING_SHIPPING_QUOTE"
        ? 0
        : spec.status === "AWAITING_QUOTE_APPROVAL"
          ? 85
          : freeShippingCoupon || goodsBase >= FREE_SHIPPING_THRESHOLD
            ? 0
            : STANDARD_SHIPPING;
    const total = Math.max(0, sumMoney([subtotal, shippingCost, -discount, -loyaltyDiscount]));
    const taxAmount = roundMoney(goodsBase - goodsBase / (1 + VAT_RATE));
    const earned = computeOrderPoints({
      lines: lines.map((l) => ({
        lineTotal: roundMoney(l.unit * l.qty).toFixed(2),
        quantity: l.qty,
        fixedPoints: productOf(l.sku).loyaltyPointsEarn,
      })),
      discountTotal: sumMoney([discount, loyaltyDiscount]).toFixed(2),
      earnRate: LOYALTY_PROGRAM.earnRate,
    });

    if (coupon && paid) couponUses.set(coupon.code, (couponUses.get(coupon.code) ?? 0) + 1);

    if (pointsUsed > 0) {
      loyaltyEvents.push({ customer: spec.customer, at: created, type: "REDEEMED", delta: -pointsUsed, reason: "Points applied at checkout", orderKey: spec.key });
    }
    if (delivered && earned > 0) {
      loyaltyEvents.push({ customer: spec.customer, at: timeOf("DELIVERED") ?? created, type: "EARNED", delta: earned, reason: "Purchase reward", orderKey: spec.key });
    }
    if ((spec.status === "RETURNED" || spec.status === "REFUNDED") && earned > 0) {
      loyaltyEvents.push({ customer: spec.customer, at: timeOf("RETURNED") ?? created, type: "REVERSED", delta: -earned, reason: "Order returned", orderKey: spec.key });
    }

    if (STOCK_OUT_STATUSES.includes(spec.status)) {
      for (const line of lines) {
        stockMoves.push({ sku: line.sku, delta: -line.qty, type: "SALE", reference: spec.key, at: timeOf("PROCESSING") ?? created });
      }
    }
    if (spec.status === "RETURNED" || spec.status === "REFUNDED") {
      for (const line of lines) {
        stockMoves.push({ sku: line.sku, delta: line.qty, type: "RETURN", reference: spec.key, at: timeOf("RETURNED") ?? created });
      }
    }

    let reward: CouponDef | null = null;
    const deliveredAt = timeOf("DELIVERED");
    if (spec.status === "DELIVERED" && deliveredAt && total >= REWARD_RULE.minOrderTotal && deliveredAt > REWARD_RULE.createdAt) {
      reward = {
        code: newRewardCode(),
        type: "FIXED",
        value: REWARD_RULE.rewardValue,
        minOrderAmount: REWARD_RULE.rewardMinOrderAmount,
        maxDiscountAmount: null,
        usageLimit: 1,
        startsAt: deliveredAt,
        endsAt: new Date(deliveredAt.getTime() + REWARD_RULE.validityDays * DAY_MS),
        isActive: true,
        createdAt: deliveredAt,
        customer: spec.customer,
        sourceOrderKey: spec.key,
      };
      rewardByOrder.set(spec.key, reward);
    }

    plans.push({
      spec,
      created,
      lines,
      subtotal,
      discount,
      redemptionDiscount: coupon && resolution ? resolution.discountAmount : 0,
      coupon,
      pointsUsed,
      loyaltyDiscount,
      shippingCost,
      total,
      taxAmount,
      earned,
      events,
      reward,
    });
  }

  loyaltyEvents.sort((a, b) => a.at.getTime() - b.at.getTime());
  const lastAt = new Map<number, number>();
  const running = new Map<number, number>();
  for (const event of loyaltyEvents) {
    let time = event.at.getTime();
    const previous = lastAt.get(event.customer);
    if (previous !== undefined && time <= previous) time = previous + 1000;
    event.at = new Date(time);
    lastAt.set(event.customer, time);
    const balance = (running.get(event.customer) ?? 0) + event.delta;
    if (balance < 0) throw new Error(`Seed loyalty balance for customer ${event.customer} would go negative.`);
    running.set(event.customer, balance);
    event.balanceAfter = balance;
  }

  return { plans, loyaltyEvents, stockMoves, couponUses };
}

function buildStockChain(moves: StockMove[], finalStock: (sku: string) => number): StockRow[] {
  const bySku = new Map<string, StockMove[]>();
  for (const move of moves) {
    const list = bySku.get(move.sku) ?? [];
    list.push(move);
    bySku.set(move.sku, list);
  }

  const rows: StockRow[] = [];
  for (const [sku, list] of bySku) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    const times: number[] = [];
    list.forEach((move, index) => {
      const time = move.at.getTime();
      times.push(index > 0 && time <= times[index - 1] ? times[index - 1] + 1000 : time);
    });

    let outflow = 0;
    let peak = 0;
    for (const move of list) {
      outflow -= move.delta;
      peak = Math.max(peak, outflow);
    }
    const final = finalStock(sku);

    let balance = 0;
    const push = (delta: number, type: StockRow["type"], reason: string, reference: string | null, time: number) => {
      rows.push({ sku, delta, before: balance, after: balance + delta, type, reason, reference, at: new Date(time) });
      balance += delta;
    };
    if (final + peak > 0) push(final + peak, "PURCHASE", "stock_received", null, times[0] - 6 * HOUR_MS);
    list.forEach((move, index) => {
      push(move.delta, move.type, move.type === "SALE" ? "order_fulfilled" : "order_returned", move.reference, times[index]);
    });
    if (balance !== final) {
      push(final - balance, "MANUAL_ADJUSTMENT", "stock_count_correction", null, times[times.length - 1] + 1000);
    }
  }
  return rows;
}


export async function seedDemoData(db: PrismaClient) {
  logSection(`${BRAND.name} — Demo data`);

  const marker = await db.customer.findUnique({
    where: { email: `${CUSTOMERS[0].key}@${BRAND.emailDomain}` },
    select: { id: true },
  });
  if (marker) {
    console.log("   Demo data already present, skipping. Reset the database to regenerate it.");
    return;
  }

  const staffRows = await db.staff.findMany({
    where: {
      email: {
        in: [STAFF_EMAILS.sales, STAFF_EMAILS.fulfilment, STAFF_EMAILS.support, STAFF_EMAILS.superAdmin],
      },
    },
    select: { id: true, email: true },
  });
  const staffId = (email: string) => {
    const row = staffRows.find((s) => s.email === email);
    if (!row) throw new Error(`Seed staff ${email} not found. Run the staff step first.`);
    return row.id;
  };
  const sales = staffId(STAFF_EMAILS.sales);
  const fulfilment = staffId(STAFF_EMAILS.fulfilment);
  const support = staffId(STAFF_EMAILS.support);
  const superAdmin = staffId(STAFF_EMAILS.superAdmin);
  const eventStaff = (to: Status) =>
    to === "REFUNDED" || to === "PARTIALLY_REFUNDED"
      ? support
      : ["PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(to)
        ? fulfilment
        : sales;

  const [shippingMethod, tracedSkus] = await Promise.all([
    db.shippingMethod.findUnique({ where: { code: "STANDARD_UAE" } }),
    db.product.findMany({
      where: { sku: { in: Object.values(SKU) } },
      select: {
        sku: true,
        nameEn: true,
        nameAr: true,
        price: true,
        requiresIdVerification: true,
        stockQuantity: true,
        loyaltyPointsEarn: true,
        images: { orderBy: { displayOrder: "asc" }, take: 1, select: { storageKey: true } },
      },
    }),
  ]);
  const products = new Map<string, ProductInfo>(
    tracedSkus.map((p) => [
      p.sku,
      {
        sku: p.sku,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        price: Number(p.price),
        requiresId: p.requiresIdVerification,
        stock: p.stockQuantity,
        loyaltyPointsEarn: p.loyaltyPointsEarn,
        image: p.images[0]?.storageKey ?? null,
      },
    ]),
  );
  for (const sku of Object.values(SKU)) {
    if (!products.has(sku)) throw new Error(`Product ${sku} not found. Run the catalog step first.`);
  }
  const productOf = (sku: string) => products.get(sku)!;

  const uploads: [string, string, string][] = [
    ["verification-docs", "seed/sample-id.png", "documents/sample-id.png"],
    ["verification-docs", "seed/sample-address.png", "documents/sample-address.png"],
    ["verification-docs", "seed/sample-photo.png", "documents/sample-photo.png"],
    ["b2b-documents", "seed/sample-trade-licence.png", "documents/sample-trade-licence.png"],
    ["b2b-documents", "seed/sample-vat-certificate.png", "documents/sample-vat-certificate.png"],
    ["b2b-documents", "seed/sample-document.png", "documents/sample-document.png"],
    ["payment-proofs", DEMO_PLACEHOLDER_DOCUMENT.key, "documents/sample-document.png"],
  ];
  let uploaded = 0;
  for (const [bucket, key, file] of uploads) {
    if (await uploadSeedAsset(bucket, key, file)) uploaded++;
  }
  logDone("sample documents uploaded", uploaded);

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerIds: string[] = [];
  const addressSnapshots: Record<string, unknown>[] = [];
  for (const spec of CUSTOMERS) {
    const email = `${spec.key}@${BRAND.emailDomain}`;
    const joined = daysAgo(spec.joinedDaysAgo);
    const approved = spec.verification === "APPROVED";
    const customer = await db.customer.create({
      data: {
        email,
        name: spec.name,
        phone: spec.phone,
        passwordHash: null,
        role: spec.b2b ? "B2B" : "B2C",
        isActive: true,
        locale: spec.locale,
        emailVerifiedAt: joined,
        verificationStatus: spec.verification,
        verifiedAt: approved ? new Date(joined.getTime() + 2 * DAY_MS) : null,
        verificationExpiresAt: approved ? new Date(joined.getTime() + 2 * 365 * DAY_MS) : null,
        createdAt: joined,
      },
      select: { id: true },
    });
    customerIds.push(customer.id);
    const snapshot = {
      fullName: spec.name,
      phone: spec.phone,
      addressLine1: spec.street,
      city: "Dubai",
      emirate: "Dubai",
      country: "AE",
    };
    addressSnapshots.push(snapshot);
    await db.customerAddress.create({
      data: { customerId: customer.id, label: "Home", isDefault: true, ...snapshot },
    });
  }
  logDone("background customers", customerIds.length);

  // ── Verification events ───────────────────────────────────────────────────
  const verificationPlans: {
    customer: number;
    status: "APPROVED" | "PENDING" | "REJECTED";
    days: number;
    idNumber: string;
    reason?: string;
  }[] = [
    { customer: 0, status: "APPROVED", days: 58, idNumber: "784-0000-0000001-1" },
    { customer: 1, status: "APPROVED", days: 57, idNumber: "784-0000-0000002-2" },
    { customer: 5, status: "APPROVED", days: 56, idNumber: "784-0000-0000003-3" },
    { customer: 2, status: "PENDING", days: 1.5, idNumber: "784-0000-0000004-4" },
    { customer: 3, status: "REJECTED", days: 14, idNumber: "784-0000-0000005-5", reason: "The identity document is unreadable. Upload a clear photo of the full card." },
    ...CUSTOMERS.flatMap((spec, index) =>
      index >= 8 && spec.verification === "APPROVED"
        ? [{ customer: index, status: "APPROVED" as const, days: spec.joinedDaysAgo - 1, idNumber: `784-0000-${String(index).padStart(7, "0")}-${index % 10}` }]
        : [],
    ),
  ];
  const verificationDocs = [
    { role: "IDENTITY", type: "EMIRATES_ID", file: "sample-id.png" },
    { role: "PROOF_OF_ADDRESS", type: "UTILITY_BILL", file: "sample-address.png" },
    { role: "PHOTO", type: "SELFIE", file: "sample-photo.png" },
  ] as const;
  const auditRows: {
    actorType: "STAFF" | "SYSTEM" | "CUSTOMER";
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: object | null;
    after?: object | null;
    metadata?: object;
    createdAt: Date;
  }[] = [];

  for (const plan of verificationPlans) {
    const created = daysAgo(plan.days);
    const reviewed = plan.status !== "PENDING";
    const reviewedAt = reviewed ? new Date(created.getTime() + 6 * HOUR_MS) : null;
    const event = await db.verificationEvent.create({
      data: {
        customerId: customerIds[plan.customer],
        provider: "MANUAL_REVIEW",
        status: plan.status,
        reviewResult: plan.status === "APPROVED" ? "Documents match the declared details." : null,
        rejectionReason: plan.reason ?? null,
        declaredIdNumber: plan.idNumber,
        declaredAddress: CUSTOMERS[plan.customer].street + ", Dubai",
        acknowledgmentText: "I confirm the documents are genuine and the details are correct.",
        acknowledgedAt: created,
        reviewedById: reviewed ? sales : null,
        reviewedAt,
        createdAt: created,
      },
      select: { id: true },
    });
    for (const doc of verificationDocs) {
      await db.verificationDocument.create({
        data: {
          verificationEventId: event.id,
          role: doc.role,
          type: doc.type,
          filename: doc.file,
          storageKey: `seed/${doc.file}`,
          mimeType: "image/png",
          sizeBytes: 30000,
          createdAt: created,
        },
      });
    }
    if (reviewed && reviewedAt) {
      auditRows.push({
        actorType: "STAFF",
        actorId: sales,
        action: plan.status === "APPROVED" ? "verification.approve" : "verification.reject",
        entityType: "VerificationEvent",
        entityId: event.id,
        before: { status: "PENDING" },
        after: { status: plan.status },
        metadata: { customerId: customerIds[plan.customer] },
        createdAt: reviewedAt,
      });
    }
  }
  logDone("verification events", verificationPlans.length);

  // ── B2B accounts ──────────────────────────────────────────────────────────
  const approvedAccount = await db.b2BAccount.create({
    data: {
      customerId: customerIds[6],
      companyNameEn: "Northgate Outfitters LLC",
      companyNameAr: "شركة نورثجيت للتجهيزات ذ.م.م",
      contactName: CUSTOMERS[6].name,
      contactPhone: CUSTOMERS[6].phone,
      tradeLicenseNo: "DEMO-LICENCE-1001",
      vatNumber: "100000000000003",
      status: "APPROVED",
      reviewedById: sales,
      reviewedAt: daysAgo(54),
      verifiedAt: daysAgo(54),
      expiresAt: new Date(NOW + 300 * DAY_MS),
      creditLimitAed: 50000,
      createdAt: daysAgo(56),
    },
    select: { id: true },
  });
  const pendingAccount = await db.b2BAccount.create({
    data: {
      customerId: customerIds[7],
      companyNameEn: "Summit Ridge Trading LLC",
      companyNameAr: "شركة سَميت ريدج للتجارة ذ.م.م",
      contactName: CUSTOMERS[7].name,
      contactPhone: CUSTOMERS[7].phone,
      tradeLicenseNo: "DEMO-LICENCE-1002",
      vatNumber: null,
      status: "PENDING",
      createdAt: daysAgo(6),
    },
    select: { id: true },
  });
  const b2bDocs = [
    { account: approvedAccount.id, type: "TRADE_LICENSE", file: "sample-trade-licence.png", declared: "DEMO-LICENCE-1001", at: 56 },
    { account: approvedAccount.id, type: "VAT_CERTIFICATE", file: "sample-vat-certificate.png", declared: "100000000000003", at: 56 },
    { account: pendingAccount.id, type: "TRADE_LICENSE", file: "sample-trade-licence.png", declared: "DEMO-LICENCE-1002", at: 6 },
  ] as const;
  for (const doc of b2bDocs) {
    await db.b2BDocument.create({
      data: {
        b2bAccountId: doc.account,
        type: doc.type,
        filename: doc.file,
        storageKey: `seed/${doc.file}`,
        mimeType: "image/png",
        declaredNumber: doc.declared,
        uploadedAt: daysAgo(doc.at),
      },
    });
  }
  auditRows.push({
    actorType: "STAFF",
    actorId: sales,
    action: "b2b.approve",
    entityType: "B2BAccount",
    entityId: approvedAccount.id,
    before: { status: "PENDING" },
    after: { status: "APPROVED" },
    metadata: { customerId: customerIds[6] },
    createdAt: daysAgo(54),
  });
  logDone("B2B accounts", 2);


  // ── Coupons ───────────────────────────────────────────────────────────────
  const couponIds = new Map<string, string>();
  for (const coupon of COUPONS) {
    const row = await db.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        usageLimit: coupon.usageLimit,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
        isActive: coupon.isActive,
        createdAt: coupon.createdAt,
      },
      select: { id: true },
    });
    couponIds.set(coupon.code, row.id);
  }
  const rewardRule = await db.couponRewardRule.create({
    data: {
      name: REWARD_RULE.name,
      minOrderTotal: REWARD_RULE.minOrderTotal,
      rewardType: "FIXED",
      rewardValue: REWARD_RULE.rewardValue,
      rewardMaxDiscountAmount: null,
      rewardMinOrderAmount: REWARD_RULE.rewardMinOrderAmount,
      validityDays: REWARD_RULE.validityDays,
      codePrefix: REWARD_RULE.codePrefix,
      isActive: true,
      createdAt: REWARD_RULE.createdAt,
    },
    select: { id: true },
  });
  for (const coupon of COUPONS) {
    auditRows.push({
      actorType: "STAFF",
      actorId: superAdmin,
      action: "coupon.create",
      entityType: "Coupon",
      entityId: couponIds.get(coupon.code)!,
      before: null,
      after: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        usageLimit: coupon.usageLimit,
        startsAt: coupon.startsAt?.toISOString() ?? null,
        endsAt: coupon.endsAt?.toISOString() ?? null,
        allowedRole: null,
        isActive: coupon.isActive,
      },
      createdAt: coupon.createdAt,
    });
  }
  auditRows.push({
    actorType: "STAFF",
    actorId: superAdmin,
    action: "reward_rule.create",
    entityType: "CouponRewardRule",
    entityId: rewardRule.id,
    before: null,
    after: {
      name: REWARD_RULE.name,
      minOrderTotal: REWARD_RULE.minOrderTotal,
      rewardType: "FIXED",
      rewardValue: REWARD_RULE.rewardValue,
      rewardMaxDiscountAmount: null,
      rewardMinOrderAmount: REWARD_RULE.rewardMinOrderAmount,
      validityDays: REWARD_RULE.validityDays,
      codePrefix: REWARD_RULE.codePrefix,
      isActive: true,
    },
    createdAt: REWARD_RULE.createdAt,
  });
  logDone("coupons", COUPONS.length);

  // ── Quotes ────────────────────────────────────────────────────────────────
  interface QuoteDraft {
    key: string;
    status: "NEW" | "QUOTED" | "ACCEPTED";
    days: number;
    lines: [string, number][];
    discount: number;
  }
  const quoteDrafts: QuoteDraft[] = [
    { key: "q1", status: "NEW", days: 3, lines: [[SKU.rifleA, 5], [SKU.rifleB, 3]], discount: 0 },
    { key: "q2", status: "QUOTED", days: 9, lines: [[SKU.pelletsA, 40], [SKU.pelletsC, 20]], discount: 0.1 },
    { key: "q3", status: "ACCEPTED", days: 14, lines: [[SKU.rifleC, 4], [SKU.pelletsB, 25]], discount: 0.08 },
  ];

  // ── Number allocation ─────────────────────────────────────────────────────
  const counters = { order: new Map<number, number>(), quote: new Map<number, number>(), ticket: new Map<number, number>() };
  const allocate = (kind: "order" | "quote" | "ticket", when: Date) => {
    const year = when.getUTCFullYear();
    const next = (counters[kind].get(year) ?? 0) + 1;
    counters[kind].set(year, next);
    return `${year}-${String(next).padStart(6, "0")}`;
  };
  const prefixed = {
    order: (when: Date) => `${BRAND.orderPrefix}-${allocate("order", when)}`,
    quote: (when: Date) => `${BRAND.quotePrefix}-${allocate("quote", when)}`,
    ticket: (when: Date) => `TKT-${allocate("ticket", when)}`,
  };

  const quoteRecords = new Map<string, { id: string; total: number; shipping: number; items: { sku: string; qty: number; unit: number }[] }>();
  for (const draft of [...quoteDrafts].sort((a, b) => b.days - a.days)) {
    const created = daysAgo(draft.days);
    const priced = draft.status !== "NEW";
    const items = draft.lines.map(([sku, qty]) => {
      const unit = r2(productOf(sku).price * (1 - draft.discount));
      return { sku, qty, unit };
    });
    const itemsTotal = r2(items.reduce((sum, i) => sum + i.unit * i.qty, 0));
    const shipping = priced ? 120 : 0;
    const total = priced ? r2(itemsTotal + shipping) : 0;
    const quote = await db.quoteRequest.create({
      data: {
        quoteNumber: prefixed.quote(created),
        customerId: customerIds[6],
        b2bAccountId: approvedAccount.id,
        snapshotLegalNameEn: "Northgate Outfitters LLC",
        snapshotLegalNameAr: "شركة نورثجيت للتجهيزات ذ.م.م",
        snapshotTradeLicenseNo: "DEMO-LICENCE-1001",
        snapshotVatNumber: "100000000000003",
        status: draft.status,
        customerNote: "Please quote for delivery to our warehouse in Dubai.",
        internalNote: draft.status === "NEW" ? null : "Account in good standing.",
        quotedTotal: priced ? total : null,
        quotedAt: priced ? new Date(created.getTime() + DAY_MS) : null,
        quotedByStaffId: priced ? sales : null,
        shippingCost: priced ? shipping : null,
        shippingMethodLabel: priced ? "Standard UAE Delivery" : null,
        shippingAddressSnapshot: addressSnapshots[6] as object,
        salesEmailTo: `sales@${BRAND.emailDomain}`,
        createdAt: created,
      },
      select: { id: true },
    });
    for (const item of items) {
      const product = productOf(item.sku);
      await db.quoteItem.create({
        data: {
          quoteRequestId: quote.id,
          productSku: item.sku,
          productNameEn: product.nameEn,
          productNameAr: product.nameAr,
          quantity: item.qty,
          requestedQuantity: item.qty,
          quotedUnitPrice: priced ? item.unit : null,
          quotedLineTotal: priced ? r2(item.unit * item.qty) : null,
          adminNote: priced && draft.discount > 0 ? `${Math.round(draft.discount * 100)}% trade discount applied` : null,
        },
      });
    }
    const quoteEvents: { from: string | null; to: string; hours: number; actor: Actor; note: string }[] = [
      { from: null, to: "NEW", hours: 0, actor: "CUSTOMER", note: "Quote submitted" },
    ];
    if (priced) {
      quoteEvents.push({ from: "NEW", to: "CONTACTED", hours: 4, actor: "STAFF", note: "Confirmed quantities by phone" });
      quoteEvents.push({ from: "CONTACTED", to: "QUOTED", hours: 24, actor: "STAFF", note: "Quote sent" });
    }
    if (draft.status === "ACCEPTED") {
      quoteEvents.push({ from: "QUOTED", to: "ACCEPTED", hours: 72, actor: "CUSTOMER", note: "Quote accepted" });
    }
    for (const event of quoteEvents) {
      await db.quoteEvent.create({
        data: {
          quoteRequestId: quote.id,
          actor: event.actor,
          staffId: event.actor === "STAFF" ? sales : null,
          fromStatus: event.from as never,
          toStatus: event.to as never,
          note: event.note,
          createdAt: new Date(Math.min(NOW - 60_000, created.getTime() + event.hours * HOUR_MS)),
        },
      });
    }
    quoteRecords.set(draft.key, { id: quote.id, total, shipping, items });
  }
  logDone("quotes", quoteDrafts.length);

  // ── Orders ────────────────────────────────────────────────────────────────
  const quotePlans = new Map<string, QuotePlan>(
    [...quoteRecords].map(([key, record]) => [key, { shipping: record.shipping, items: record.items }] as const),
  );
  const demo = planOrders([...ORDERS, ...buildGeneratedOrders(productOf)], productOf, quotePlans);

  const orderIds = new Map<string, string>();
  const orderNumbers = new Map<string, string>();
  const emailRows: Prisma.EmailLogCreateManyInput[] = [];
  let serialCounter = 1000;
  let paymentsRecorded = 0;
  let refundsRecorded = 0;

  for (const plan of demo.plans) {
    const { spec, created, lines, subtotal, discount, coupon, pointsUsed, loyaltyDiscount, shippingCost, total, taxAmount, earned } = plan;
    const customerId = customerIds[spec.customer];
    const customer = CUSTOMERS[spec.customer];
    const quote = spec.quote ? quoteRecords.get(spec.quote) : undefined;

    const paid = PAID_STATUSES.includes(spec.status);
    const manual = spec.status === "AWAITING_MANUAL_PAYMENT";
    const shipped = SHIPPED_STATUSES.includes(spec.status);
    const delivered = ["DELIVERED", "RETURNED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(spec.status);
    const needsShippingQuote =
      spec.status === "AWAITING_SHIPPING_QUOTE" || spec.status === "AWAITING_QUOTE_APPROVAL";

    const events = plan.events;
    const timeOf = (status: Status) => events.find((e) => e.to === status)?.at ?? null;

    const restrictedSkus = lines.filter((l) => productOf(l.sku).requiresId).map((l) => l.sku);
    const complianceSnapshot = await getComplianceSnapshot(customerId, restrictedSkus);

    const refundAmount =
      spec.status === "REFUNDED"
        ? total
        : spec.status === "PARTIALLY_REFUNDED"
          ? r2(lines[spec.refundLine ?? 0].unit * lines[spec.refundLine ?? 0].qty)
          : 0;
    const refundDue = spec.status === "RETURNED" ? total : 0;

    const order = await db.order.create({
      data: {
        orderNumber: prefixed.order(created),
        customerId,
        status: spec.status,
        subtotal,
        addonTotal: 0,
        shippingCost,
        discountAmount: discount,
        taxAmount,
        total,
        loyaltyPointsEarned: paid || delivered ? earned : 0,
        loyaltyPointsUsed: pointsUsed,
        loyaltyDiscountAmount: loyaltyDiscount,
        refundDue,
        couponCode: coupon?.code ?? null,
        paymentProvider: manual ? "MANUAL" : "NGENIUS",
        nGeniusOrderRef: manual ? null : `NG-DEMO-${hashInt(spec.key) % 100000}`,
        nGeniusPayRef: paid ? `NG-PAY-${hashInt(spec.key) % 100000}` : null,
        paidAt: paid ? timeOf("PAID") : null,
        shippingAddressSnapshot: addressSnapshots[spec.customer] as object,
        complianceSnapshot: complianceSnapshot as unknown as object,
        shippedAt: shipped ? timeOf("SHIPPED") : null,
        shippingQuotedAt: spec.status === "AWAITING_QUOTE_APPROVAL" ? timeOf("AWAITING_QUOTE_APPROVAL") : null,
        shippingQuotedBy: spec.status === "AWAITING_QUOTE_APPROVAL" ? sales : null,
        deliveredAt: delivered ? timeOf("DELIVERED") : null,
        carrier: shipped ? "Aramex" : null,
        parcelCount: shipped ? 1 : null,
        trackingNumber: shipped ? `DEMO-TRK-${100000 + (hashInt(spec.key) % 900000)}` : null,
        trackingUrl: shipped ? "https://example.com/track" : null,
        deliveryReceivedBy: delivered ? customer.name : null,
        deliveryIdChecked: delivered ? restrictedSkus.length > 0 : null,
        deliveryNote: delivered ? "Handed over at the door." : null,
        estimatedDelivery: shipped ? new Date(created.getTime() + 4 * DAY_MS) : null,
        shippingMethodId: needsShippingQuote ? null : (shippingMethod?.id ?? null),
        shippingMethodSnapshot: needsShippingQuote || !shippingMethod
          ? undefined
          : { id: shippingMethod.id, code: shippingMethod.code, nameEn: shippingMethod.nameEn, nameAr: shippingMethod.nameAr, nameRu: shippingMethod.nameRu, priceAed: shippingCost, estimatedDaysMin: 3, estimatedDaysMax: 5 },
        customerNote: null,
        internalNote: spec.status === "RETURNED" ? "Customer returned the item unopened." : null,
        createdAt: created,
      },
      select: { id: true, orderNumber: true },
    });
    orderIds.set(spec.key, order.id);
    orderNumbers.set(spec.key, order.orderNumber);

    if (quote) {
      await db.quoteRequest.update({ where: { id: quote.id }, data: { convertedOrderId: order.id } });
    }

    const itemIds: { id: string; sku: string; qty: number }[] = [];
    for (const line of lines) {
      const product = productOf(line.sku);
      const item = await db.orderItem.create({
        data: {
          orderId: order.id,
          itemType: "PRODUCT",
          productSku: line.sku,
          itemNameEn: product.nameEn,
          itemNameAr: product.nameAr,
          itemImageSnapshot: product.image,
          unitPrice: line.unit,
          quantity: line.qty,
          lineTotal: r2(line.unit * line.qty),
          createdAt: created,
        },
        select: { id: true },
      });
      itemIds.push({ id: item.id, sku: line.sku, qty: line.qty });
    }

    if (shipped) {
      const serialChanges: { sku: string; unitIndex: number; before: null; after: { value: string; noSerial: boolean } }[] = [];
      for (const item of itemIds) {
        if (!productOf(item.sku).requiresId) continue;
        for (let unit = 0; unit < item.qty; unit++) {
          const value = `${item.sku.split("-")[0]}${String(serialCounter++).padStart(7, "0")}`;
          await db.orderItemSerial.create({
            data: {
              orderItemId: item.id,
              unitIndex: unit + 1,
              value,
              recordedById: fulfilment,
              createdAt: timeOf("READY_TO_SHIP") ?? created,
            },
          });
          serialChanges.push({ sku: item.sku, unitIndex: unit + 1, before: null, after: { value, noSerial: false } });
        }
      }
      if (serialChanges.length > 0) {
        auditRows.push({
          actorType: "STAFF",
          actorId: fulfilment,
          action: "order.serials_recorded",
          entityType: "Order",
          entityId: order.id,
          metadata: { changes: serialChanges, correctionReason: null },
          createdAt: timeOf("READY_TO_SHIP") ?? created,
        });
      }
    }

    for (const event of events) {
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          actor: event.actor,
          staffId: event.actor === "STAFF" ? eventStaff(event.to) : null,
          fromStatus: event.from,
          toStatus: event.to,
          note: event.note,
          trackingNumber: event.to === "SHIPPED" ? `DEMO-TRK-${100000 + (hashInt(spec.key) % 900000)}` : null,
          createdAt: event.at,
        },
      });
    }

    const trackingNumber = `DEMO-TRK-${100000 + (hashInt(spec.key) % 900000)}`;
    for (const event of events) {
      if (event.actor === "STAFF") {
        const base = {
          actorType: "STAFF" as const,
          actorId: eventStaff(event.to),
          entityType: "Order",
          entityId: order.id,
          createdAt: event.at,
        };
        if (event.to === "AWAITING_QUOTE_APPROVAL") {
          auditRows.push({
            ...base,
            action: "order.shipping_quote",
            before: { status: "AWAITING_SHIPPING_QUOTE", shippingCost: 0, taxAmount, total: r2(total - shippingCost) },
            after: { status: "AWAITING_QUOTE_APPROVAL", shippingCost, taxAmount, total },
          });
        } else if (event.to === "REFUNDED" || event.to === "PARTIALLY_REFUNDED") {
          auditRows.push({
            ...base,
            action: "order.refund_recorded",
            metadata: {
              method: "ORIGINAL_PAYMENT",
              methodOtherLabel: null,
              externalReference: `RF-DEMO-${hashInt(spec.key) % 100000}`,
              amount: refundAmount,
              refundedAt: dubaiDay(event.at),
              owedAfter: 0,
              storageKey: DEMO_PLACEHOLDER_DOCUMENT.key,
            },
          });
        } else if (event.to === "DELIVERED") {
          auditRows.push({
            ...base,
            action: "order.status_changed",
            metadata: {
              fromStatus: "SHIPPED",
              toStatus: "DELIVERED",
              path: ["DELIVERED"],
              note: null,
              trackingNumber: null,
              trackingUrl: null,
              receivedBy: customer.name,
              idChecked: restrictedSkus.length > 0,
              deliveredOn: dubaiDay(event.at),
              proof: null,
            },
          });
        } else {
          const shipping = event.to === "SHIPPED";
          const summary =
            event.to === "CANCELLED"
              ? { refundDue: 0, pointsReturned: 0, pointsReversed: 0, couponReleased: false, rewardCouponsDeactivated: 0, gatewayStatus: null }
              : event.to === "RETURNED"
                ? { restock: true, refundDue: total, refundShortReason: null, pointsReturned: 0, pointsReversed: earned, rewardCouponsDeactivated: 0 }
                : {};
          auditRows.push({
            ...base,
            action: "order.status_changed",
            metadata: {
              fromStatus: event.from,
              toStatus: event.to,
              path: [event.to],
              note: event.note,
              trackingNumber: shipping ? trackingNumber : null,
              trackingUrl: shipping ? "https://example.com/track" : null,
              ...(shipping
                ? {
                    carrier: "Aramex",
                    parcelCount: 1,
                    shippedOn: dubaiDay(event.at),
                    estimatedDelivery: dubaiDay(new Date(created.getTime() + 4 * DAY_MS)),
                    shipmentNote: null,
                  }
                : {}),
              ...summary,
            },
          });
        }
      }

      const emailKey = EMAIL_FOR_STATUS[event.to];
      if (emailKey) {
        const sentAt = new Date(event.at.getTime() + 60_000);
        emailRows.push({
          templateKey: emailKey,
          toEmail: `${customer.key}@${BRAND.emailDomain}`,
          subject: renderEmailSubject(EMAIL_DEFAULTS[emailKey].subject, { orderNumber: order.orderNumber }),
          locale: customer.locale,
          orderId: order.id,
          status: "SENT",
          sentAt,
          createdAt: sentAt,
        });
      }
    }

    if (!manual && spec.status !== "PENDING" && !needsShippingQuote) {
      const state =
        spec.status === "PAYMENT_PENDING" ? "PENDING" : spec.status === "PAYMENT_FAILED" ? "FAILED" : spec.status === "CANCELLED" ? "CANCELLED" : "CAPTURED";
      await db.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: "NGENIUS",
          providerOrderId: `NG-DEMO-${hashInt(spec.key) % 100000}`,
          providerPaymentId: paid ? `NG-PAY-${hashInt(spec.key) % 100000}` : null,
          status: state,
          amount: total,
          failureCode: state === "FAILED" ? "DECLINED" : null,
          failureMessage: state === "FAILED" ? "Card declined by the issuer" : null,
          rawResponse: { demo: true, status: state },
          createdAt: created,
        },
      });
    }

    if (refundAmount > 0) {
      await db.orderRefund.create({
        data: {
          orderId: order.id,
          method: "ORIGINAL_PAYMENT",
          externalReference: `RF-DEMO-${hashInt(spec.key) % 100000}`,
          amount: refundAmount,
          refundedAt: timeOf(spec.status === "REFUNDED" ? "REFUNDED" : "PARTIALLY_REFUNDED") ?? created,
          recordedById: support,
          notes: spec.status === "REFUNDED" ? "Full refund after return." : "Refund for one returned line.",
          filename: DEMO_PLACEHOLDER_DOCUMENT.filename,
          storageKey: DEMO_PLACEHOLDER_DOCUMENT.key,
          mimeType: DEMO_PLACEHOLDER_DOCUMENT.mimeType,
          createdAt: timeOf(spec.status === "REFUNDED" ? "REFUNDED" : "PARTIALLY_REFUNDED") ?? created,
        },
      });
      refundsRecorded++;
    }

    if (coupon && paid) {
      await db.couponRedemption.create({
        data: {
          couponId: couponIds.get(coupon.code)!,
          customerId,
          orderId: order.id,
          discountAmount: plan.redemptionDiscount,
          createdAt: created,
        },
      });
    }

    if (plan.reward) {
      const reward = plan.reward;
      const issued = await db.coupon.create({
        data: {
          code: reward.code,
          type: reward.type,
          value: reward.value,
          minOrderAmount: reward.minOrderAmount,
          maxDiscountAmount: null,
          usageLimit: reward.usageLimit,
          startsAt: reward.startsAt,
          endsAt: reward.endsAt,
          isActive: true,
          allowedRole: null,
          customerId,
          sourceRuleId: rewardRule.id,
          sourceOrderId: order.id,
          createdAt: reward.createdAt,
        },
        select: { id: true },
      });
      couponIds.set(reward.code, issued.id);
      auditRows.push({
        actorType: "SYSTEM",
        actorId: null,
        action: "coupon.issue",
        entityType: "Coupon",
        entityId: issued.id,
        before: null,
        after: {
          code: `${REWARD_RULE.codePrefix}-*****`,
          customerId,
          sourceRuleId: rewardRule.id,
          sourceRuleName: REWARD_RULE.name,
          sourceOrderId: order.id,
          orderTotal: total,
          rewardType: reward.type,
          rewardValue: reward.value,
          endsAt: reward.endsAt?.toISOString() ?? null,
        },
        createdAt: reward.createdAt,
      });
    }
  }
  logDone("orders", demo.plans.length);

  // Manual payment recorded against the quote-based order is intentionally left outstanding.
  const partialOrderId = orderIds.get("o19");
  if (partialOrderId) {
    const o19 = await db.order.findUnique({ where: { id: partialOrderId }, select: { total: true } });
    const deposit = r2(Number(o19?.total ?? 0) * 0.3);
    await db.orderPayment.create({
      data: {
        orderId: partialOrderId,
        method: "BANK_TRANSFER",
        externalReference: "BT-DEMO-0001",
        amount: deposit,
        paidAt: daysAgo(4),
        recordedById: sales,
        notes: "30% deposit received.",
        filename: DEMO_PLACEHOLDER_DOCUMENT.filename,
        storageKey: DEMO_PLACEHOLDER_DOCUMENT.key,
        mimeType: DEMO_PLACEHOLDER_DOCUMENT.mimeType,
        createdAt: daysAgo(4),
      },
    });
    paymentsRecorded++;
    const orderTotal = Number(o19?.total ?? 0);
    auditRows.push({
      actorType: "STAFF",
      actorId: sales,
      action: "order.marked_paid",
      entityType: "Order",
      entityId: partialOrderId,
      metadata: {
        method: "BANK_TRANSFER",
        methodOtherLabel: null,
        externalReference: "BT-DEMO-0001",
        amount: deposit,
        paidAt: dubaiDay(daysAgo(4)),
        orderTotal,
        settledAfter: deposit,
        remaining: r2(orderTotal - deposit),
        fullySettled: false,
        storageKey: DEMO_PLACEHOLDER_DOCUMENT.key,
      },
      createdAt: daysAgo(4),
    });
  }

  await db.emailLog.createMany({ data: emailRows });
  logDone("email log rows", emailRows.length);

  // ── Stock ─────────────────────────────────────────────────────────────────
  const stockRows = buildStockChain(demo.stockMoves, (sku) => productOf(sku).stock);
  for (const row of stockRows) {
    await db.stockMovement.create({
      data: {
        productSku: row.sku,
        delta: row.delta,
        quantityBefore: row.before,
        quantityAfter: row.after,
        type: row.type,
        reason: row.reason,
        reference: row.reference ? (orderNumbers.get(row.reference) ?? row.reference) : null,
        staffId: fulfilment,
        createdAt: row.at,
      },
    });
  }

  // ── Coupon counters ───────────────────────────────────────────────────────
  for (const [code, used] of demo.couponUses) {
    await db.coupon.update({ where: { code }, data: { usedCount: used } });
  }

  // ── Loyalty ───────────────────────────────────────────────────────────────
  const balances = new Map<number, number>();
  for (const event of demo.loyaltyEvents) {
    balances.set(event.customer, event.balanceAfter!);
    const orderId = event.orderKey ? orderIds.get(event.orderKey) : undefined;
    await db.loyaltyTransaction.create({
      data: {
        customerId: customerIds[event.customer],
        orderId: orderId ?? null,
        type: event.type,
        delta: event.delta,
        balanceAfter: event.balanceAfter!,
        reason: event.reason,
        reference: event.orderKey ? (orderNumbers.get(event.orderKey) ?? null) : null,
        createdAt: event.at,
      },
    });
  }
  for (const [customer, balance] of balances) {
    await db.customer.update({ where: { id: customerIds[customer] }, data: { loyaltyPoints: balance } });
  }
  logDone("loyalty transactions", demo.loyaltyEvents.length);

  // ── Tickets ───────────────────────────────────────────────────────────────
  interface TicketDraft {
    subject: string;
    description: string;
    category: "ORDER_ISSUE" | "REFUND" | "QUOTE_ISSUE" | "GENERAL";
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    status: "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED";
    days: number;
    customer: number;
    order?: string;
    quote?: string;
    assignee: string;
    comments: { actor: Actor; note: string; hours: number }[];
  }
  const tickets: TicketDraft[] = [
    {
      subject: "Where is my parcel?",
      description: "The tracking page has not updated since yesterday. Can you check the status?",
      category: "ORDER_ISSUE",
      priority: "NORMAL",
      status: "OPEN",
      days: 1,
      customer: 0,
      order: "o05",
      assignee: support,
      comments: [{ actor: "CUSTOMER", note: "Any update on this?", hours: 6 }],
    },
    {
      subject: "Refund for the returned item",
      description: "I returned the pistol last week. When will the refund arrive?",
      category: "REFUND",
      priority: "HIGH",
      status: "IN_PROGRESS",
      days: 4,
      customer: 1,
      order: "o14",
      assignee: sales,
      comments: [
        { actor: "STAFF", note: "We received the item and are preparing the refund.", hours: 5 },
        { actor: "CUSTOMER", note: "Thank you, please keep me posted.", hours: 20 },
      ],
    },
    {
      subject: "Question about the trade quote",
      description: "Can the delivery be split across two dates?",
      category: "QUOTE_ISSUE",
      priority: "NORMAL",
      status: "WAITING_ON_CUSTOMER",
      days: 7,
      customer: 6,
      quote: "q2",
      assignee: sales,
      comments: [{ actor: "STAFF", note: "Yes, please confirm the two dates you prefer.", hours: 3 }],
    },
    {
      subject: "Change of delivery address",
      description: "I moved house and need to update my default address.",
      category: "GENERAL",
      priority: "LOW",
      status: "RESOLVED",
      days: 15,
      customer: 4,
      assignee: support,
      comments: [
        { actor: "STAFF", note: "Your address has been updated for future orders.", hours: 8 },
      ],
    },
  ];
  for (const draft of [...tickets].sort((a, b) => b.days - a.days)) {
    const created = daysAgo(draft.days);
    const resolved = draft.status === "RESOLVED";
    const ticket = await db.ticket.create({
      data: {
        ticketNumber: prefixed.ticket(created),
        subject: draft.subject,
        description: draft.description,
        category: draft.category,
        priority: draft.priority,
        status: draft.status,
        orderId: draft.order ? orderIds.get(draft.order) ?? null : null,
        quoteRequestId: draft.quote ? quoteRecords.get(draft.quote)?.id ?? null : null,
        customerId: customerIds[draft.customer],
        contactEmail: `${CUSTOMERS[draft.customer].key}@${BRAND.emailDomain}`,
        assignedToStaffId: draft.assignee,
        createdByCustomerId: customerIds[draft.customer],
        resolvedAt: resolved ? new Date(created.getTime() + 10 * HOUR_MS) : null,
        createdAt: created,
      },
      select: { id: true },
    });
    await db.ticketEvent.create({
      data: { ticketId: ticket.id, type: "ASSIGNMENT", actor: "STAFF", staffId: draft.assignee, note: "Assigned to the team", createdAt: new Date(created.getTime() + HOUR_MS) },
    });
    for (const comment of draft.comments) {
      await db.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: "COMMENT",
          actor: comment.actor,
          staffId: comment.actor === "STAFF" ? draft.assignee : null,
          note: comment.note,
          createdAt: new Date(Math.min(NOW - 60_000, created.getTime() + comment.hours * HOUR_MS)),
        },
      });
    }
    if (draft.status !== "OPEN") {
      await db.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: "STATUS_CHANGE",
          actor: "STAFF",
          staffId: draft.assignee,
          fromStatus: "OPEN",
          toStatus: draft.status,
          createdAt: new Date(created.getTime() + 2 * HOUR_MS),
        },
      });
    }
  }
  logDone("tickets", tickets.length);

  // ── Reviews ───────────────────────────────────────────────────────────────
  const reviews: { sku: string; customer: number; rating: number; title: string; body: string; status: "APPROVED" | "PENDING" | "REJECTED"; days: number }[] = [
    { sku: SKU.rifleA, customer: 0, rating: 5, title: "Great first rifle", body: "Smooth to cock and very accurate out of the box.", status: "APPROVED", days: 48 },
    { sku: SKU.pistolA, customer: 5, rating: 4, title: "Solid and realistic", body: "Good weight and a crisp trigger. The magazine is a little fiddly.", status: "APPROVED", days: 42 },
    { sku: SKU.rifleB, customer: 1, rating: 5, title: "Quiet and consistent", body: "Holds a tight group at 30 metres.", status: "APPROVED", days: 34 },
    { sku: SKU.pelletsB, customer: 4, rating: 3, title: "Does the job", body: "Fine for pest control, though a few were deformed in the tin.", status: "PENDING", days: 5 },
    { sku: SKU.knife, customer: 4, rating: 1, title: "Not what I expected", body: "This comment is off topic and was rejected by moderation.", status: "REJECTED", days: 20 },
  ];
  for (const review of reviews) {
    await db.productReview.create({
      data: {
        productSku: review.sku,
        customerId: customerIds[review.customer],
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: review.status,
        isVerifiedPurchase: true,
        createdAt: daysAgo(review.days),
      },
    });
  }

  // ── Draft and archived products ───────────────────────────────────────────
  const unpublished: { sku: string; status: "DRAFT" | "ARCHIVED"; days: number }[] = [
    { sku: "HLV-SKY-45", status: "DRAFT", days: 18 },
    { sku: "KNF-SHRPN-DMD", status: "DRAFT", days: 6 },
    { sku: "TRV-MCR-45", status: "ARCHIVED", days: 12 },
    { sku: "OPT-NIGHTVSN-400", status: "ARCHIVED", days: 4 },
  ];
  const unpublishedRows = await db.product.findMany({
    where: { sku: { in: unpublished.map((item) => item.sku) }, deletedAt: null },
    select: { id: true, sku: true, publishStatus: true },
  });
  if (unpublishedRows.length !== unpublished.length) {
    throw new Error("Seed products to unpublish were not found. Run the catalog step first.");
  }
  for (const item of unpublished) {
    const row = unpublishedRows.find((r) => r.sku === item.sku)!;
    await db.product.update({ where: { id: row.id }, data: { publishStatus: item.status } });
    auditRows.push({
      actorType: "STAFF",
      actorId: sales,
      action: "product.status",
      entityType: "Product",
      entityId: row.id,
      before: { publishStatus: row.publishStatus },
      after: { publishStatus: item.status },
      metadata: { sku: item.sku },
      createdAt: daysAgo(item.days),
    });
  }
  logDone("unpublished products", unpublished.length);

  // ── Newsletter ────────────────────────────────────────────────────────────
  const subscribers = [
    "sami.farouk", "reem.aziz", "tariq.nabil", "dana.hussein", "ivan.sokolov", "nadia.karam", "bilal.ahmed",
    "elena.markova", "jad.salem", "farah.yasin", "lina.odeh", "ziad.hamdan", "mona.shaheen", "adam.rowe",
  ];
  for (const [index, handle] of subscribers.entries()) {
    const consentAt = daysAgo(2 + index * 4);
    await db.newsletterSubscriber.create({
      data: {
        email: `${handle}@${BRAND.emailDomain}`,
        locale: (["en", "ar", "ru"] as const)[index % 3],
        source: index % 3 === 0 ? "POPUP" : "HOME",
        consentAt,
        unsubscribedAt: index === 5 || index === 11 ? new Date(consentAt.getTime() + 6 * DAY_MS) : null,
        klaviyoSyncedAt: index % 4 === 0 ? null : new Date(consentAt.getTime() + HOUR_MS),
        createdAt: consentAt,
      },
    });
  }
  logDone("newsletter subscribers", subscribers.length);

  // ── Import batch ──────────────────────────────────────────────────────────
  const batch = await db.importBatch.create({
    data: {
      filename: "catalog-update-sample.xlsx",
      uploadedById: sales,
      status: "COMPLETED_WITH_ERRORS",
      totalRows: 42,
      successRows: 39,
      failedRows: 3,
      createdCount: 12,
      updatedCount: 24,
      unchangedCount: 3,
      createdAt: daysAgo(10),
      completedAt: new Date(daysAgo(10).getTime() + 2 * 60_000),
    },
    select: { id: true },
  });
  const importErrors = [
    { rowNumber: 8, sheet: "Products", columnKey: "price", sku: "DEMO-SKU-008", message: "Price must be above 0.", found: "0", fix: "Enter the selling price in AED." },
    { rowNumber: 17, sheet: "Products", columnKey: "category_slug", sku: "DEMO-SKU-017", message: "Category does not exist.", found: "air-gun-parts", fix: "Use a category slug from the Categories sheet." },
    { rowNumber: 29, sheet: "Images", columnKey: "filename", sku: "DEMO-SKU-029", message: "Image file was not selected with the workbook.", found: "DEMO-SKU-029.jpg", fix: "Select the image together with the workbook." },
  ];
  for (const error of importErrors) {
    await db.importBatchError.create({ data: { importBatchId: batch.id, ...error } });
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  for (const row of auditRows) {
    await db.auditLog.create({
      data: {
        actorType: row.actorType,
        actorId: row.actorId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        ...(row.before === undefined ? {} : { before: row.before ?? Prisma.JsonNull }),
        ...(row.after === undefined ? {} : { after: row.after ?? Prisma.JsonNull }),
        ...(row.metadata ? { metadata: row.metadata } : {}),
        createdAt: row.createdAt,
      },
    });
  }

  // ── Number sequences ──────────────────────────────────────────────────────
  const sequences: [string, Map<number, number>][] = [
    ["order_sequence", counters.order],
    ["quote_sequence", counters.quote],
    ["ticket_sequence", counters.ticket],
  ];
  for (const [prefix, byYear] of sequences) {
    for (const [year, used] of byYear) {
      const key = `${prefix}_${year}`;
      const existing = await db.projectConfig.findUnique({ where: { key } });
      const current = (existing?.value as { next?: number } | null)?.next ?? 1;
      const next = Math.max(current, used + 1);
      await db.projectConfig.upsert({
        where: { key },
        update: { value: { next } },
        create: { key, value: { next } },
      });
    }
  }

  console.log(`   Recorded ${paymentsRecorded} manual payment(s) and ${refundsRecorded} refund(s).`);
}
