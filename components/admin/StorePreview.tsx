"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  StoreBlockView,
  type StoreBlockLabels,
} from "@/components/pages/StoreBlockView";
import {
  STORE_DAYS,
  TIME_PATTERN,
  parseMapPin,
  type StoreDay,
  type StoreHours,
} from "@/lib/utils/stores";
import type { PublicStore } from "@/lib/db/queries/stores";

const RTL_CLASS = "store-preview-rtl";

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

type Locale = "en" | "ar" | "ru";

export type StorePreviewLabels = Omit<
  StoreBlockLabels,
  "until" | "opensToday" | "opensOn"
> & {
  until: string;
  opensToday: string;
  opensOn: string;
};

export interface StorePreviewValues {
  nameEn: string;
  nameAr: string;
  nameRu: string;
  addressEn: string;
  addressAr: string;
  addressRu: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionRu: string;
  hoursNoteEn: string;
  hoursNoteAr: string;
  hoursNoteRu: string;
  phone: string;
  email: string;
  pin: string;
  showHours: boolean;
  hours: Record<StoreDay, { closed: boolean; open: string; close: string }>;
  isPrimary: boolean;
}

const LANG_OPTIONS: { key: Locale; label: string }[] = [
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

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function toHours(values: StorePreviewValues): StoreHours | null {
  if (!values.showHours) return null;
  const result = {} as StoreHours;
  for (const day of STORE_DAYS) {
    const d = values.hours[day];
    if (d.closed) {
      result[day] = null;
      continue;
    }
    if (!TIME_PATTERN.test(d.open) || !TIME_PATTERN.test(d.close)) return null;
    result[day] = { open: d.open, close: d.close };
  }
  return result;
}

function toStore(values: StorePreviewValues): PublicStore | null {
  const pin = parseMapPin(values.pin);
  if (!pin) return null;
  return {
    id: "preview",
    nameEn: values.nameEn.trim(),
    nameAr: orNull(values.nameAr),
    nameRu: orNull(values.nameRu),
    addressEn: values.addressEn.trim(),
    addressAr: orNull(values.addressAr),
    addressRu: orNull(values.addressRu),
    descriptionEn: orNull(values.descriptionEn),
    descriptionAr: orNull(values.descriptionAr),
    descriptionRu: orNull(values.descriptionRu),
    hoursNoteEn: orNull(values.hoursNoteEn),
    hoursNoteAr: orNull(values.hoursNoteAr),
    hoursNoteRu: orNull(values.hoursNoteRu),
    latitude: pin.latitude,
    longitude: pin.longitude,
    phone: orNull(values.phone),
    email: orNull(values.email),
    isPrimary: values.isPrimary,
    hours: toHours(values),
  };
}

interface Props {
  values: StorePreviewValues;
  labels: Record<Locale, StorePreviewLabels>;
  initialLang: Locale;
  onClose: () => void;
}

export default function StorePreview({ values, labels, initialLang, onClose }: Props) {
  const [lang, setLang] = useState<Locale>(initialLang);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const store = useMemo(() => toStore(values), [values]);
  const rtl = lang === "ar";
  const text = labels[lang];

  const blockLabels: StoreBlockLabels = {
    ...text,
    until: (time) => fill(text.until, { time }),
    opensToday: (time) => fill(text.opensToday, { time }),
    opensOn: (day, time) => fill(text.opensOn, { day, time }),
  };

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
          dir={rtl ? "rtl" : "ltr"}
          lang={lang}
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#ffffff",
            padding: "1.5rem",
          }}
        >
          {store ? (
            <StoreBlockView store={store} locale={lang} labels={blockLabels} />
          ) : (
            <div
              style={{
                border: "1px solid var(--color-shop-divider)",
                padding: "48px",
                color: "var(--color-content-tertiary)",
                fontSize: "var(--text-body)",
              }}
            >
              Add a valid map pin to preview this showroom.
            </div>
          )}
        </div>
      </div>
      {rtl && <style>{RTL_CSS}</style>}
    </>,
    document.body,
  );
}
