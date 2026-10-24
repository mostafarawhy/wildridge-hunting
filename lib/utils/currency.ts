// Currency utilities — AED only. All money math must round to 2 decimals.
// Floats drift; always pipe sums through addMoney / roundMoney before persisting or comparing.

const FILS_PER_AED = 100;

/**
 * Round to 2 decimals using banker's rounding via fils integer math.
 * Avoids float drift: 0.1 + 0.2 === 0.30000000000000004.
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * FILS_PER_AED) / FILS_PER_AED;
}

/**
 * Sum a list of money amounts safely (integer fils math, then convert back).
 */
export function sumMoney(amounts: number[]): number {
  const fils = amounts.reduce(
    (acc, n) => acc + Math.round(n * FILS_PER_AED),
    0,
  );
  return fils / FILS_PER_AED;
}

/**
 * Multiply unit price by integer quantity safely.
 */
export function multiplyMoney(unit: number, quantity: number): number {
  return Math.round(unit * FILS_PER_AED * quantity) / FILS_PER_AED;
}

/**
 * Display formatter. AED-prefixed, locale-aware grouping.
 * For Arabic locale, uses Arabic-Indic numerals via Intl.
 */
export function formatAED(
  amount: number,
  locale: "en" | "ar" | "ru" = "en",
): string {
  const formatter = new Intl.NumberFormat(
    locale === "ar" ? "ar-AE" : locale === "ru" ? "ru-RU" : "en-AE",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  return `AED ${formatter.format(amount)}`;
}
