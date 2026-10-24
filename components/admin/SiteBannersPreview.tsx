"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import AnnouncementBarView from "@/components/layout/AnnouncementBarView";
import MegaPanelPhoto from "@/components/layout/MegaPanelPhoto";
import ShopHero from "@/components/shop/ShopHero";
import type { LinkSlot } from "@/components/home/link-slot";
import { focalPosition, type FocalPoint } from "@/lib/utils/focal-point";
import {
  announcementCopy,
  type SiteBannersValue,
  type SiteLocale,
} from "@/lib/settings/site-banners";

const RTL_CLASS = "site-preview-rtl";

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

export type SiteBannersLabels = {
  shippingText: string | null;
  dealer: string;
  stores: string;
  allProducts: string;
  riflesLabel: string;
  shopAll: string;
};

const LANG_OPTIONS: { key: SiteLocale; label: string }[] = [
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

export const inertLink: LinkSlot = (p) => (
  <span className={p.className} style={p.style} aria-disabled="true">
    {p.children}
  </span>
);

function pageHeroOverlay(rtl: boolean): string {
  const mix = (percent: number) =>
    `color-mix(in srgb, var(--primitive-black) ${percent}%, transparent)`;
  return `linear-gradient(${rtl ? "270deg" : "90deg"}, ${mix(85)} 0%, ${mix(55)} 50%, ${mix(20)} 100%)`;
}

function PageHeroFrame({
  imageSrc,
  focus,
  rtl,
  children,
}: {
  imageSrc: string;
  focus: FocalPoint;
  rtl: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden px-6 pt-9 pb-14 lg:px-24"
      style={{
        background: "var(--primitive-black)",
        minHeight: "450px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: focalPosition(focus) }}
      />
      <div
        className="absolute inset-0"
        style={{ background: pageHeroOverlay(rtl) }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

interface Props {
  value: SiteBannersValue;
  shopPhotoSrc: string;
  menuPhotoSrc: string;
  pagesHeroSrc: string;
  storesHeroSrc: string;
  labels: Record<SiteLocale, SiteBannersLabels>;
  initialLang: SiteLocale;
  onClose: () => void;
}

export default function SiteBannersPreview({
  value,
  shopPhotoSrc,
  menuPhotoSrc,
  pagesHeroSrc,
  storesHeroSrc,
  labels,
  initialLang,
  onClose,
}: Props) {
  const [lang, setLang] = useState<SiteLocale>(initialLang);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const option = LANG_OPTIONS.find((o) => o.key === lang) ?? LANG_OPTIONS[0];
  const l = labels[lang];
  const rtl = lang === "ar";
  const copy = announcementCopy(value, lang);

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
          {copy?.fallback && (
            <p
              role="status"
              style={{
                margin: 0,
                flex: "1 1 16rem",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-auth-label-text)",
              }}
            >
              {option.label} visitors see the English message until it is filled in{" "}
              {option.label}.
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
            <AnnouncementBarView
              shippingText={l.shippingText}
              message={copy?.text ?? l.dealer}
              messageHref={copy?.href || null}
              storesLabel={l.stores}
              link={inertLink}
            />
            <div style={{ height: "1px", backgroundColor: "var(--color-border-default)" }} />
            <ShopHero imageSrc={shopPhotoSrc} focus={value.focus.shopPhoto}>
              <h1
                className="text-heading-desktop font-bold tracking-widest uppercase text-center"
                style={{ color: "var(--color-content-primary)" }}
              >
                {l.allProducts}
              </h1>
              <div
                style={{
                  width: "100px",
                  height: "2px",
                  backgroundColor: "var(--color-action-primary)",
                }}
              />
            </ShopHero>
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "var(--color-surface-sunken)",
              }}
            >
              <div
                className="group relative block overflow-hidden"
                style={{
                  width: "280px",
                  aspectRatio: "4 / 3",
                  backgroundColor: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                <MegaPanelPhoto
                  imageUrl={menuPhotoSrc}
                  focus={value.focus.menuPhoto}
                  label={l.riflesLabel}
                  allLabel={l.shopAll}
                  show
                />
              </div>
            </div>
            <PageHeroFrame imageSrc={pagesHeroSrc} focus={value.focus.pagesHero} rtl={rtl}>
              <h1
                className="text-heading-desktop font-bold tracking-widest uppercase"
                style={{ color: "var(--primitive-white)" }}
              >
                Customer care page
              </h1>
            </PageHeroFrame>
            <PageHeroFrame imageSrc={storesHeroSrc} focus={value.focus.storesHero} rtl={rtl}>
              <h1
                className="text-heading-desktop font-bold tracking-widest uppercase"
                style={{ color: "var(--primitive-white)" }}
              >
                {l.stores}
              </h1>
            </PageHeroFrame>
          </div>
        </div>
      </div>
      {rtl && <style>{RTL_CSS}</style>}
    </>,
    document.body,
  );
}
