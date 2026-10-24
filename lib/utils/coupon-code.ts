import { randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export function generateCouponSuffix(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function buildRewardCode(prefix: string): string {
  return `${prefix.trim().toUpperCase()}-${generateCouponSuffix()}`;
}
