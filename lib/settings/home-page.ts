import { z } from "zod";
import { getContentImageUrl, getContentVideoUrl } from "@/lib/utils/images";
import { HOME_VIDEO_KEY_RE } from "@/lib/settings/home-video";

export const HOME_LOCALES = ["en", "ar", "ru"] as const;
export type HomeLocale = (typeof HOME_LOCALES)[number];

export const HOME_PHOTO_PREFIX = "home/";
export const HOME_PHOTO_KEY_RE =
  /^home\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const HOME_LIMITS = {
  heroEyebrow: 60,
  heroHeading: 60,
  heroHeadingLines: 3,
  primaryLabel: 30,
  secondaryLabel: 30,
  photoAlt: 120,
  tileEyebrow: 40,
  tileTitle: 30,
  desertHeading: 40,
  sectionEyebrow: 40,
  sectionHeading: 60,
  newsletterBody: 240,
  sectionBody: 320,
  sectionLabel: 30,
  href: 200,
  tiles: 4,
} as const;

const photoKey = z.string().regex(HOME_PHOTO_KEY_RE, "This photo is not valid.");

const videoKey = z
  .string()
  .regex(HOME_VIDEO_KEY_RE, "This video is not valid.")
  .nullable()
  .default(null);

function perLocale<T extends z.ZodType>(shape: T) {
  return z.object({ en: shape, ar: shape, ru: shape });
}

function limited(max: number, noun: string) {
  return z
    .string()
    .trim()
    .max(max, `Keep the ${noun} to ${max} characters or fewer.`);
}

const linkField = z
  .string()
  .trim()
  .max(HOME_LIMITS.href, `Keep the link to ${HOME_LIMITS.href} characters or fewer.`)
  .refine(
    (v) => v === "" || /^\/(?![\/\\])/.test(v) || v.startsWith("https://"),
    "Use a page on this site such as /shop/optics, or a full https:// link.",
  );

function headingOf(max: number) {
  return limited(max, "headline").refine(
    (v) => v.split("\n").length <= HOME_LIMITS.heroHeadingLines,
    "Use 3 lines at most.",
  );
}

const headingField = headingOf(HOME_LIMITS.heroHeading);

const homeShape = {
  hero: z.object({
    text: perLocale(
      z.object({
        eyebrow: limited(HOME_LIMITS.heroEyebrow, "line above the headline"),
        heading: headingField,
        primaryLabel: limited(HOME_LIMITS.primaryLabel, "button text"),
        secondaryLabel: limited(HOME_LIMITS.secondaryLabel, "link text"),
        photoAlt: limited(HOME_LIMITS.photoAlt, "photo description"),
      }),
    ),
    primaryHref: linkField,
    secondaryHref: linkField,
    photo: photoKey.nullable(),
  }),
  tiles: z
    .array(
      z.object({
        text: perLocale(
          z.object({
            eyebrow: limited(HOME_LIMITS.tileEyebrow, "line above the title"),
            title: limited(HOME_LIMITS.tileTitle, "title"),
          }),
        ),
        href: linkField,
        photo: photoKey.nullable(),
      }),
    )
    .length(HOME_LIMITS.tiles, "Add exactly four tiles."),
  desert: z.object({
    text: perLocale(z.object({ heading: headingOf(HOME_LIMITS.desertHeading) })),
    photo: photoKey.nullable(),
    video: videoKey,
  }),
  newsletter: z.object({
    text: perLocale(
      z.object({
        heading: headingOf(HOME_LIMITS.sectionHeading),
        body: limited(HOME_LIMITS.newsletterBody, "text"),
      }),
    ),
    photo: photoKey.nullable(),
  }),
  showcase: z.object({
    text: perLocale(
      z.object({
        eyebrow: limited(HOME_LIMITS.sectionEyebrow, "line above the headline"),
        heading: headingOf(HOME_LIMITS.sectionHeading),
        body: limited(HOME_LIMITS.sectionBody, "text"),
        primaryLabel: limited(HOME_LIMITS.sectionLabel, "button text"),
        secondaryLabel: limited(HOME_LIMITS.sectionLabel, "link text"),
        photoAlt: limited(HOME_LIMITS.photoAlt, "photo description"),
      }),
    ),
    primaryHref: linkField,
    secondaryHref: linkField,
    photo: photoKey.nullable(),
  }),
  story: z.object({
    text: perLocale(
      z.object({
        eyebrow: limited(HOME_LIMITS.sectionEyebrow, "line above the headline"),
        heading: headingOf(HOME_LIMITS.sectionHeading),
        body: limited(HOME_LIMITS.sectionBody, "text"),
        buttonLabel: limited(HOME_LIMITS.sectionLabel, "button text"),
      }),
    ),
    buttonHref: linkField,
    photo: photoKey.nullable(),
    video: videoKey,
  }),
};

export const homePageSchema = z.object(homeShape);

export const homePageStoredSchema = z.object({
  ...homeShape,
  desert: homeShape.desert.optional(),
  newsletter: homeShape.newsletter.optional(),
  showcase: homeShape.showcase.optional(),
  story: homeShape.story.optional(),
});

export type HomePageValue = z.infer<typeof homePageSchema>;
export type HomeHeroText = HomePageValue["hero"]["text"]["en"];
export type HomeTileText = HomePageValue["tiles"][number]["text"]["en"];
export type HomeDesertText = HomePageValue["desert"]["text"]["en"];
export type HomeNewsletterText = HomePageValue["newsletter"]["text"]["en"];
export type HomeShowcaseText = HomePageValue["showcase"]["text"]["en"];
export type HomeStoryText = HomePageValue["story"]["text"]["en"];

export const HOME_BUILTIN_PHOTOS = {
  hero: "/images/home/hero.jpg",
  tiles: [
    "/images/home/tile-1.jpg",
    "/images/home/tile-2.jpg",
    "/images/home/tile-3.jpg",
    "/images/home/tile-4.jpg",
  ],
} as const;

export const HOME_BUILTIN_MEDIA = {
  desert: {
    video: "" as string,
    poster: "/images/home/desert-poster.jpg",
  },
  newsletter: "/images/home/newsletter.jpg",
  showcase: "/images/brand/rifle-showcase.png",
  story: {
    video: "" as string,
    poster: "/images/home/story-poster.jpg",
  },
} as const;

type HomeCatalog = { home: Record<string, string> };

const BUILTIN_TILES = [
  { eyebrow: "collection_tile_1_eyebrow", title: "collection_rifles", href: "/shop?groups=rifles" },
  { eyebrow: "collection_tile_2_eyebrow", title: "collection_optics", href: "/shop/optics" },
  { eyebrow: "collection_tile_3_eyebrow", title: "collection_accessories", href: "/shop/accessories" },
  { eyebrow: "collection_tile_4_eyebrow", title: "collection_ammo", href: "/shop/pellets-ammo" },
] as const;

export function homeBuiltIn(catalogs: Record<HomeLocale, HomeCatalog>): HomePageValue {
  const heroText = (locale: HomeLocale): HomeHeroText => {
    const h = catalogs[locale].home;
    return {
      eyebrow: h.hero_eyebrow,
      heading: h.hero_heading,
      primaryLabel: h.hero_cta_primary,
      secondaryLabel: h.hero_cta_secondary,
      photoAlt: h.hero_image_alt,
    };
  };

  const desertText = (locale: HomeLocale): HomeDesertText => ({
    heading: catalogs[locale].home.desert_heading,
  });

  const newsletterText = (locale: HomeLocale): HomeNewsletterText => {
    const h = catalogs[locale].home;
    return { heading: h.newsletter_heading, body: h.newsletter_body };
  };

  const showcaseText = (locale: HomeLocale): HomeShowcaseText => {
    const h = catalogs[locale].home;
    return {
      eyebrow: h.showcase_eyebrow,
      heading: h.showcase_heading,
      body: h.showcase_body,
      primaryLabel: h.showcase_cta_rifles,
      secondaryLabel: h.showcase_cta_about,
      photoAlt: h.showcase_image_alt,
    };
  };

  const storyText = (locale: HomeLocale): HomeStoryText => {
    const h = catalogs[locale].home;
    return {
      eyebrow: h.brand_eyebrow,
      heading: h.brand_heading,
      body: h.brand_body,
      buttonLabel: h.brand_cta,
    };
  };

  return {
    hero: {
      text: { en: heroText("en"), ar: heroText("ar"), ru: heroText("ru") },
      primaryHref: "/shop?groups=rifles",
      secondaryHref: "/shop/optics",
      photo: null,
    },
    tiles: BUILTIN_TILES.map((tile) => {
      const tileText = (locale: HomeLocale): HomeTileText => ({
        eyebrow: catalogs[locale].home[tile.eyebrow],
        title: catalogs[locale].home[tile.title],
      });
      return {
        text: { en: tileText("en"), ar: tileText("ar"), ru: tileText("ru") },
        href: tile.href,
        photo: null,
      };
    }),
    desert: {
      text: { en: desertText("en"), ar: desertText("ar"), ru: desertText("ru") },
      photo: null,
      video: null,
    },
    newsletter: {
      text: {
        en: newsletterText("en"),
        ar: newsletterText("ar"),
        ru: newsletterText("ru"),
      },
      photo: null,
    },
    showcase: {
      text: {
        en: showcaseText("en"),
        ar: showcaseText("ar"),
        ru: showcaseText("ru"),
      },
      primaryHref: "/shop?groups=rifles",
      secondaryHref: "/about",
      photo: null,
    },
    story: {
      text: { en: storyText("en"), ar: storyText("ar"), ru: storyText("ru") },
      buttonHref: "/about",
      photo: null,
      video: null,
    },
  };
}

export function readHomePage(
  raw: unknown,
  builtIn: HomePageValue,
): { value: HomePageValue; saved: boolean; legacy: boolean } {
  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === "object" && Object.keys(raw).length === 0)
  ) {
    return { value: builtIn, saved: false, legacy: false };
  }
  const parsed = homePageStoredSchema.safeParse(raw);
  if (parsed.success) {
    return {
      value: {
        ...parsed.data,
        desert: parsed.data.desert ?? builtIn.desert,
        newsletter: parsed.data.newsletter ?? builtIn.newsletter,
        showcase: parsed.data.showcase ?? builtIn.showcase,
        story: parsed.data.story ?? builtIn.story,
      },
      saved: true,
      legacy: false,
    };
  }
  return { value: builtIn, saved: false, legacy: true };
}

export function englishGaps(value: HomePageValue): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  function check(path: string, text: string, message: string) {
    if (!text.trim()) result[path] = [message];
  }

  const en = value.hero.text.en;
  check("hero.text.en.eyebrow", en.eyebrow, "Add the English line above the headline.");
  check("hero.text.en.heading", en.heading, "Add the English headline.");
  check("hero.text.en.primaryLabel", en.primaryLabel, "Add the English button text.");
  check("hero.text.en.photoAlt", en.photoAlt, "Add the English photo description.");
  check("hero.primaryHref", value.hero.primaryHref, "Add the main button link.");
  if (value.hero.secondaryHref.trim()) {
    check("hero.text.en.secondaryLabel", en.secondaryLabel, "Add the English text for the second link.");
  }

  value.tiles.forEach((tile, index) => {
    check(`tiles.${index}.text.en.eyebrow`, tile.text.en.eyebrow, "Add the English line above the title.");
    check(`tiles.${index}.text.en.title`, tile.text.en.title, "Add the English title.");
    check(`tiles.${index}.href`, tile.href, "Add the tile link.");
  });

  check("desert.text.en.heading", value.desert.text.en.heading, "Add the English headline.");

  const nl = value.newsletter.text.en;
  check("newsletter.text.en.heading", nl.heading, "Add the English headline.");
  check("newsletter.text.en.body", nl.body, "Add the English text.");

  const sc = value.showcase.text.en;
  check("showcase.text.en.eyebrow", sc.eyebrow, "Add the English line above the headline.");
  check("showcase.text.en.heading", sc.heading, "Add the English headline.");
  check("showcase.text.en.body", sc.body, "Add the English text.");
  check("showcase.text.en.primaryLabel", sc.primaryLabel, "Add the English button text.");
  check("showcase.text.en.photoAlt", sc.photoAlt, "Add the English photo description.");
  check("showcase.primaryHref", value.showcase.primaryHref, "Add the main button link.");
  if (value.showcase.secondaryHref.trim()) {
    check("showcase.text.en.secondaryLabel", sc.secondaryLabel, "Add the English text for the second link.");
  }

  const st = value.story.text.en;
  check("story.text.en.eyebrow", st.eyebrow, "Add the English line above the headline.");
  check("story.text.en.heading", st.heading, "Add the English headline.");
  check("story.text.en.body", st.body, "Add the English text.");
  check("story.text.en.buttonLabel", st.buttonLabel, "Add the English button text.");
  check("story.buttonHref", value.story.buttonHref, "Add the button link.");

  return result;
}

export function heroComplete(value: HomePageValue, locale: HomeLocale): boolean {
  const t = value.hero.text[locale];
  const filled = (s: string) => s.trim() !== "";
  return (
    filled(t.eyebrow) &&
    filled(t.heading) &&
    filled(t.primaryLabel) &&
    filled(t.photoAlt) &&
    (!value.hero.secondaryHref.trim() || filled(t.secondaryLabel))
  );
}

export function tilesComplete(value: HomePageValue, locale: HomeLocale): boolean {
  return value.tiles.every(
    (tile) => tile.text[locale].eyebrow.trim() !== "" && tile.text[locale].title.trim() !== "",
  );
}

export function desertComplete(value: HomePageValue, locale: HomeLocale): boolean {
  return value.desert.text[locale].heading.trim() !== "";
}

export function newsletterComplete(value: HomePageValue, locale: HomeLocale): boolean {
  const t = value.newsletter.text[locale];
  return t.heading.trim() !== "" && t.body.trim() !== "";
}

export function showcaseComplete(value: HomePageValue, locale: HomeLocale): boolean {
  const t = value.showcase.text[locale];
  const filled = (s: string) => s.trim() !== "";
  return (
    filled(t.eyebrow) &&
    filled(t.heading) &&
    filled(t.body) &&
    filled(t.primaryLabel) &&
    filled(t.photoAlt) &&
    (!value.showcase.secondaryHref.trim() || filled(t.secondaryLabel))
  );
}

export function storyComplete(value: HomePageValue, locale: HomeLocale): boolean {
  const t = value.story.text[locale];
  const filled = (s: string) => s.trim() !== "";
  return filled(t.eyebrow) && filled(t.heading) && filled(t.body) && filled(t.buttonLabel);
}

function asLocale(locale: string): HomeLocale {
  return (HOME_LOCALES as readonly string[]).includes(locale)
    ? (locale as HomeLocale)
    : "en";
}

export function resolveHero(
  value: HomePageValue,
  locale: string,
): { text: HomeHeroText; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !heroComplete(value, loc)) {
    return { text: value.hero.text.en, fallback: true };
  }
  return { text: value.hero.text[loc], fallback: false };
}

export function resolveDesert(
  value: HomePageValue,
  locale: string,
): { text: HomeDesertText; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !desertComplete(value, loc)) {
    return { text: value.desert.text.en, fallback: true };
  }
  return { text: value.desert.text[loc], fallback: false };
}

export function resolveNewsletter(
  value: HomePageValue,
  locale: string,
): { text: HomeNewsletterText; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !newsletterComplete(value, loc)) {
    return { text: value.newsletter.text.en, fallback: true };
  }
  return { text: value.newsletter.text[loc], fallback: false };
}

export function resolveShowcase(
  value: HomePageValue,
  locale: string,
): { text: HomeShowcaseText; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !showcaseComplete(value, loc)) {
    return { text: value.showcase.text.en, fallback: true };
  }
  return { text: value.showcase.text[loc], fallback: false };
}

export function resolveStory(
  value: HomePageValue,
  locale: string,
): { text: HomeStoryText; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !storyComplete(value, loc)) {
    return { text: value.story.text.en, fallback: true };
  }
  return { text: value.story.text[loc], fallback: false };
}

export function resolveTiles(
  value: HomePageValue,
  locale: string,
): { texts: HomeTileText[]; fallback: boolean } {
  const loc = asLocale(locale);
  if (loc !== "en" && !tilesComplete(value, loc)) {
    return { texts: value.tiles.map((tile) => tile.text.en), fallback: true };
  }
  return { texts: value.tiles.map((tile) => tile.text[loc]), fallback: false };
}

export function homePhotoKeys(value: HomePageValue): string[] {
  const keys: string[] = [];
  if (value.hero.photo) keys.push(value.hero.photo);
  for (const tile of value.tiles) {
    if (tile.photo) keys.push(tile.photo);
  }
  if (value.desert.photo) keys.push(value.desert.photo);
  if (value.newsletter.photo) keys.push(value.newsletter.photo);
  if (value.showcase.photo) keys.push(value.showcase.photo);
  if (value.story.photo) keys.push(value.story.photo);
  return keys;
}

export function heroPhotoUrl(value: HomePageValue): string {
  const url = value.hero.photo ? getContentImageUrl(value.hero.photo) : null;
  return url ?? HOME_BUILTIN_PHOTOS.hero;
}

export function tilePhotoUrl(value: HomePageValue, i: number): string {
  const photo = value.tiles[i]?.photo;
  const url = photo ? getContentImageUrl(photo) : null;
  return url ?? HOME_BUILTIN_PHOTOS.tiles[i];
}

export function desertPhotoUrl(value: HomePageValue): string | null {
  return value.desert.photo ? getContentImageUrl(value.desert.photo) : null;
}

export function newsletterPhotoUrl(value: HomePageValue): string | null {
  return value.newsletter.photo ? getContentImageUrl(value.newsletter.photo) : null;
}

export function showcasePhotoUrl(value: HomePageValue): string | null {
  return value.showcase.photo ? getContentImageUrl(value.showcase.photo) : null;
}

export function storyPhotoUrl(value: HomePageValue): string | null {
  return value.story.photo ? getContentImageUrl(value.story.photo) : null;
}

export function desertVideoUrl(value: HomePageValue): string | null {
  return value.desert.photo && value.desert.video
    ? getContentVideoUrl(value.desert.video)
    : null;
}

export function storyVideoUrl(value: HomePageValue): string | null {
  return value.story.photo && value.story.video
    ? getContentVideoUrl(value.story.video)
    : null;
}

export function homeVideoKeys(value: HomePageValue): string[] {
  const keys: string[] = [];
  if (value.desert.video) keys.push(value.desert.video);
  if (value.story.video) keys.push(value.story.video);
  return keys;
}
