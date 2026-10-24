"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import HomePopupView from "@/components/layout/HomePopupView";
import { PopupNewsletterFields } from "@/components/home/NewsletterForm";
import {
  resolvePopupCopy,
  type HomePopupButtonColor,
  type HomePopupPurpose,
  type HomePopupTheme,
  type PopupCopyRow,
} from "@/lib/utils/home-popup";

const RTL_CLASS = "home-popup-preview-rtl";

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

export interface PopupSignupLabels {
  placeholder: string;
  consentPrefix: string;
  consentLink: string;
  consentSuffix: string;
}

export type PreviewLang = "En" | "Ar" | "Ru";

const LANG_OPTIONS: { key: PreviewLang; label: string; locale: string }[] = [
  { key: "En", label: "English", locale: "en" },
  { key: "Ar", label: "Arabic", locale: "ar" },
  { key: "Ru", label: "Russian", locale: "ru" },
];

const BLANK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/>";

interface Props {
  values: PopupCopyRow;
  imageSrc: string | null;
  theme: HomePopupTheme;
  buttonColor: HomePopupButtonColor;
  purpose: HomePopupPurpose;
  signupLabels: Record<"en" | "ar" | "ru", PopupSignupLabels>;
  initialLang: PreviewLang;
  onClose: () => void;
}

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

export default function HomePopupPreview({
  values,
  imageSrc,
  theme,
  buttonColor,
  purpose,
  signupLabels,
  initialLang,
  onClose,
}: Props) {
  const [lang, setLang] = useState<PreviewLang>(initialLang);
  const headingId = useId();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const option = LANG_OPTIONS.find((o) => o.key === lang) ?? LANG_OPTIONS[0];
  const copy = resolvePopupCopy(values, option.locale);
  const rtl = option.locale === "ar" && !copy.fallback;
  const src = imageSrc || BLANK_IMAGE;
  const signup = signupLabels[copy.fallback ? "en" : (option.locale as "en" | "ar" | "ru")];

  return createPortal(
    <>
      <div className={rtl ? RTL_CLASS : undefined} data-surface="storefront">
        <HomePopupView
          headingId={headingId}
          title={copy.title ?? ""}
          body={copy.subtitle ?? ""}
          imageUrl={src}
          unoptimized={src.startsWith("blob:") || src.startsWith("data:")}
          theme={theme}
          buttonColor={buttonColor}
          closeLabel="Close"
          dismissLabel="No thanks"
          onClose={onClose}
          ctaLabel={copy.cta ?? ""}
          cta={
            purpose === "newsletter" ? (
              <div className="mt-6">
                <PopupNewsletterFields
                  inert
                  tone={theme}
                  placeholder={signup.placeholder}
                  buttonLabel={copy.cta ?? ""}
                  buttonColor={buttonColor}
                  consentPrefix={signup.consentPrefix}
                  privacyLink={
                    <span style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}>
                      {signup.consentLink}
                    </span>
                  }
                  consentSuffix={signup.consentSuffix}
                />
              </div>
            ) : undefined
          }
          dir={rtl ? "rtl" : "ltr"}
          lang={copy.fallback ? "en" : option.locale}
        />
      </div>
      {rtl && <style>{RTL_CSS}</style>}
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInline: 0,
          zIndex: "var(--z-toast)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem 1.25rem",
          padding: "0.625rem 1rem",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          {LANG_OPTIONS.map((o) =>
            o.key === lang ? (
              <button
                key={o.key}
                type="button"
                aria-pressed="true"
                style={{
                  height: "1.75rem",
                  paddingInline: "0.75rem",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-bold)",
                  backgroundColor: "#0b0b0b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            ) : (
              <button
                key={o.key}
                type="button"
                aria-pressed="false"
                onClick={() => setLang(o.key)}
                style={linkStyle}
              >
                {o.label}
              </button>
            ),
          )}
        </div>
        {copy.fallback && (
          <p
            role="status"
            style={{
              margin: 0,
              flex: "1 1 16rem",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-label-text)",
            }}
          >
            {option.label} visitors see English until the {option.label} heading
            and button text are filled.
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
    </>,
    document.body,
  );
}
