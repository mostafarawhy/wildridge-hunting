export function generateTempPassword(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*";
  const charset = letters + digits + symbols;
  const length = 14;

  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes).map((b) => charset[b % charset.length]);

  // Force-inject at least one letter and one digit, then shuffle
  const lb = new Uint32Array(2);
  crypto.getRandomValues(lb);
  chars[0] = letters[lb[0] % letters.length];
  chars[1] = digits[lb[1] % digits.length];

  const shuffleBytes = new Uint32Array(length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
