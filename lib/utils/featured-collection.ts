export const FEATURED_COLLECTION_KEY = "homepage-featured";

export const FEATURED_LIMITS = {
  min: 4,
  max: 12,
  heading: 60,
} as const;

export function resolveFeaturedHeading(
  names: { nameEn: string; nameAr: string; nameRu: string | null },
  locale: string,
): string {
  const localized =
    locale === "ar" ? names.nameAr : locale === "ru" ? names.nameRu : null;
  return localized && localized.trim() !== "" ? localized : names.nameEn;
}
