"use client";

import { useState } from "react";
import type { AbstractIntlMessages } from "next-intl";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import AdminVideoField from "@/components/admin/AdminVideoField";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import HomeFeaturedTab from "@/components/admin/HomeFeaturedTab";
import HomePagePreview, {
  type HomePreviewLabels,
  type HomePreviewSocials,
} from "@/components/admin/HomePagePreview";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import {
  prepareHomeVideoUploadAction,
  saveHomePageAction,
  uploadHomePhotoAction,
} from "@/lib/actions/home-page";
import { HOME_VIDEO_MAX_BYTES, HOME_VIDEO_TYPE } from "@/lib/settings/home-video";
import { uploadHomeVideo } from "@/lib/utils/video-upload";
import {
  HOME_LIMITS,
  HOME_BUILTIN_MEDIA,
  HOME_LOCALES,
  desertComplete,
  heroComplete,
  newsletterComplete,
  showcaseComplete,
  storyComplete,
  tilesComplete,
  type HomeLocale,
  type HomePageValue,
} from "@/lib/settings/home-page";
import { getContentImageUrl, getContentVideoUrl } from "@/lib/utils/images";
import { FEATURED_LIMITS } from "@/lib/utils/featured-collection";
import type {
  FeaturedEditorState,
  FeaturedPickerItem,
} from "@/lib/db/queries/collections";

type Tab = "hero" | "featured" | "tiles" | "desert" | "newsletter" | "showcase" | "story";
type PhotoSlot = "hero" | "desert" | "newsletter" | "showcase" | "story" | number;

const TABS: { id: Tab; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "featured", label: "Featured products" },
  { id: "tiles", label: "Collection tiles" },
  { id: "desert", label: "Video band" },
  { id: "newsletter", label: "Newsletter band" },
  { id: "showcase", label: "Rifle showcase" },
  { id: "story", label: "Brand story" },
];

const TAB_IDS: readonly string[] = TABS.map((t) => t.id);

interface Props {
  initial: HomePageValue;
  initialFeatured: FeaturedEditorState;
  pickerItems: FeaturedPickerItem[];
  saved: boolean;
  legacy: boolean;
  savedAt: string | null;
  initialUrls: Record<string, string>;
  builtInPhotos: { hero: string; tiles: string[] };
  labels: Record<HomeLocale, HomePreviewLabels>;
  socials: HomePreviewSocials;
  formMessages: Record<HomeLocale, AbstractIntlMessages>;
}

const LOCALE_NAME: Record<HomeLocale, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const PHOTO_SPEC_HERO =
  "Landscape, at least 2400 × 1350 px. JPEG, PNG or WebP, up to 4 MB. Keep the subject in the upper middle: phones show only the centre.";
const PHOTO_SPEC_TILE =
  "Portrait, at least 900 × 1200 px. JPEG, PNG or WebP, up to 4 MB.";

const VIDEO_PHOTO_NAME = "Photo";
const VIDEO_PHOTO_PURPOSE =
  "Shown in place of the built-in video. With a video below, it shows while the video loads.";
const VIDEO_PHOTO_SPEC = "JPEG, PNG or WebP, up to 4 MB. At least 1920 × 1080.";
const VIDEO_NAME = "Video";
const VIDEO_PURPOSE = "Plays over the photo, muted and on a loop.";
const VIDEO_SPEC = "MP4 (H.264), up to 20 MB. 1080p, no sound.";
const PHOTO_SPEC_NEWSLETTER = "JPEG, PNG or WebP, up to 4 MB. At least 1400 × 1200.";
const PHOTO_SPEC_SHOWCASE =
  "PNG, JPEG or WebP, up to 4 MB. At least 1600 × 900 (16:9). In Arabic the built-in rifle is mirrored to face the text; your photo is never mirrored.";

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

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
  gap: "0.875rem",
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

function locateError(path: string): { tab: Tab; locale?: HomeLocale } {
  const parts = path.split(".");
  if (parts[0] === "featured") {
    const l = parts[2];
    return parts[1] === "heading" && (l === "en" || l === "ar" || l === "ru")
      ? { tab: "featured", locale: l }
      : { tab: "featured" };
  }
  const tab: Tab = TAB_IDS.includes(parts[0]) ? (parts[0] as Tab) : "hero";
  const isLocale = (p: string | undefined): p is HomeLocale =>
    p === "en" || p === "ar" || p === "ru";
  const at = parts.indexOf("text");
  if (at >= 0 && isLocale(parts[at + 1])) {
    return { tab, locale: parts[at + 1] as HomeLocale };
  }
  if (
    parts.includes("primaryHref") ||
    parts.includes("secondaryHref") ||
    parts.includes("href") ||
    parts.includes("buttonHref")
  ) {
    return { tab, locale: "en" };
  }
  return { tab };
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

export default function HomePageEditor({
  initial,
  initialFeatured,
  pickerItems,
  saved: initialSaved,
  legacy,
  savedAt: initialSavedAt,
  initialUrls,
  builtInPhotos,
  labels,
  socials,
  formMessages,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = useState<HomePageValue>(initial);
  const [baseline, setBaseline] = useState<HomePageValue>(initial);
  const [featured, setFeatured] = useState<FeaturedEditorState>(initialFeatured);
  const [featuredBaseline, setFeaturedBaseline] =
    useState<FeaturedEditorState>(initialFeatured);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [tab, setTab] = useState<Tab>("hero");
  const [lang, setLang] = useState<HomeLocale>("en");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoSlot, setVideoSlot] = useState<"desert" | "story" | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoErrors, setVideoErrors] = useState<Record<string, string | undefined>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, string | undefined>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const featuredKey = (f: FeaturedEditorState) =>
    JSON.stringify({ shown: f.shown, heading: f.heading, skus: f.items.map((i) => i.sku) });
  const dirty =
    JSON.stringify(value) !== JSON.stringify(baseline) ||
    featuredKey(featured) !== featuredKey(featuredBaseline);
  const busy = saving || uploading || videoSlot !== null;
  const rtl = lang === "ar" ? ("rtl" as const) : undefined;
  const isEnglish = lang === "en";

  useUnsavedGuard(dirty);

  function update(mutate: (draft: HomePageValue) => void) {
    setValue((v) => {
      const next = structuredClone(v);
      mutate(next);
      return next;
    });
    setFormError(null);
    setErrors({});
  }

  function updateFeatured(mutate: (draft: FeaturedEditorState) => void) {
    setFeatured((f) => {
      const next = structuredClone(f);
      mutate(next);
      return next;
    });
    setFormError(null);
    setErrors({});
  }

  function errorOf(path: string): string | undefined {
    return errors[path]?.[0];
  }

  function urlOf(key: string, builtIn: string): string {
    return urls[key] ?? getContentImageUrl(key) ?? builtIn;
  }

  async function handlePhoto(slot: PhotoSlot, files: File[]) {
    const file = files[0];
    if (!file) return;
    const slotKey = typeof slot === "number" ? `tile${slot}` : slot;
    setUploading(true);
    setPhotoErrors((e) => ({ ...e, [slotKey]: undefined }));
    const fd = new FormData();
    fd.set("image", file);
    let outcome: { key: string; url: string } | { error: string };
    try {
      const result = await uploadHomePhotoAction(fd);
      outcome = result.success
        ? { key: result.key, url: result.url }
        : { error: result.error };
    } catch {
      outcome = { error: "Failed to upload image. Please try again." };
    }
    if ("error" in outcome) {
      setPhotoErrors((e) => ({ ...e, [slotKey]: outcome.error }));
    } else {
      setUrls((u) => ({ ...u, [outcome.key]: outcome.url }));
      update((d) => {
        if (typeof slot === "number") d.tiles[slot].photo = outcome.key;
        else d[slot].photo = outcome.key;
      });
    }
    setUploading(false);
  }

  async function handleVideo(slot: "desert" | "story", file: File) {
    setVideoErrors((e) => ({ ...e, [slot]: undefined }));
    if (file.type !== HOME_VIDEO_TYPE) {
      setVideoErrors((e) => ({ ...e, [slot]: "Upload an MP4 video." }));
      return;
    }
    if (file.size > HOME_VIDEO_MAX_BYTES) {
      setVideoErrors((e) => ({ ...e, [slot]: "Videos can be up to 20 MB." }));
      return;
    }
    setVideoSlot(slot);
    setVideoProgress(0);
    let key: string | null = null;
    let failure: string | null = null;
    try {
      const prepared = await prepareHomeVideoUploadAction({
        type: file.type,
        size: file.size,
      });
      if (!prepared.success) {
        failure = prepared.error;
      } else if (
        await uploadHomeVideo(prepared.data.signedUrl, file, setVideoProgress)
      ) {
        key = prepared.data.key;
      }
    } catch {
      key = null;
    }
    if (key) {
      const uploaded = key;
      update((d) => {
        d[slot].video = uploaded;
      });
    } else {
      setVideoErrors((e) => ({
        ...e,
        [slot]: failure ?? "The upload did not finish. Try again.",
      }));
    }
    setVideoSlot(null);
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

    const result = await saveHomePageAction({
      page: value,
      featured: {
        shown: featured.shown,
        heading: featured.heading,
        skus: featured.items.map((item) => item.sku),
      },
    });

    if (result.success) {
      toast.success("Homepage saved.");
      setBaseline(value);
      setFeaturedBaseline(featured);
      setIsSaved(true);
      setSavedAt(new Date().toISOString());
      router.refresh();
    } else if (
      (result.errorCode === "VALIDATION_ERROR" ||
        result.errorCode === "ENGLISH_REQUIRED" ||
        result.errorCode === "PHOTO_MISSING" ||
        result.errorCode === "VIDEO_NEEDS_PHOTO" ||
        result.errorCode === "VIDEO_INVALID" ||
        result.errorCode === "FEATURED_TOO_FEW" ||
        result.errorCode === "PRODUCT_NOT_LIVE") &&
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
    setFeatured(featuredBaseline);
    setErrors({});
    setFormError(null);
    setPhotoErrors({});
    setVideoErrors({});
  }

  const languageSwitch = (
    <div role="tablist" aria-label="Language" style={{ display: "flex", gap: "0.5rem" }}>
      {HOME_LOCALES.map((l) => (
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

  const completeFor = (l: HomeLocale) => {
    switch (tab) {
      case "hero":
        return heroComplete(value, l);
      case "featured":
        return featured.heading[l].trim() !== "";
      case "tiles":
        return tilesComplete(value, l);
      case "desert":
        return desertComplete(value, l);
      case "newsletter":
        return newsletterComplete(value, l);
      case "showcase":
        return showcaseComplete(value, l);
      case "story":
        return storyComplete(value, l);
    }
  };

  const completeness = (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
      {HOME_LOCALES.filter((l) => l !== "en").map((l) => (
        <p key={l} style={hintStyle}>
          {completeFor(l)
            ? `${LOCALE_NAME[l]}: complete`
            : `${LOCALE_NAME[l]}: visitors see English until every field here is filled`}
        </p>
      ))}
    </div>
  );

  const switchRow = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.75rem 1.5rem",
      }}
    >
      {languageSwitch}
      {completeness}
    </div>
  );

  const hero = value.hero;
  const heroText = hero.text[lang];
  const heroBase = `hero.text.${lang}`;

  function renderHero() {
    return (
      <>
        <div style={cardStyle}>
          {switchRow}
          <TextField
            id={`home-${heroBase}.eyebrow`}
            label="Small line above the headline"
            hint="A few words above the headline. Example: Dubai's Premier Licensed Dealer"
            value={heroText.eyebrow}
            max={HOME_LIMITS.heroEyebrow}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${heroBase}.eyebrow`)}
            onChange={(next) =>
              update((d) => {
                d.hero.text[lang].eyebrow = next;
              })
            }
          />
          <TextField
            id={`home-${heroBase}.heading`}
            label="Headline"
            hint="Press Enter for a new line (3 lines at most)."
            value={heroText.heading}
            max={HOME_LIMITS.heroHeading}
            rows={3}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${heroBase}.heading`)}
            onChange={(next) =>
              update((d) => {
                d.hero.text[lang].heading = next;
              })
            }
          />
          <div style={twoColumns}>
            <TextField
              id={`home-${heroBase}.primaryLabel`}
              label="Main button text"
              hint="The label on the red button. Example: Shop Rifles"
              value={heroText.primaryLabel}
              max={HOME_LIMITS.primaryLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${heroBase}.primaryLabel`)}
              onChange={(next) =>
                update((d) => {
                  d.hero.text[lang].primaryLabel = next;
                })
              }
            />
            {isEnglish && (
              <TextField
                id="home-hero.primaryHref"
                label="Main button link"
                hint="Shared by all languages. Example: /shop/optics"
                value={hero.primaryHref}
                max={HOME_LIMITS.href}
                dir="ltr"
                disabled={busy}
                error={errorOf("hero.primaryHref")}
                onChange={(next) =>
                  update((d) => {
                    d.hero.primaryHref = next;
                  })
                }
              />
            )}
          </div>
          <div style={twoColumns}>
            <TextField
              id={`home-${heroBase}.secondaryLabel`}
              label="Second link text"
              hint="Shown only while the second link is set. Example: Shop Optics"
              value={heroText.secondaryLabel}
              max={HOME_LIMITS.secondaryLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${heroBase}.secondaryLabel`)}
              onChange={(next) =>
                update((d) => {
                  d.hero.text[lang].secondaryLabel = next;
                })
              }
            />
            {isEnglish && (
              <TextField
                id="home-hero.secondaryHref"
                label="Second link"
                hint="Leave the link empty to hide it. Shared by all languages."
                value={hero.secondaryHref}
                max={HOME_LIMITS.href}
                dir="ltr"
                disabled={busy}
                error={errorOf("hero.secondaryHref")}
                onChange={(next) =>
                  update((d) => {
                    d.hero.secondaryHref = next;
                  })
                }
              />
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <AdminPhotoField
            name="Hero photo"
            purpose="Fills the whole first screen of the homepage, behind the headline."
            spec={PHOTO_SPEC_HERO}
            previewUrl={hero.photo ? urlOf(hero.photo, builtInPhotos.hero) : builtInPhotos.hero}
            onSelect={(files) => {
              void handlePhoto("hero", files);
            }}
            busy={busy}
            error={photoErrors.hero ?? errorOf("hero.photo") ?? null}
            onRemove={
              hero.photo
                ? () =>
                    update((d) => {
                      d.hero.photo = null;
                    })
                : undefined
            }
          />
          <TextField
            id={`home-${heroBase}.photoAlt`}
            label="Photo description"
            hint="Read aloud by screen readers."
            value={heroText.photoAlt}
            max={HOME_LIMITS.photoAlt}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${heroBase}.photoAlt`)}
            onChange={(next) =>
              update((d) => {
                d.hero.text[lang].photoAlt = next;
              })
            }
          />
        </div>
      </>
    );
  }

  function renderTiles() {
    return (
      <>
        <div style={cardStyle}>{switchRow}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))",
            gap: "1rem",
          }}
        >
          {value.tiles.map((tile, index) => {
            const base = `tiles.${index}.text.${lang}`;
            return (
              <div
                key={index}
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e8e8e8",
                  borderRadius: "0",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                  minWidth: 0,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--text-body-lg)",
                    fontWeight: "var(--font-bold)",
                    color: "#0b0b0b",
                  }}
                >
                  Tile {index + 1} · {tile.text.en.title}
                </h3>
                <AdminPhotoField
                  name={`Tile ${index + 1} photo`}
                  purpose="Fills the tile; the wording sits over the bottom."
                  spec={PHOTO_SPEC_TILE}
                  previewUrl={
                    tile.photo
                      ? urlOf(tile.photo, builtInPhotos.tiles[index])
                      : builtInPhotos.tiles[index]
                  }
                  onSelect={(files) => {
                    void handlePhoto(index, files);
                  }}
                  busy={busy}
                  error={photoErrors[`tile${index}`] ?? errorOf(`tiles.${index}.photo`) ?? null}
                  onRemove={
                    tile.photo
                      ? () =>
                          update((d) => {
                            d.tiles[index].photo = null;
                          })
                      : undefined
                  }
                />
                <TextField
                  id={`home-${base}.eyebrow`}
                  label="Small line above the title"
                  hint="A few words above the title. Example: Crystal Clear"
                  value={tile.text[lang].eyebrow}
                  max={HOME_LIMITS.tileEyebrow}
                  dir={rtl}
                  disabled={busy}
                  error={errorOf(`${base}.eyebrow`)}
                  onChange={(next) =>
                    update((d) => {
                      d.tiles[index].text[lang].eyebrow = next;
                    })
                  }
                />
                <TextField
                  id={`home-${base}.title`}
                  label="Title"
                  hint="The large word on the tile. Example: Optics"
                  value={tile.text[lang].title}
                  max={HOME_LIMITS.tileTitle}
                  dir={rtl}
                  disabled={busy}
                  error={errorOf(`${base}.title`)}
                  onChange={(next) =>
                    update((d) => {
                      d.tiles[index].text[lang].title = next;
                    })
                  }
                />
                {isEnglish && (
                  <TextField
                    id={`home-tiles.${index}.href`}
                    label="Link"
                    hint="Shared by all languages. Example: /shop/optics"
                    value={tile.href}
                    max={HOME_LIMITS.href}
                    dir="ltr"
                    disabled={busy}
                    error={errorOf(`tiles.${index}.href`)}
                    onChange={(next) =>
                      update((d) => {
                        d.tiles[index].href = next;
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        <p style={hintStyle}>The &quot;Shop now&quot; label stays built in.</p>
      </>
    );
  }

  function renderFeatured() {
    return (
      <HomeFeaturedTab
        shown={featured.shown}
        items={featured.items}
        pickerItems={pickerItems}
        switchRow={switchRow}
        headingField={
          <TextField
            id={`home-featured.heading.${lang}`}
            label="Heading"
            hint="The large title above the products. The small line above it stays as it is."
            value={featured.heading[lang]}
            max={FEATURED_LIMITS.heading}
            dir={rtl}
            disabled={busy}
            error={errorOf(`featured.heading.${lang}`)}
            onChange={(next) =>
              updateFeatured((d) => {
                d.heading[lang] = next;
              })
            }
          />
        }
        busy={busy}
        error={errorOf("featured.products")}
        onShownChange={(next) =>
          updateFeatured((d) => {
            d.shown = next;
          })
        }
        onMove={(index, step) =>
          updateFeatured((d) => {
            const [moved] = d.items.splice(index, 1);
            d.items.splice(index + step, 0, moved);
          })
        }
        onRemove={(index) =>
          updateFeatured((d) => {
            d.items.splice(index, 1);
          })
        }
        onAdd={(picked) =>
          updateFeatured((d) => {
            for (const item of picked) {
              d.items.push({ ...item, live: true, publishStatus: "PUBLISHED" });
            }
          })
        }
      />
    );
  }

  function renderVideoPhoto(slot: "desert" | "story") {
    const photo = value[slot].photo;
    const video = value[slot].video;
    return (
      <>
        <AdminPhotoField
          name={VIDEO_PHOTO_NAME}
          purpose={VIDEO_PHOTO_PURPOSE}
          spec={VIDEO_PHOTO_SPEC}
          previewUrl={photo ? urlOf(photo, "") || null : null}
          onSelect={(files) => {
            void handlePhoto(slot, files);
          }}
          busy={busy}
          error={photoErrors[slot] ?? errorOf(`${slot}.photo`) ?? null}
          onRemove={
            photo
              ? () =>
                  update((d) => {
                    d[slot].photo = null;
                  })
              : undefined
          }
        />
        <AdminVideoField
          name={VIDEO_NAME}
          purpose={VIDEO_PURPOSE}
          spec={VIDEO_SPEC}
          videoUrl={video ? getContentVideoUrl(video) : null}
          onSelect={(file) => {
            void handleVideo(slot, file);
          }}
          busy={videoSlot === slot}
          progress={videoProgress}
          disabled={(busy && videoSlot !== slot) || (!photo && !video)}
          disabledNote={!photo && !video ? "Add the photo above first." : null}
          error={
            videoErrors[slot] ??
            errorOf(`${slot}.video`) ??
            (video && !photo
              ? "This video needs the photo above. Add a photo or remove the video."
              : null)
          }
          onRemove={
            video
              ? () =>
                  update((d) => {
                    d[slot].video = null;
                  })
              : undefined
          }
        />
      </>
    );
  }

  function renderDesert() {
    const text = value.desert.text[lang];
    const base = `desert.text.${lang}`;
    return (
      <>
        <div style={cardStyle}>
          {switchRow}
          <TextField
            id={`home-${base}.heading`}
            label="Headline"
            hint="Press Enter for a new line (3 lines at most)."
            value={text.heading}
            max={HOME_LIMITS.desertHeading}
            rows={3}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.heading`)}
            onChange={(next) =>
              update((d) => {
                d.desert.text[lang].heading = next;
              })
            }
          />
        </div>
        <div style={cardStyle}>
          {renderVideoPhoto("desert")}
        </div>
      </>
    );
  }

  function renderNewsletter() {
    const text = value.newsletter.text[lang];
    const base = `newsletter.text.${lang}`;
    const photo = value.newsletter.photo;
    return (
      <>
        <div style={cardStyle}>
          {switchRow}
          <TextField
            id={`home-${base}.heading`}
            label="Headline"
            hint="Press Enter for a new line (3 lines at most)."
            value={text.heading}
            max={HOME_LIMITS.sectionHeading}
            rows={3}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.heading`)}
            onChange={(next) =>
              update((d) => {
                d.newsletter.text[lang].heading = next;
              })
            }
          />
          <TextField
            id={`home-${base}.body`}
            label="Text beside the sign-up form"
            value={text.body}
            max={HOME_LIMITS.newsletterBody}
            rows={4}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.body`)}
            onChange={(next) =>
              update((d) => {
                d.newsletter.text[lang].body = next;
              })
            }
          />
          <p style={hintStyle}>
            The sign-up form, the consent line and the social icons stay as they are.
          </p>
        </div>
        <div style={cardStyle}>
          <AdminPhotoField
            name="Band photo"
            purpose="Fills the left half of the newsletter band, behind the headline."
            spec={PHOTO_SPEC_NEWSLETTER}
            previewUrl={
              photo
                ? urlOf(photo, HOME_BUILTIN_MEDIA.newsletter)
                : HOME_BUILTIN_MEDIA.newsletter
            }
            onSelect={(files) => {
              void handlePhoto("newsletter", files);
            }}
            busy={busy}
            error={photoErrors.newsletter ?? errorOf("newsletter.photo") ?? null}
            onRemove={
              photo
                ? () =>
                    update((d) => {
                      d.newsletter.photo = null;
                    })
                : undefined
            }
          />
        </div>
      </>
    );
  }

  function renderShowcase() {
    const sc = value.showcase;
    const text = sc.text[lang];
    const base = `showcase.text.${lang}`;
    return (
      <>
        <div style={cardStyle}>
          {switchRow}
          <TextField
            id={`home-${base}.eyebrow`}
            label="Small line above the headline"
            value={text.eyebrow}
            max={HOME_LIMITS.sectionEyebrow}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.eyebrow`)}
            onChange={(next) =>
              update((d) => {
                d.showcase.text[lang].eyebrow = next;
              })
            }
          />
          <TextField
            id={`home-${base}.heading`}
            label="Headline"
            hint="Press Enter for a new line (3 lines at most)."
            value={text.heading}
            max={HOME_LIMITS.sectionHeading}
            rows={3}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.heading`)}
            onChange={(next) =>
              update((d) => {
                d.showcase.text[lang].heading = next;
              })
            }
          />
          <TextField
            id={`home-${base}.body`}
            label="Text"
            value={text.body}
            max={HOME_LIMITS.sectionBody}
            rows={4}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.body`)}
            onChange={(next) =>
              update((d) => {
                d.showcase.text[lang].body = next;
              })
            }
          />
          <div style={twoColumns}>
            <TextField
              id={`home-${base}.primaryLabel`}
              label="Main button text"
              value={text.primaryLabel}
              max={HOME_LIMITS.sectionLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${base}.primaryLabel`)}
              onChange={(next) =>
                update((d) => {
                  d.showcase.text[lang].primaryLabel = next;
                })
              }
            />
            {isEnglish && (
              <TextField
                id="home-showcase.primaryHref"
                label="Main button link"
                hint="Shared by all languages."
                value={sc.primaryHref}
                max={HOME_LIMITS.href}
                dir="ltr"
                disabled={busy}
                error={errorOf("showcase.primaryHref")}
                onChange={(next) =>
                  update((d) => {
                    d.showcase.primaryHref = next;
                  })
                }
              />
            )}
          </div>
          <div style={twoColumns}>
            <TextField
              id={`home-${base}.secondaryLabel`}
              label="Second link text"
              hint="Shown only while the second link is set."
              value={text.secondaryLabel}
              max={HOME_LIMITS.sectionLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${base}.secondaryLabel`)}
              onChange={(next) =>
                update((d) => {
                  d.showcase.text[lang].secondaryLabel = next;
                })
              }
            />
            {isEnglish && (
              <TextField
                id="home-showcase.secondaryHref"
                label="Second link"
                hint="Leave the link empty to hide it. Shared by all languages."
                value={sc.secondaryHref}
                max={HOME_LIMITS.href}
                dir="ltr"
                disabled={busy}
                error={errorOf("showcase.secondaryHref")}
                onChange={(next) =>
                  update((d) => {
                    d.showcase.secondaryHref = next;
                  })
                }
              />
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <AdminPhotoField
            name="Showcase photo"
            purpose="Shown beside the text. A product on a plain or transparent background works best."
            spec={PHOTO_SPEC_SHOWCASE}
            previewUrl={
              sc.photo
                ? urlOf(sc.photo, HOME_BUILTIN_MEDIA.showcase)
                : HOME_BUILTIN_MEDIA.showcase
            }
            onSelect={(files) => {
              void handlePhoto("showcase", files);
            }}
            busy={busy}
            error={photoErrors.showcase ?? errorOf("showcase.photo") ?? null}
            onRemove={
              sc.photo
                ? () =>
                    update((d) => {
                      d.showcase.photo = null;
                    })
                : undefined
            }
          />
          <TextField
            id={`home-${base}.photoAlt`}
            label="Photo description"
            hint="Read aloud by screen readers."
            value={text.photoAlt}
            max={HOME_LIMITS.photoAlt}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.photoAlt`)}
            onChange={(next) =>
              update((d) => {
                d.showcase.text[lang].photoAlt = next;
              })
            }
          />
        </div>
      </>
    );
  }

  function renderStory() {
    const story = value.story;
    const text = story.text[lang];
    const base = `story.text.${lang}`;
    return (
      <>
        <div style={cardStyle}>
          {switchRow}
          <TextField
            id={`home-${base}.eyebrow`}
            label="Small line above the headline"
            value={text.eyebrow}
            max={HOME_LIMITS.sectionEyebrow}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.eyebrow`)}
            onChange={(next) =>
              update((d) => {
                d.story.text[lang].eyebrow = next;
              })
            }
          />
          <TextField
            id={`home-${base}.heading`}
            label="Headline"
            hint="Press Enter for a new line (3 lines at most)."
            value={text.heading}
            max={HOME_LIMITS.sectionHeading}
            rows={3}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.heading`)}
            onChange={(next) =>
              update((d) => {
                d.story.text[lang].heading = next;
              })
            }
          />
          <TextField
            id={`home-${base}.body`}
            label="Text"
            value={text.body}
            max={HOME_LIMITS.sectionBody}
            rows={4}
            dir={rtl}
            disabled={busy}
            error={errorOf(`${base}.body`)}
            onChange={(next) =>
              update((d) => {
                d.story.text[lang].body = next;
              })
            }
          />
          <div style={twoColumns}>
            <TextField
              id={`home-${base}.buttonLabel`}
              label="Button text"
              value={text.buttonLabel}
              max={HOME_LIMITS.sectionLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${base}.buttonLabel`)}
              onChange={(next) =>
                update((d) => {
                  d.story.text[lang].buttonLabel = next;
                })
              }
            />
            {isEnglish && (
              <TextField
                id="home-story.buttonHref"
                label="Button link"
                hint="Shared by all languages."
                value={story.buttonHref}
                max={HOME_LIMITS.href}
                dir="ltr"
                disabled={busy}
                error={errorOf("story.buttonHref")}
                onChange={(next) =>
                  update((d) => {
                    d.story.buttonHref = next;
                  })
                }
              />
            )}
          </div>
        </div>
        <div style={cardStyle}>
          {renderVideoPhoto("story")}
        </div>
      </>
    );
  }

  return (
    <ContentPageFrame
      backHref="/admin"
      backLabel="Back to Dashboard"
      title="Homepage"
      status={isSaved ? { label: "Live", tone: "green" } : { label: "Built-in", tone: "grey" }}
      path="/"
      liveHref="/en"
      purpose="Every homepage section from the hero to the brand story. Until you save, visitors see the built-in photos, videos and wording."
      sketch="homepage"
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
          This content was saved by an earlier version of this editor and can&apos;t be
          read. The homepage shows the built-in content until you save.
        </div>
      )}

      {tab === "hero" && renderHero()}
      {tab === "featured" && renderFeatured()}
      {tab === "tiles" && renderTiles()}
      {tab === "desert" && renderDesert()}
      {tab === "newsletter" && renderNewsletter()}
      {tab === "showcase" && renderShowcase()}
      {tab === "story" && renderStory()}

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
        saveLabel="Save homepage"
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
        <HomePagePreview
          value={value}
          featured={featured}
          urls={urls}
          builtInPhotos={builtInPhotos}
          labels={labels}
          socials={socials}
          formMessages={formMessages}
          initialLang={lang}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </ContentPageFrame>
  );
}
