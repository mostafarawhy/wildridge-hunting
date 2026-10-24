import { z } from "zod";
import { dayField } from "@/lib/validations/banner";
import { getContentImageUrl } from "@/lib/utils/images";
import { focalPointSchema, type FocalPoint } from "@/lib/utils/focal-point";

export const SITE_LOCALES = ["en", "ar", "ru"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const SITE_PHOTO_PREFIX = "site/";
export const SITE_PHOTO_KEY_RE =
  /^site\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const SITE_LIMITS = {
  message: 80,
  href: 200,
} as const;

const photoKey = z.string().regex(SITE_PHOTO_KEY_RE, "This photo is not valid.");

const messageField = z
  .string()
  .trim()
  .max(
    SITE_LIMITS.message,
    `Keep the message to ${SITE_LIMITS.message} characters or fewer.`,
  );

const linkField = z
  .string()
  .trim()
  .max(SITE_LIMITS.href, `Keep the link to ${SITE_LIMITS.href} characters or fewer.`)
  .refine(
    (v) => v === "" || /^\/(?![\/\\])/.test(v) || v.startsWith("https://"),
    "Use a page on this site such as /shop/optics, or a full https:// link.",
  );

export type BannerFocusKey = "shopPhoto" | "menuPhoto" | "pagesHero" | "storesHero";

export function defaultBannerFocus(): Record<BannerFocusKey, FocalPoint> {
  return {
    shopPhoto: { x: 50, y: 70 },
    menuPhoto: { x: 50, y: 50 },
    pagesHero: { x: 50, y: 50 },
    storesHero: { x: 50, y: 50 },
  };
}

export const siteBannersSchema = z.object({
  announcement: z
    .object({
      message: z.object({
        en: messageField,
        ar: messageField,
        ru: messageField,
      }),
      href: linkField,
      startsOn: dayField,
      endsOn: dayField,
    })
    .refine((d) => !d.startsOn || !d.endsOn || d.endsOn >= d.startsOn, {
      message: "End date must be on or after the start date",
      path: ["endsOn"],
    })
    .refine(
      (d) => !(d.href || d.startsOn || d.endsOn) || d.message.en.trim() !== "",
      {
        message: "Add the English message.",
        path: ["message", "en"],
      },
    ),
  shopPhoto: photoKey.nullable(),
  menuPhoto: photoKey.nullable(),
  pagesHero: photoKey.nullable().default(null),
  storesHero: photoKey.nullable().default(null),
  focus: z
    .object({
      shopPhoto: focalPointSchema.default(() => defaultBannerFocus().shopPhoto),
      menuPhoto: focalPointSchema.default(() => defaultBannerFocus().menuPhoto),
      pagesHero: focalPointSchema.default(() => defaultBannerFocus().pagesHero),
      storesHero: focalPointSchema.default(() => defaultBannerFocus().storesHero),
    })
    .default(defaultBannerFocus),
});

export type SiteBannersValue = z.infer<typeof siteBannersSchema>;

export const SITE_BUILTIN = {
  shopPhoto: "/images/shop/banner.jpg",
  menuPhoto: "/images/nav/rifles.jpg",
  pagesHero: "/images/store-pages/hero.jpg",
  storesHero: "/images/store-pages/stores.jpg",
} as const;

export const SITE_BANNERS_DEFAULT: SiteBannersValue = {
  announcement: {
    message: { en: "", ar: "", ru: "" },
    href: "",
    startsOn: "",
    endsOn: "",
  },
  shopPhoto: null,
  menuPhoto: null,
  pagesHero: null,
  storesHero: null,
  focus: defaultBannerFocus(),
};

export type AnnouncementState = "none" | "scheduled" | "showing" | "ended";

export function announcementState(
  value: SiteBannersValue,
  today: string,
): AnnouncementState {
  const a = value.announcement;
  if (!a.message.en.trim()) return "none";
  if (a.startsOn && today < a.startsOn) return "scheduled";
  if (a.endsOn && today > a.endsOn) return "ended";
  return "showing";
}

export function announcementCopy(
  value: SiteBannersValue,
  locale: string,
): { text: string; href: string; fallback: boolean } | null {
  const a = value.announcement;
  if (!a.message.en.trim()) return null;
  const localized =
    locale === "ar" ? a.message.ar : locale === "ru" ? a.message.ru : "";
  const useLocal = localized.trim() !== "";
  return {
    text: useLocal ? localized : a.message.en,
    href: a.href,
    fallback: locale !== "en" && !useLocal,
  };
}

export function resolveAnnouncement(
  value: SiteBannersValue,
  locale: string,
  today: string,
): { text: string; href: string } | null {
  if (announcementState(value, today) !== "showing") return null;
  const copy = announcementCopy(value, locale);
  return copy ? { text: copy.text, href: copy.href } : null;
}

export function shopPhotoUrl(value: SiteBannersValue): string {
  const url = value.shopPhoto ? getContentImageUrl(value.shopPhoto) : null;
  return url ?? SITE_BUILTIN.shopPhoto;
}

export function menuPhotoUrl(value: SiteBannersValue): string {
  const url = value.menuPhoto ? getContentImageUrl(value.menuPhoto) : null;
  return url ?? SITE_BUILTIN.menuPhoto;
}

export function pagesHeroUrl(value: SiteBannersValue): string {
  const url = value.pagesHero ? getContentImageUrl(value.pagesHero) : null;
  return url ?? SITE_BUILTIN.pagesHero;
}

export function storesHeroUrl(value: SiteBannersValue): string {
  const url = value.storesHero ? getContentImageUrl(value.storesHero) : null;
  return url ?? SITE_BUILTIN.storesHero;
}

export function pageHeroUrl(value: SiteBannersValue, pageKey: string): string {
  return pageKey === "stores" ? storesHeroUrl(value) : pagesHeroUrl(value);
}

export function sitePhotoKeys(value: SiteBannersValue): string[] {
  const keys: string[] = [];
  if (value.shopPhoto) keys.push(value.shopPhoto);
  if (value.menuPhoto) keys.push(value.menuPhoto);
  if (value.pagesHero) keys.push(value.pagesHero);
  if (value.storesHero) keys.push(value.storesHero);
  return keys;
}

export function readSiteBanners(raw: unknown): {
  value: SiteBannersValue;
  saved: boolean;
  legacy: boolean;
} {
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === "object" && Object.keys(raw).length === 0)
  ) {
    return { value: SITE_BANNERS_DEFAULT, saved: false, legacy: false };
  }
  const parsed = siteBannersSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, saved: true, legacy: false };
  return { value: SITE_BANNERS_DEFAULT, saved: false, legacy: true };
}
