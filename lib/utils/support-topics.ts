export const SUPPORT_TOPICS = [
  "ORDER",
  "QUOTE",
  "ACCOUNT",
  "BUSINESS",
  "PRODUCT",
  "OTHER",
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
