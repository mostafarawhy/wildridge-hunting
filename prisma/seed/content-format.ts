export const CONTENT_CONFIG_KEYS = [
  "home_page",
  "about_page",
  "site_banners",
  "home_popup_style",
  "store_profile",
] as const;

export type ContentConfigKey = (typeof CONTENT_CONFIG_KEYS)[number];

export type ContentPage = {
  key: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  titleRu: string | null;
  contentEn: string | null;
  contentAr: string | null;
  contentRu: string | null;
  metaTitleEn: string | null;
  metaTitleAr: string | null;
  metaTitleRu: string | null;
  metaDescriptionEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionRu: string | null;
  isActive: boolean;
};

export type ContentStore = {
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  addressEn: string;
  addressAr: string | null;
  addressRu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  hoursNoteEn: string | null;
  hoursNoteAr: string | null;
  hoursNoteRu: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  openingHours: unknown;
  isActive: boolean;
  isPrimary: boolean;
  displayOrder: number;
};

export type ContentPopupBanner = {
  bannerId: string;
  pageKey: string;
  titleEn: string;
  titleAr: string;
  titleRu: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  subtitleRu: string | null;
  ctaEn: string | null;
  ctaAr: string | null;
  ctaRu: string | null;
  linkUrl: string | null;
  imageFilename: string | null;
  storageKey: string | null;
  isActive: boolean;
  displayOrder: number;
  startsAt: string | null;
  endsAt: string | null;
};

export type ContentFeatured = {
  key: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  isActive: boolean;
  skus: string[];
};

export type ContentBundle = {
  projectConfig: Partial<Record<ContentConfigKey, unknown>>;
  popupBanner: ContentPopupBanner | null;
  pages: ContentPage[];
  stores: ContentStore[];
  featured: ContentFeatured | null;
};

const PAGE_FIELDS: (keyof ContentPage)[] = [
  "key",
  "slug",
  "titleEn",
  "titleAr",
  "titleRu",
  "contentEn",
  "contentAr",
  "contentRu",
  "metaTitleEn",
  "metaTitleAr",
  "metaTitleRu",
  "metaDescriptionEn",
  "metaDescriptionAr",
  "metaDescriptionRu",
  "isActive",
];

const STORE_FIELDS: (keyof ContentStore)[] = [
  "nameEn",
  "nameAr",
  "nameRu",
  "addressEn",
  "addressAr",
  "addressRu",
  "descriptionEn",
  "descriptionAr",
  "descriptionRu",
  "hoursNoteEn",
  "hoursNoteAr",
  "hoursNoteRu",
  "latitude",
  "longitude",
  "phone",
  "email",
  "openingHours",
  "isActive",
  "isPrimary",
  "displayOrder",
];

const POPUP_FIELDS: (keyof ContentPopupBanner)[] = [
  "bannerId",
  "pageKey",
  "titleEn",
  "titleAr",
  "titleRu",
  "subtitleEn",
  "subtitleAr",
  "subtitleRu",
  "ctaEn",
  "ctaAr",
  "ctaRu",
  "linkUrl",
  "imageFilename",
  "storageKey",
  "isActive",
  "displayOrder",
  "startsAt",
  "endsAt",
];

const FEATURED_FIELDS: (keyof ContentFeatured)[] = [
  "key",
  "nameEn",
  "nameAr",
  "nameRu",
  "isActive",
  "skus",
];

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])]),
    );
  }
  return value;
}

function ordered<T extends object>(row: T, fields: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = row[field];
    out[field as string] = value === undefined ? null : sortKeys(value);
  }
  return out;
}

export function serializeContent(bundle: ContentBundle): string {
  const projectConfig: Record<string, unknown> = {};
  for (const key of CONTENT_CONFIG_KEYS) {
    const value = bundle.projectConfig[key];
    if (value !== undefined && value !== null) projectConfig[key] = sortKeys(value);
  }

  const document = {
    projectConfig,
    popupBanner: bundle.popupBanner
      ? ordered(bundle.popupBanner, POPUP_FIELDS)
      : null,
    pages: bundle.pages.map((page) => ordered(page, PAGE_FIELDS)),
    stores: bundle.stores.map((store) => ordered(store, STORE_FIELDS)),
    featured: bundle.featured ? ordered(bundle.featured, FEATURED_FIELDS) : null,
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}
