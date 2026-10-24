"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import SiteBannersPreview, {
  inertLink,
  type SiteBannersLabels,
} from "@/components/admin/SiteBannersPreview";
import AnnouncementBarView from "@/components/layout/AnnouncementBarView";
import MegaPanelPhoto from "@/components/layout/MegaPanelPhoto";
import ShopHero from "@/components/shop/ShopHero";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import {
  saveSiteBannersAction,
  uploadSiteBannerPhotoAction,
} from "@/lib/actions/site-banners";
import {
  SITE_LIMITS,
  SITE_LOCALES,
  announcementCopy,
  announcementState,
  defaultBannerFocus,
  type AnnouncementState,
  type SiteBannersValue,
  type SiteLocale,
} from "@/lib/settings/site-banners";
import { getContentImageUrl } from "@/lib/utils/images";
import { focalPosition, type FocalPoint } from "@/lib/utils/focal-point";

type Tab = "announcement" | "shop" | "menu" | "pages";
type PhotoSlot = "shopPhoto" | "menuPhoto" | "pagesHero" | "storesHero";

const TABS: { id: Tab; label: string }[] = [
  { id: "announcement", label: "Announcement bar" },
  { id: "shop", label: "Shop banner" },
  { id: "menu", label: "Rifles menu photo" },
  { id: "pages", label: "Customer care pages" },
];

interface Props {
  initial: SiteBannersValue;
  saved: boolean;
  legacy: boolean;
  savedAt: string | null;
  today: string;
  initialUrls: Record<string, string>;
  builtIn: { shop: string; menu: string; pages: string; stores: string };
  labels: Record<SiteLocale, SiteBannersLabels>;
}

const LOCALE_NAME: Record<SiteLocale, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const STATE_CHIP: Record<AnnouncementState, { tone: "green" | "grey"; label: string }> = {
  showing: { tone: "green", label: "Showing now" },
  scheduled: { tone: "grey", label: "Scheduled" },
  ended: { tone: "grey", label: "Ended" },
  none: { tone: "grey", label: "Built-in line" },
};

const SHOP_SPEC =
  "Wide, at least 2400 × 700 px. JPEG, PNG or WebP, up to 4 MB. The focus point stays in view at every screen size.";
const MENU_SPEC = "4:3, at least 800 × 600 px. JPEG, PNG or WebP, up to 4 MB.";
const PAGES_SPEC =
  "Wide, at least 2400 × 900 px. JPEG, PNG or WebP, up to 4 MB. Dark photos read best behind the white title.";

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "var(--color-auth-label-text)",
};

const hintStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
  margin: 0,
};

const errorStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-error-text)",
  margin: 0,
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "var(--color-auth-input-text)",
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1.5px solid var(--color-auth-input-border)",
  borderRadius: "var(--radius-none)",
  outline: "none",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "0",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.875rem",
  minWidth: 0,
};

function formatSavedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}

function Chip({ tone, children }: { tone: "green" | "grey"; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.125rem 0.625rem",
        fontSize: "var(--text-body-sm)",
        fontWeight: "var(--font-semibold)",
        backgroundColor: tone === "green" ? "#dcfce7" : "#f3f4f6",
        color: tone === "green" ? "#166534" : "#374151",
      }}
    >
      {children}
    </span>
  );
}

const SHOP_STRIP_HEIGHT = 350;
const PAGE_HERO_HEIGHT = 450;
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1440;

function CropFrame({
  src,
  point,
  caption,
  aspectRatio,
  width,
}: {
  src: string;
  point: FocalPoint;
  caption: string;
  aspectRatio: string;
  width?: string;
}) {
  return (
    <figure
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        ...(width ? { width, flex: "none" } : { flex: 1, minWidth: 0 }),
      }}
    >
      <div
        style={{
          aspectRatio,
          width: "100%",
          overflow: "hidden",
          border: "1px solid var(--color-border-default)",
          backgroundColor: "var(--color-surface-raised)",
        }}
      >
        <img
          src={src}
          alt=""
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: focalPosition(point),
          }}
        />
      </div>
      <figcaption style={hintStyle}>{caption}</figcaption>
    </figure>
  );
}

function LiveCrop({
  src,
  point,
  height,
}: {
  src: string;
  point: FocalPoint;
  height: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <span style={labelStyle}>Live crop</span>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        <CropFrame
          src={src}
          point={point}
          caption="Desktop"
          aspectRatio={`${DESKTOP_WIDTH} / ${height}`}
        />
        <CropFrame
          src={src}
          point={point}
          caption="Phone"
          aspectRatio={`${PHONE_WIDTH} / ${height}`}
          width="120px"
        />
      </div>
    </div>
  );
}

function locateError(path: string): { tab: Tab; locale?: SiteLocale } {
  const parts = path.split(".");
  const slot = parts[0] === "focus" ? parts[1] : parts[0];
  if (slot === "shopPhoto") return { tab: "shop" };
  if (slot === "menuPhoto") return { tab: "menu" };
  if (slot === "pagesHero" || slot === "storesHero") return { tab: "pages" };
  if (parts[1] === "message" && (parts[2] === "en" || parts[2] === "ar" || parts[2] === "ru")) {
    return { tab: "announcement", locale: parts[2] };
  }
  if (parts[1] === "href") return { tab: "announcement", locale: "en" };
  return { tab: "announcement" };
}

function TextField({
  id,
  label,
  hint,
  value,
  max,
  rows,
  dir,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  rows?: number;
  dir?: "rtl" | "ltr";
  error?: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const over = value.length > max;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
        <label htmlFor={id} style={labelStyle}>
          {label}
        </label>
        <span
          style={{
            fontSize: "var(--text-body-sm)",
            color: over ? "var(--color-auth-error-text)" : "var(--color-content-tertiary)",
          }}
        >
          {value.length} / {max}
        </span>
      </div>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          dir={dir}
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, resize: "vertical", opacity: disabled ? 0.5 : 1 }}
        />
      ) : (
        <input
          id={id}
          type="text"
          dir={dir}
          value={value}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, opacity: disabled ? 0.5 : 1 }}
        />
      )}
      {error ? (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      ) : hint ? (
        <p style={hintStyle}>{hint}</p>
      ) : null}
    </div>
  );
}

export default function SiteBannersEditor({
  initial,
  saved: initialSaved,
  legacy,
  savedAt: initialSavedAt,
  today,
  initialUrls,
  builtIn,
  labels,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = useState<SiteBannersValue>(initial);
  const [baseline, setBaseline] = useState<SiteBannersValue>(initial);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [tab, setTab] = useState<Tab>("announcement");
  const [lang, setLang] = useState<SiteLocale>("en");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string | undefined>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const dirty = JSON.stringify(value) !== JSON.stringify(baseline);
  const busy = saving || uploading;
  const rtl = lang === "ar" ? ("rtl" as const) : undefined;

  useUnsavedGuard(dirty);

  function update(mutate: (draft: SiteBannersValue) => void) {
    setValue((v) => {
      const next = structuredClone(v);
      mutate(next);
      return next;
    });
    setFormError(null);
    setErrors({});
  }

  function errorOf(path: string): string | undefined {
    return errors[path]?.[0];
  }

  function urlOf(key: string | null, fallback: string): string {
    if (!key) return fallback;
    return urls[key] ?? getContentImageUrl(key) ?? fallback;
  }

  async function handlePhoto(slot: PhotoSlot, files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setPhotoErrors((e) => ({ ...e, [slot]: undefined }));
    const fd = new FormData();
    fd.set("image", file);
    let outcome: { key: string; url: string } | { error: string };
    try {
      const result = await uploadSiteBannerPhotoAction(fd);
      outcome = result.success
        ? { key: result.key, url: result.url }
        : { error: result.error };
    } catch {
      outcome = { error: "Failed to upload image. Please try again." };
    }
    if ("error" in outcome) {
      setPhotoErrors((e) => ({ ...e, [slot]: outcome.error }));
    } else {
      setUrls((u) => ({ ...u, [outcome.key]: outcome.url }));
      update((d) => {
        d[slot] = outcome.key;
        d.focus[slot] = defaultBannerFocus()[slot];
      });
    }
    setUploading(false);
  }

  function focusProps(slot: PhotoSlot) {
    return {
      focus: value.focus[slot],
      focusDefault: defaultBannerFocus()[slot],
      onFocusChange: (p: FocalPoint) =>
        update((d) => {
          d.focus[slot] = p;
        }),
    };
  }

  function focusFirstError(fieldErrors: Record<string, string[]>) {
    const first = Object.keys(fieldErrors)[0];
    if (!first) return;
    const where = locateError(first);
    setTab(where.tab);
    if (where.locale) setLang(where.locale);
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await saveSiteBannersAction(value);

    if (result.success) {
      toast.success("Site banners saved.");
      setBaseline(value);
      setIsSaved(true);
      setSavedAt(new Date().toISOString());
      router.refresh();
    } else if (
      (result.errorCode === "VALIDATION_ERROR" || result.errorCode === "PHOTO_MISSING") &&
      result.fieldErrors
    ) {
      setErrors(result.fieldErrors);
      focusFirstError(result.fieldErrors);
      if (result.errorCode !== "VALIDATION_ERROR") setFormError(result.error);
    } else if (result.errorCode === "NO_CHANGES") {
      setFormError(result.error);
    } else {
      toast.error(result.error);
    }

    setSaving(false);
  }

  function handleDiscard() {
    setValue(baseline);
    setErrors({});
    setFormError(null);
    setPhotoErrors({});
  }

  const languageSwitch = (
    <div role="tablist" aria-label="Language" style={{ display: "flex", gap: "0.5rem" }}>
      {SITE_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={lang === l}
          onClick={() => setLang(l)}
          style={{
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
            opacity: lang === l ? 1 : 0.45,
          }}
        >
          {LOCALE_NAME[l]}
        </button>
      ))}
    </div>
  );


  const announcement = value.announcement;
  const state = announcementState(value, today);
  const chip = STATE_CHIP[state];
  const copy = announcementCopy(value, lang);
  const shippingText = labels[lang].shippingText;
  const shopSrc = urlOf(value.shopPhoto, builtIn.shop);
  const menuSrc = urlOf(value.menuPhoto, builtIn.menu);
  const pagesSrc = urlOf(value.pagesHero, builtIn.pages);
  const storesSrc = urlOf(value.storesHero, builtIn.stores);

  function renderAnnouncement() {
    return (
      <>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
              }}
            >
              How the bar looks
            </h3>
            <Chip tone={chip.tone}>{chip.label}</Chip>
          </div>
          <div
            dir={rtl ?? "ltr"}
            lang={lang}
            data-surface="storefront"
            style={{ backgroundColor: "var(--primitive-black)" }}
          >
            <AnnouncementBarView
              shippingText={shippingText}
              message={copy?.text ?? labels[lang].dealer}
              messageHref={copy?.href || null}
              storesLabel={labels[lang].stores}
              link={inertLink}
            />
          </div>
          <p style={hintStyle}>
            {shippingText === null
              ? "No free-shipping line shows now: the UAE zone grants no free shipping."
              : "The free-shipping part is automatic. It follows the UAE zone in Shipping and disappears when that zone has no free shipping."}
          </p>
        </div>

        <div style={cardStyle}>
          {languageSwitch}
          <TextField
            id={`site-announcement.message.${lang}`}
            label="Your message"
            hint={'Up to 80 characters. Leave empty to show the built-in line "Licensed UAE dealer". Arabic and Russian show English until filled.'}
            value={announcement.message[lang]}
            max={SITE_LIMITS.message}
            dir={rtl}
            disabled={busy}
            error={errorOf(`announcement.message.${lang}`)}
            onChange={(next) =>
              update((d) => {
                d.announcement.message[lang] = next;
              })
            }
          />
          {lang === "en" && (
            <TextField
              id="site-announcement.href"
              label="Link"
              hint="Optional. Makes the message a link, such as /shop/optics."
              value={announcement.href}
              max={SITE_LIMITS.href}
              dir="ltr"
              disabled={busy}
              error={errorOf("announcement.href")}
              onChange={(next) =>
                update((d) => {
                  d.announcement.href = next;
                })
              }
            />
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
              gap: "0.875rem",
            }}
          >
            <Input
              id="site-announcement-starts"
              label="Show from"
              type="date"
              value={announcement.startsOn}
              onChange={(e) =>
                update((d) => {
                  d.announcement.startsOn = e.target.value;
                })
              }
              disabled={busy}
              error={errorOf("announcement.startsOn")}
              hint="Dubai date. Empty means now."
            />
            <Input
              id="site-announcement-ends"
              label="Show until"
              type="date"
              value={announcement.endsOn}
              onChange={(e) =>
                update((d) => {
                  d.announcement.endsOn = e.target.value;
                })
              }
              disabled={busy}
              error={errorOf("announcement.endsOn")}
              hint="Dubai date, through the whole day. Empty means no end."
            />
          </div>
          <p style={hintStyle}>Outside these dates the bar shows the built-in line.</p>
        </div>
      </>
    );
  }

  function renderShop() {
    return (
      <div style={cardStyle}>
        <AdminPhotoField
          name="Shop banner photo"
          purpose="The wide strip at the top of every shop and category page, behind the page title."
          spec={SHOP_SPEC}
          previewUrl={shopSrc}
          onSelect={(files) => {
            void handlePhoto("shopPhoto", files);
          }}
          busy={busy}
          error={photoErrors.shopPhoto ?? errorOf("shopPhoto") ?? null}
          {...focusProps("shopPhoto")}
          onRemove={
            value.shopPhoto
              ? () =>
                  update((d) => {
                    d.shopPhoto = null;
                    d.focus.shopPhoto = defaultBannerFocus().shopPhoto;
                  })
              : undefined
          }
        />
        <LiveCrop src={shopSrc} point={value.focus.shopPhoto} height={SHOP_STRIP_HEIGHT} />
        <div data-surface="storefront" style={{ width: "100%" }}>
          <ShopHero imageSrc={shopSrc} focus={value.focus.shopPhoto}>
            <h3
              className="text-heading-desktop font-bold tracking-widest uppercase text-center"
              style={{ color: "var(--color-content-primary)", margin: 0 }}
            >
              {labels.en.allProducts}
            </h3>
            <div
              style={{
                width: "100px",
                height: "2px",
                backgroundColor: "var(--color-action-primary)",
              }}
            />
          </ShopHero>
        </div>
      </div>
    );
  }

  function renderMenu() {
    return (
      <div style={cardStyle}>
        <AdminPhotoField
          name="Rifles menu photo"
          purpose="Shown beside the list when Rifles opens in the main menu."
          spec={MENU_SPEC}
          previewUrl={menuSrc}
          onSelect={(files) => {
            void handlePhoto("menuPhoto", files);
          }}
          busy={busy}
          error={photoErrors.menuPhoto ?? errorOf("menuPhoto") ?? null}
          {...focusProps("menuPhoto")}
          onRemove={
            value.menuPhoto
              ? () =>
                  update((d) => {
                    d.menuPhoto = null;
                    d.focus.menuPhoto = defaultBannerFocus().menuPhoto;
                  })
              : undefined
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <span style={labelStyle}>Live crop</span>
          <CropFrame
            src={menuSrc}
            point={value.focus.menuPhoto}
            caption="Menu panel"
            aspectRatio="4 / 3"
            width="280px"
          />
        </div>
        <div data-surface="storefront" style={{ backgroundColor: "var(--color-surface-sunken)", padding: "1.5rem" }}>
          <div
            className="group relative block overflow-hidden"
            style={{
              width: "280px",
              maxWidth: "100%",
              aspectRatio: "4 / 3",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <MegaPanelPhoto
              imageUrl={menuSrc}
              focus={value.focus.menuPhoto}
              label={labels.en.riflesLabel}
              allLabel={labels.en.shopAll}
              show
            />
          </div>
        </div>
      </div>
    );
  }

  function renderPages() {
    return (
      <div style={cardStyle}>
        <AdminPhotoField
          name="Page header photo"
          purpose="Used on About, Contact, FAQ, Shipping, Returns, Privacy and Terms."
          spec={PAGES_SPEC}
          previewUrl={pagesSrc}
          onSelect={(files) => {
            void handlePhoto("pagesHero", files);
          }}
          busy={busy}
          error={photoErrors.pagesHero ?? errorOf("pagesHero") ?? null}
          {...focusProps("pagesHero")}
          onRemove={
            value.pagesHero
              ? () =>
                  update((d) => {
                    d.pagesHero = null;
                    d.focus.pagesHero = defaultBannerFocus().pagesHero;
                  })
              : undefined
          }
        />
        <LiveCrop src={pagesSrc} point={value.focus.pagesHero} height={PAGE_HERO_HEIGHT} />
        <AdminPhotoField
          name="Stores page photo"
          purpose="The header photo of the Our Stores page."
          spec={PAGES_SPEC}
          previewUrl={storesSrc}
          onSelect={(files) => {
            void handlePhoto("storesHero", files);
          }}
          busy={busy}
          error={photoErrors.storesHero ?? errorOf("storesHero") ?? null}
          {...focusProps("storesHero")}
          onRemove={
            value.storesHero
              ? () =>
                  update((d) => {
                    d.storesHero = null;
                    d.focus.storesHero = defaultBannerFocus().storesHero;
                  })
              : undefined
          }
        />
        <LiveCrop src={storesSrc} point={value.focus.storesHero} height={PAGE_HERO_HEIGHT} />
      </div>
    );
  }

  return (
    <ContentPageFrame
      backHref="/admin"
      backLabel="Back to Dashboard"
      title="Site Banners"
      status={isSaved ? { label: "Live", tone: "green" } : { label: "Built-in", tone: "grey" }}
      path="/shop"
      liveHref="/en/shop"
      purpose="The thin strip above the menu on every page, the photo at the top of the shop, and the photo in the Rifles menu."
      sketch="siteBanners"
      tabs={TABS}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
    >
      {legacy && (
        <div
          role="status"
          style={{
            padding: "0.625rem 0.875rem",
            fontSize: "var(--text-body-sm)",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
          }}
        >
          These banners were saved by an earlier version of this editor and can&apos;t be
          read. The site shows the built-in content until you save.
        </div>
      )}

      {tab === "announcement" && renderAnnouncement()}
      {tab === "shop" && renderShop()}
      {tab === "menu" && renderMenu()}
      {tab === "pages" && renderPages()}

      {formError && (
        <p role="alert" style={{ ...errorStyle, textAlign: "end" }}>
          {formError}
        </p>
      )}

      <ContentSaveBar
        savedLabel={
          isSaved && savedAt
            ? `Saved ${formatSavedAt(savedAt)} (Dubai time)`
            : "Not saved yet: the built-in content is live"
        }
        dirty={dirty}
        saveLabel="Save banners"
        onSave={() => {
          if (!uploading) void handleSave();
        }}
        saving={saving}
        onPreview={() => setPreviewOpen(true)}
        extra={
          dirty ? (
            <button type="button" onClick={handleDiscard} disabled={saving} style={linkBtn}>
              Discard
            </button>
          ) : undefined
        }
      />

      {previewOpen && (
        <SiteBannersPreview
          value={value}
          shopPhotoSrc={shopSrc}
          menuPhotoSrc={menuSrc}
          pagesHeroSrc={pagesSrc}
          storesHeroSrc={storesSrc}
          labels={labels}
          initialLang={lang}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </ContentPageFrame>
  );
}
