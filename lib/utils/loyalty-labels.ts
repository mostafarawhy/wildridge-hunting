export type LoyaltyTypeKey =
  | "EARNED"
  | "REDEEMED"
  | "ADJUSTED"
  | "EXPIRED"
  | "REFUNDED"
  | "REVERSED";

export const LOYALTY_TYPE_ORDER: LoyaltyTypeKey[] = [
  "EARNED",
  "REDEEMED",
  "ADJUSTED",
  "EXPIRED",
  "REFUNDED",
  "REVERSED",
];

export const LOYALTY_TYPE_LABELS: Record<LoyaltyTypeKey, string> = {
  EARNED: "Earned",
  REDEEMED: "Redeemed",
  ADJUSTED: "Adjusted",
  EXPIRED: "Expired",
  REFUNDED: "Returned",
  REVERSED: "Reversed",
};

export const LOYALTY_TYPE_PILL: Record<
  LoyaltyTypeKey,
  { bg: string; text: string }
> = {
  EARNED: { bg: "#dcfce7", text: "#166534" },
  ADJUSTED: { bg: "#dbeafe", text: "#1e40af" },
  REDEEMED: { bg: "#fef3c7", text: "#92400e" },
  EXPIRED: { bg: "#f3f4f6", text: "#374151" },
  REFUNDED: { bg: "#f3f4f6", text: "#374151" },
  REVERSED: { bg: "#fee2e2", text: "#991b1b" },
};
