export const STORE_DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type StoreDay = (typeof STORE_DAYS)[number];

export type DayHours = { open: string; close: string } | null;
export type StoreHours = Record<StoreDay, DayHours>;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateCoords(
  lat: number,
  lng: number,
): { latitude: number; longitude: number } | null {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function parseMapPin(
  input: string,
): { latitude: number; longitude: number } | null {
  const trimmed = input.trim();

  const plain = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) return validateCoords(Number(plain[1]), Number(plain[2]));

  const at = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return validateCoords(Number(at[1]), Number(at[2]));

  const q = trimmed.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return validateCoords(Number(q[1]), Number(q[2]));

  const destination = trimmed.match(
    /destination=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  );
  if (destination) return validateCoords(Number(destination[1]), Number(destination[2]));

  return null;
}

export function readStoreHours(json: unknown): StoreHours | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }

  const obj = json as Record<string, unknown>;
  const result = {} as StoreHours;

  for (const day of STORE_DAYS) {
    if (!(day in obj)) return null;
    const value = obj[day];

    if (value === null) {
      result[day] = null;
      continue;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { open?: unknown }).open === "string" &&
      typeof (value as { close?: unknown }).close === "string" &&
      TIME_PATTERN.test((value as { open: string }).open) &&
      TIME_PATTERN.test((value as { close: string }).close)
    ) {
      result[day] = {
        open: (value as { open: string }).open,
        close: (value as { close: string }).close,
      };
      continue;
    }

    return null;
  }

  return result;
}

export type StoreTextField = "name" | "address" | "description" | "hoursNote";
export type StoreText = {
  [K in `${StoreTextField}${"En" | "Ar" | "Ru"}`]: string | null;
};

export function localized(
  store: StoreText,
  base: StoreTextField,
  locale: "en" | "ar" | "ru",
): string | null {
  const suffix: "En" | "Ar" | "Ru" =
    locale === "en" ? "En" : locale === "ar" ? "Ar" : "Ru";
  const localeKey: keyof StoreText = `${base}${suffix}`;
  const enKey: keyof StoreText = `${base}En`;

  const localeVal = store[localeKey]?.trim();
  if (localeVal) return localeVal;

  const enVal = store[enKey]?.trim();
  return enVal || null;
}

export function dayName(locale: string, index: number): string {
  const date = new Date(Date.UTC(2024, 0, 6 + index));
  const raw = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function groupHours(
  hours: StoreHours,
  locale: string,
  closedLabel: string,
): { label: string; value: string }[] {
  const groups: { startIndex: number; endIndex: number; value: string }[] = [];

  STORE_DAYS.forEach((day, index) => {
    const dayHours = hours[day];
    const value = dayHours ? `${dayHours.open} – ${dayHours.close}` : closedLabel;
    const last = groups[groups.length - 1];
    if (last && last.value === value) {
      last.endIndex = index;
    } else {
      groups.push({ startIndex: index, endIndex: index, value });
    }
  });

  return groups.map((g) => ({
    label:
      g.startIndex === g.endIndex
        ? dayName(locale, g.startIndex)
        : `${dayName(locale, g.startIndex)} – ${dayName(locale, g.endIndex)}`,
    value: g.value,
  }));
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function dubaiPartsAt(now: Date): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);

  const SHORT_TO_DAY: Record<string, StoreDay> = {
    Sat: "sat",
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  return {
    dayIndex: STORE_DAYS.indexOf(SHORT_TO_DAY[weekday]),
    minutes: hour * 60 + minute,
  };
}

export type OpenStatus =
  | { open: true; until: string }
  | { open: false; opensDayIndex: number; opensTime: string; today: boolean }
  | { open: false; never: true };

export function openStatus(hours: StoreHours | null, now: Date): OpenStatus | null {
  if (hours == null) return null;

  const { dayIndex, minutes } = dubaiPartsAt(now);

  const todayHours = hours[STORE_DAYS[dayIndex]];
  if (todayHours) {
    const openMin = parseMinutes(todayHours.open);
    const closeMin = parseMinutes(todayHours.close);
    const crossesMidnight = closeMin <= openMin;

    if (!crossesMidnight && minutes >= openMin && minutes < closeMin) {
      return { open: true, until: todayHours.close };
    }
    if (crossesMidnight && minutes >= openMin) {
      return { open: true, until: todayHours.close };
    }
  }

  const yesterdayIndex = (dayIndex - 1 + 7) % 7;
  const yesterdayHours = hours[STORE_DAYS[yesterdayIndex]];
  if (yesterdayHours) {
    const openMin = parseMinutes(yesterdayHours.open);
    const closeMin = parseMinutes(yesterdayHours.close);
    const crossesMidnight = closeMin <= openMin;
    if (crossesMidnight && minutes < closeMin) {
      return { open: true, until: yesterdayHours.close };
    }
  }

  if (todayHours) {
    const openMin = parseMinutes(todayHours.open);
    if (minutes < openMin) {
      return {
        open: false,
        opensDayIndex: dayIndex,
        opensTime: todayHours.open,
        today: true,
      };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidateIndex = (dayIndex + offset) % 7;
    const candidateHours = hours[STORE_DAYS[candidateIndex]];
    if (candidateHours) {
      return {
        open: false,
        opensDayIndex: candidateIndex,
        opensTime: candidateHours.open,
        today: false,
      };
    }
  }

  return { open: false, never: true };
}

export function mapEmbedUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
