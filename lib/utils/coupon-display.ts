import { CouponType, CustomerRole } from "@/app/generated/prisma/enums";
import { formatAED } from "@/lib/utils/currency";

export type CouponStatus =
  | "ACTIVE"
  | "SCHEDULED"
  | "PAUSED"
  | "USED_UP"
  | "EXPIRED";

export const COUPON_STATUSES: CouponStatus[] = [
  "ACTIVE",
  "SCHEDULED",
  "PAUSED",
  "USED_UP",
  "EXPIRED",
];

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  PAUSED: "Paused",
  USED_UP: "Used up",
  EXPIRED: "Expired",
};

export const COUPON_STATUS_STYLES: Record<
  CouponStatus,
  { backgroundColor: string; color: string }
> = {
  ACTIVE: { backgroundColor: "#dcfce7", color: "#166534" },
  SCHEDULED: { backgroundColor: "#fef9c3", color: "#854d0e" },
  PAUSED: { backgroundColor: "#f3f4f6", color: "#374151" },
  USED_UP: { backgroundColor: "#f3f4f6", color: "#374151" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

export function deriveCouponStatus(
  c: {
    isActive: boolean;
    startsAt: string | Date | null;
    endsAt: string | Date | null;
    usageLimit: number | null;
    usedCount: number;
  },
  now: Date,
): CouponStatus {
  const startsAt = c.startsAt != null ? new Date(c.startsAt) : null;
  const endsAt = c.endsAt != null ? new Date(c.endsAt) : null;
  if (endsAt && now > endsAt) return "EXPIRED";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "USED_UP";
  if (!c.isActive) return "PAUSED";
  if (startsAt && now < startsAt) return "SCHEDULED";
  return "ACTIVE";
}

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: "Percentage",
  FIXED: "Fixed amount",
  FREE_SHIPPING: "Free shipping",
};

export const CUSTOMER_ROLE_LABELS: Record<CustomerRole, string> = {
  B2C: "Retail customers",
  B2B: "Business customers",
};

const couponDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatCouponDate(iso: string): string {
  return couponDateFormatter.format(new Date(iso));
}

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export function dubaiDayFromIso(iso: string): string {
  return new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function dubaiDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00.000+04:00`).toISOString();
}

export function dubaiDayEndIso(day: string): string {
  return new Date(`${day}T23:59:59.999+04:00`).toISOString();
}

export function describeDiscount(c: {
  type: CouponType;
  value: number;
  maxDiscountAmount: number | null;
}): string {
  if (c.type === CouponType.PERCENTAGE) {
    return c.maxDiscountAmount
      ? `${c.value}% · max ${formatAED(c.maxDiscountAmount)}`
      : `${c.value}%`;
  }
  if (c.type === CouponType.FIXED) return formatAED(c.value);
  return "Free shipping";
}

export function describeConditions(c: {
  minOrderAmount: number | null;
  allowedRole: CustomerRole | null;
  customerEmail: string | null;
}): string {
  const parts: string[] = [];
  if (c.minOrderAmount != null && c.minOrderAmount > 0) {
    parts.push(`Goods from ${formatAED(c.minOrderAmount)}`);
  }
  if (c.customerEmail) parts.push("One customer");
  if (c.allowedRole) parts.push(CUSTOMER_ROLE_LABELS[c.allowedRole]);
  return parts.length > 0 ? parts.join(" · ") : "Any customer";
}

export function describeSchedule(
  status: CouponStatus,
  startsAt: string | null,
  endsAt: string | null,
): string {
  if (status === "EXPIRED" && endsAt) {
    return `Ended ${formatCouponDate(endsAt)}`;
  }
  if (status === "SCHEDULED" && startsAt) {
    return `Starts ${formatCouponDate(startsAt)}`;
  }
  if (endsAt) return `Until ${formatCouponDate(endsAt)}`;
  return "No end date";
}

export function describeCoupon(input: {
  type: CouponType;
  value: number | null;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  allowedRole: CustomerRole | null;
  customerEmail: string | null;
  usageLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
}): string {
  let discount: string;
  if (input.type === CouponType.PERCENTAGE) {
    discount =
      input.value != null
        ? `${input.value}% off goods`
        : "A percentage off goods";
    if (input.maxDiscountAmount) {
      discount += `, up to ${formatAED(input.maxDiscountAmount)}`;
    }
  } else if (input.type === CouponType.FIXED) {
    discount =
      input.value != null
        ? `${formatAED(input.value)} off goods`
        : "An amount off goods";
  } else {
    discount = "Free shipping, except to destinations that need a shipping quote";
  }
  if (input.minOrderAmount != null && input.minOrderAmount > 0) {
    discount += ` when goods total ${formatAED(input.minOrderAmount)} or more`;
  }
  discount += ".";

  let who: string;
  if (input.customerEmail) who = `Only for ${input.customerEmail}.`;
  else if (input.allowedRole === CustomerRole.B2C) {
    who = "Retail customers only.";
  } else if (input.allowedRole === CustomerRole.B2B) {
    who = "Business customers only.";
  } else {
    who = "Any signed-in customer can use it.";
  }

  const limit =
    input.usageLimit != null
      ? `${input.usageLimit} ${input.usageLimit === 1 ? "use" : "uses"} in total.`
      : "No limit on uses.";

  let schedule: string;
  if (input.startsAt && input.endsAt) {
    schedule = `Runs ${formatCouponDate(input.startsAt)} to ${formatCouponDate(input.endsAt)}, Dubai time.`;
  } else if (input.startsAt) {
    schedule = `Starts ${formatCouponDate(input.startsAt)}, Dubai time, with no end date.`;
  } else if (input.endsAt) {
    schedule = `Ends after ${formatCouponDate(input.endsAt)}, Dubai time.`;
  } else {
    schedule = "No end date.";
  }

  return [discount, who, limit, schedule].join(" ");
}

export function describeRewardRule(input: {
  minOrderTotal: number | null;
  rewardType: CouponType;
  rewardValue: number | null;
  rewardMaxDiscountAmount: number | null;
  rewardMinOrderAmount: number | null;
  validityDays: number | null;
}): string {
  const total =
    input.minOrderTotal != null
      ? `When a delivered order totals ${formatAED(input.minOrderTotal)} or more`
      : "When a delivered order reaches the set total";

  let reward: string;
  if (input.rewardType === CouponType.PERCENTAGE) {
    reward =
      input.rewardValue != null ? `${input.rewardValue}% off` : "a percentage off";
    if (input.rewardMaxDiscountAmount) {
      reward += `, up to ${formatAED(input.rewardMaxDiscountAmount)}`;
    }
  } else if (input.rewardType === CouponType.FIXED) {
    reward =
      input.rewardValue != null
        ? `${formatAED(input.rewardValue)} off`
        : "an amount off";
  } else {
    reward = "free shipping";
  }

  const next =
    input.rewardMinOrderAmount != null && input.rewardMinOrderAmount > 0
      ? ` of ${formatAED(input.rewardMinOrderAmount)} or more in goods`
      : "";

  const days =
    input.validityDays != null
      ? `for ${input.validityDays} ${input.validityDays === 1 ? "day" : "days"}`
      : "for the set number of days";

  return `${total}, the customer gets ${reward} on their next order${next}, valid ${days}.`;
}
