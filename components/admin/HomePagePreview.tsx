"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import HeroView from "@/components/home/HeroView";
import CollectionTilesView from "@/components/home/CollectionTilesView";
import FeaturedSectionView from "@/components/home/FeaturedSectionView";
import DesertBannerView from "@/components/home/DesertBannerView";
import NewsletterBandView from "@/components/home/NewsletterBandView";
import ShowcaseView from "@/components/home/ShowcaseView";
import BrandStoryView from "@/components/home/BrandStoryView";
import NewsletterForm from "@/components/home/NewsletterForm";
import type { LinkSlot } from "@/components/home/link-slot";
import {
  HOME_BUILTIN_MEDIA,
  resolveDesert,
  resolveHero,
  resolveNewsletter,
  resolveShowcase,
  resolveStory,
  resolveTiles,
  type HomeLocale,
  type HomePageValue,
} from "@/lib/settings/home-page";
import { getContentImageUrl, getContentVideoUrl } from "@/lib/utils/images";
import { resolveFeaturedHeading } from "@/lib/utils/featured-collection";
import type { FeaturedEditorState } from "@/lib/db/queries/collections";

const RTL_CLASS = "home-preview-rtl";

const RTL_CSS = `
.${RTL_CLASS} {
  --font-arabic: "Cairo Variable", system-ui, sans-serif;
  font-family: var(--font-arabic);

  --text-badge: 0.5625rem;
  --text-eyebrow: 0.8125rem;
  --text-label: 0.9rem;
  --text-body-sm: 0.8125rem;
  --text-body: 0.875rem;
  --text-body-lg: 1.0625rem;
  --text-ui: 1rem;

  --text-heading: 1.875rem;
  --text-heading-desktop: 2.375rem;

  --text-display-sm: 2.375rem;
  --text-display-sm-desktop: 3.375rem;

  --text-display: 2.75rem;
  --text-display-desktop: 4.125rem;

  --text-display-lg: 2.75rem;
  --text-display-lg-desktop: 4.625rem;
}
.${RTL_CLASS},
.${RTL_CLASS} * {
  letter-spacing: 0 !important;
  text-transform: none !important;
}
.${RTL_CLASS} h1,
.${RTL_CLASS} h2,
.${RTL_CLASS} h3,
.${RTL_CLASS} h4,
.${RTL_CLASS} h5,
.${RTL_CLASS} h6 {
  font-weight: var(--font-bold);
  line-height: 1.3;
}
.${RTL_CLASS} p {
  line-height: 1.8;
}
.${RTL_CLASS} span,
.${RTL_CLASS} a,
.${RTL_CLASS} button,
.${RTL_CLASS} input,
.${RTL_CLASS} label {
  line-height: 1.6;
}
`;

export type HomePreviewLabels = {
  shopNow: string;
  featuredEyebrow: string;
  seeAll: string;
  legalPrefix: string;
  legalLink: string;
  legalSuffix: string;
  ariaInstagram: string;
  ariaWhatsapp: string;
  ariaYoutube: string;
};

export type HomePreviewSocials = {
  instagram: string;
  whatsapp: string;
  youtube: string;
};

const LANG_OPTIONS: { key: HomeLocale; label: string }[] = [
  { key: "en", label: "English" },
  { key: "ar", label: "Arabic" },
  { key: "ru", label: "Russian" },
];

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const tabStyle: React.CSSProperties = {
  height: "2rem",
  paddingInline: "1rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

const inertLink: LinkSlot = (p) => (
  <span className={p.className} style={p.style} aria-disabled="true">
    {p.children}
  </span>
);

interface Props {
  value: HomePageValue;
  featured: FeaturedEditorState;
  urls: Record<string, string>;
  builtInPhotos: { hero: string; tiles: string[] };
  labels: Record<HomeLocale, HomePreviewLabels>;
  socials: HomePreviewSocials;
  formMessages: Record<HomeLocale, AbstractIntlMessages>;
  initialLang: HomeLocale;
  onClose: () => void;
}

export default function HomePagePreview({
  value,
  featured,
  urls,
  builtInPhotos,
  labels,
  socials,
  formMessages,
  initialLang,
  onClose,
}: Props) {
  const [lang, setLang] = useState<HomeLocale>(initialLang);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const option = LANG_OPTIONS.find((o) => o.key === lang) ?? LANG_OPTIONS[0];
  const hero = resolveHero(value, lang);
  const tiles = resolveTiles(value, lang);
  const desert = resolveDesert(value, lang);
  const newsletter = resolveNewsletter(value, lang);
  const showcase = resolveShowcase(value, lang);
  const story = resolveStory(value, lang);
  const rtl = lang === "ar";

  const fallbackNames = [
    hero.fallback && "hero",
    tiles.fallback && "collection tiles",
    desert.fallback && "video band",
    newsletter.fallback && "newsletter band",
    showcase.fallback && "rifle showcase",
    story.fallback && "brand story",
  ].filter((n): n is string => typeof n === "string");
  const fallbackWhat =
    fallbackNames.length > 1
      ? `${fallbackNames.slice(0, -1).join(", ")} and ${fallbackNames[fallbackNames.length - 1]}`
      : (fallbackNames[0] ?? "");

  function resolvedUrl(key: string | null): string | null {
    if (!key) return null;
    return urls[key] ?? getContentImageUrl(key);
  }

  function photoUrl(key: string | null, builtIn: string): string {
    return resolvedUrl(key) ?? builtIn;
  }

  const l = labels[lang];
  const featuredItems = featured.items.filter((item) => item.live);
  const socialLinks = [
    { key: "instagram" as const, href: socials.instagram, ariaLabel: l.ariaInstagram },
    { key: "whatsapp" as const, href: socials.whatsapp, ariaLabel: l.ariaWhatsapp },
    { key: "youtube" as const, href: socials.youtube, ariaLabel: l.ariaYoutube },
  ].filter((social) => social.href);

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex flex-col"
        style={{ zIndex: "var(--z-modal)", backgroundColor: "#ffffff" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem 1.25rem",
            padding: "0.625rem 1rem",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid var(--color-shop-divider)",
            flex: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {LANG_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={lang === o.key}
                onClick={() => setLang(o.key)}
                style={{ ...tabStyle, opacity: lang === o.key ? 1 : 0.45 }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {fallbackNames.length > 0 && (
            <p
              role="status"
              style={{
                margin: 0,
                flex: "1 1 16rem",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-auth-label-text)",
              }}
            >
              {option.label} visitors see the English {fallbackWhat}.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ ...linkStyle, marginInlineStart: "auto" }}
          >
            Close preview
          </button>
        </div>

        <div
          className={rtl ? RTL_CLASS : undefined}
          data-surface="storefront"
          style={{ flex: 1, overflowY: "auto", backgroundColor: "#ffffff" }}
        >
          <div dir={rtl ? "rtl" : "ltr"} lang={lang}>
            <div inert>
              <NextIntlClientProvider locale={lang} messages={formMessages[lang]}>
                <HeroView
                  photoUrl={photoUrl(value.hero.photo, builtInPhotos.hero)}
                  photoAlt={hero.text.photoAlt}
                  eyebrow={hero.text.eyebrow}
                  heading={hero.text.heading}
                  primaryLabel={hero.text.primaryLabel}
                  primaryHref={value.hero.primaryHref}
                  secondaryLabel={hero.text.secondaryLabel}
                  secondaryHref={value.hero.secondaryHref}
                  link={inertLink}
                />
                {featured.shown && featuredItems.length > 0 && (
                  <FeaturedSectionView
                    eyebrow={l.featuredEyebrow}
                    heading={resolveFeaturedHeading(
                      {
                        nameEn: featured.heading.en,
                        nameAr: featured.heading.ar,
                        nameRu: featured.heading.ru,
                      },
                      lang,
                    )}
                    seeAllLabel={l.seeAll}
                    items={featuredItems}
                    locale={lang}
                    isBusinessMode={false}
                    link={inertLink}
                  />
                )}
                <CollectionTilesView
                  tiles={tiles.texts.map((text, index) => ({
                    eyebrow: text.eyebrow,
                    title: text.title,
                    href: value.tiles[index].href,
                    photoUrl: photoUrl(value.tiles[index].photo, builtInPhotos.tiles[index]),
                  }))}
                  shopNowLabel={l.shopNow}
                  link={inertLink}
                />
                <DesertBannerView
                  heading={desert.text.heading}
                  photoUrl={resolvedUrl(value.desert.photo)}
                  videoUrl={
                    value.desert.photo && value.desert.video
                      ? getContentVideoUrl(value.desert.video)
                      : null
                  }
                />
                <NewsletterBandView
                  heading={newsletter.text.heading}
                  body={newsletter.text.body}
                  photoUrl={photoUrl(value.newsletter.photo, HOME_BUILTIN_MEDIA.newsletter)}
                  socials={socialLinks}
                  form={<NewsletterForm source="HOME" />}
                  legalPrefix={l.legalPrefix}
                  legalLinkLabel={l.legalLink}
                  legalSuffix={l.legalSuffix}
                  link={inertLink}
                />
                <ShowcaseView
                  eyebrow={showcase.text.eyebrow}
                  heading={showcase.text.heading}
                  body={showcase.text.body}
                  primaryLabel={showcase.text.primaryLabel}
                  primaryHref={value.showcase.primaryHref}
                  secondaryLabel={showcase.text.secondaryLabel}
                  secondaryHref={value.showcase.secondaryHref}
                  photoUrl={photoUrl(value.showcase.photo, HOME_BUILTIN_MEDIA.showcase)}
                  photoAlt={showcase.text.photoAlt}
                  flip={rtl && value.showcase.photo === null}
                  link={inertLink}
                />
                <BrandStoryView
                  eyebrow={story.text.eyebrow}
                  heading={story.text.heading}
                  body={story.text.body}
                  buttonLabel={story.text.buttonLabel}
                  buttonHref={value.story.buttonHref}
                  photoUrl={resolvedUrl(value.story.photo)}
                  videoUrl={
                    value.story.photo && value.story.video
                      ? getContentVideoUrl(value.story.video)
                      : null
                  }
                  link={inertLink}
                />
              </NextIntlClientProvider>
            </div>
          </div>
        </div>
      </div>
      {rtl && <style>{RTL_CSS}</style>}
    </>,
    document.body,
  );
}
