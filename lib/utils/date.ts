/**
 * Date formatting utilities.
 *
 * Rules:
 * - Database always stores UTC (Supabase default)
 * - Query functions convert Date → ISO string (.toISOString())
 * - Components never receive Date objects — only ISO strings
 * - All display formatting happens here, in Asia/Dubai timezone
 */

const BUSINESS_TIMEZONE = "Asia/Dubai"; // UTC+4, no DST

/**
 * Formats an ISO date string for display in the storefront.
 * Respects the active locale (en/ar/ru) and always uses Dubai timezone.
 *
 * @param isoString - UTC ISO string from the database e.g. "2026-05-07T18:00:00.000Z"
 * @param locale - Active next-intl locale: "en" | "ar" | "ru"
 */
export function formatDisplayDate(isoString: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoString));
}

/**
 * Formats an ISO date string for compact display (e.g. order lists, admin).
 * Example output: "07/05/2026" in en, "٠٧/٠٥/٢٠٢٦" in ar
 *
 * @param isoString - UTC ISO string from the database
 * @param locale - Active next-intl locale: "en" | "ar" | "ru"
 */
export function formatShortDate(isoString: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoString));
}

/**
 * Converts a Prisma Date to an ISO string for safe server→client passing.
 * Use this in every query function before returning dates to components.
 *
 * @param date - Date object from Prisma query result
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Formats an ISO date string with time for admin dashboard display.
 * Example: "7 May 2026, 22:47" in en, with Arabic-Indic numerals in ar
 *
 * @param isoString - UTC ISO string from the database
 * @param locale - Active next-intl locale: "en" | "ar" | "ru"
 */
export function formatDateTime(isoString: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

/**
 * Returns an ISO string representing the current moment in UTC.
 * Use this anywhere you need "now" — never use new Date() directly in components.
 * This keeps the source of truth for "current time" in one place.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

const DUBAI_OFFSET_MS = 4 * 3600 * 1000; // UTC+4, no DST

/**
 * Returns the Dubai calendar-day string (YYYY-MM-DD) for a given UTC Date.
 * Source of truth for the Dubai day boundary used by dashboard aggregation.
 *
 * @param d - Any Date (interpreted as a UTC instant)
 */
export function dubaiDay(d: Date): string {
  return new Date(d.getTime() + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Returns the UTC Date corresponding to 00:00 Asia/Dubai, `daysAgo` Dubai-days
 * before today. Use this as a window cutoff so aggregate queries and the
 * trend-chart day sequence share the same Dubai-day origin.
 *
 * @param daysAgo - Number of Dubai-days before today
 */
export function dubaiDayStartUtc(daysAgo: number): Date {
  const now = Date.now();
  const dayString = dubaiDay(new Date(now - daysAgo * 864e5));
  return new Date(
    new Date(`${dayString}T00:00:00.000Z`).getTime() - DUBAI_OFFSET_MS,
  );
}

/**
 * Returns `count` consecutive Dubai-day strings starting `daysAgo` Dubai-days
 * back, anchored to dubaiDayStartUtc(daysAgo) so the chart axis and the fetch
 * cutoff share one origin.
 *
 * @param daysAgo - Number of Dubai-days before today to start the sequence
 * @param count - Number of consecutive days to return
 */
export function dubaiDaySequence(daysAgo: number, count: number): string[] {
  const anchorMs = dubaiDayStartUtc(daysAgo).getTime();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(dubaiDay(new Date(anchorMs + i * 864e5)));
  }
  return result;
}

export function dubaiDayBoundsUtc(day: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const startMs = new Date(`${day}T00:00:00.000Z`).getTime() - DUBAI_OFFSET_MS;
  if (Number.isNaN(startMs)) return null;
  return { start: new Date(startMs), end: new Date(startMs + 864e5) };
}

export function dubaiRecentDays(days: number): { from: string; to: string } {
  const now = Date.now();
  return {
    from: dubaiDay(new Date(now - (days - 1) * 864e5)),
    to: dubaiDay(new Date(now)),
  };
}
