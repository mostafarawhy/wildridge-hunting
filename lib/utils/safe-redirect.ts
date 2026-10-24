import { routing } from "@/lib/i18n";

export function safeRelativePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  if (/[\x00-\x1f\x7f\s]/.test(raw)) return null;

  return raw;
}

export function ensureLocale(
  raw: string | undefined,
  locale: string,
): string | undefined {
  const safe = safeRelativePath(raw);
  if (!safe) return undefined;
  const seg = safe.split("/")[1];
  if ((routing.locales as readonly string[]).includes(seg)) return safe;
  return `/${locale}${safe}`;
}

export function stripLocalePrefix(path: string): string {
  const stripped = path.replace(/^\/(en|ar|ru)(?=\/|\?|#|$)/, "");
  return stripped === "" || stripped.startsWith("?") || stripped.startsWith("#")
    ? `/${stripped}`
    : stripped;
}
