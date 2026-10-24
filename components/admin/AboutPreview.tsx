"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import AboutSectionsView from "@/components/pages/AboutSectionsView";
import { toAboutView } from "@/lib/utils/about-view";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import {
  isAboutLocaleComplete,
  type AboutFigureCounts,
  type AboutLocale,
  type AboutPageValue,
} from "@/lib/settings/about-page";

const RTL_CLASS = "about-preview-rtl";

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

export type AboutPreviewLabels = {
  visitEyebrow: string;
  visitTitle: string;
  contactCta: string;
  previous: string;
  next: string;
  close: string;
  photoLabel: string;
  englishOnly: string;
};

const LANG_OPTIONS: { key: AboutLocale; label: string }[] = [
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

interface Props {
  value: AboutPageValue;
  urls: Record<string, string>;
  counts: AboutFigureCounts;
  labels: Record<AboutLocale, AboutPreviewLabels>;
  initialLang: AboutLocale;
  onClose: () => void;
}

export default function AboutPreview({
  value,
  urls,
  counts,
  labels,
  initialLang,
  onClose,
}: Props) {
  const [lang, setLang] = useState<AboutLocale>(initialLang);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const option = LANG_OPTIONS.find((o) => o.key === lang) ?? LANG_OPTIONS[0];
  const complete = isAboutLocaleComplete(value, lang);
  const bodyLocale: AboutLocale = complete ? lang : "en";
  const bodyLabels = labels[bodyLocale];
  const rtl = bodyLocale === "ar";

  const view = toAboutView(value, bodyLocale, {
    urlOf: (key) => urls[key] ?? getContentImageUrl(key) ?? getImageUrl(key),
    counts,
  });

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
          {!complete && lang !== "en" && (
            <p
              role="status"
              style={{
                margin: 0,
                flex: "1 1 16rem",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-auth-label-text)",
              }}
            >
              {option.label} visitors see English until every shown section is
              complete in {option.label}.
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
          <AboutSectionsView
            view={view}
            locale={bodyLocale}
            labels={{
              visitEyebrow: bodyLabels.visitEyebrow,
              visitTitle: bodyLabels.visitTitle,
              close: bodyLabels.close,
              previous: bodyLabels.previous,
              next: bodyLabels.next,
              photoLabel: bodyLabels.photoLabel,
            }}
            contactSlot={
              <span
                className="btn-link btn-link--outline btn-link--md"
                aria-disabled="true"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                {bodyLabels.contactCta}
                <ArrowRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />
              </span>
            }
            visitSlot={
              view.visit ? (
                <div
                  style={{
                    border: "1px solid var(--color-shop-divider)",
                    padding: "48px",
                    color: "var(--color-content-tertiary)",
                    fontSize: "var(--text-body)",
                  }}
                >
                  Your main store from Store Locations shows here.
                </div>
              ) : undefined
            }
          />
        </div>
      </div>
      {rtl && <style>{RTL_CSS}</style>}
    </>,
    document.body,
  );
}
