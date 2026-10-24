"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import AboutPreview, {
  type AboutPreviewLabels,
} from "@/components/admin/AboutPreview";
import AboutIcon from "@/components/pages/AboutIcon";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import {
  saveAboutPageAction,
  uploadAboutPhotoAction,
} from "@/lib/actions/about-page";
import {
  ABOUT_ICONS,
  ABOUT_LIMITS,
  ABOUT_LOCALES,
  countPlaceholders,
  ABOUT_FIGURE_SOURCES,
  type AboutFigureCounts,
  type AboutFigureSource,
  type AboutIconName,
  type AboutLocale,
  type AboutPageValue,
} from "@/lib/settings/about-page";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import { formatFigureCount } from "@/lib/utils/about-view";

type Section = "story" | "figures" | "mission" | "team" | "visit";
type PhotoTarget = "story" | "mission" | "team";

const SECTIONS: Section[] = ["story", "figures", "mission", "team", "visit"];

interface Props {
  initial: AboutPageValue;
  initialUrls: Record<string, string>;
  labels: Record<AboutLocale, AboutPreviewLabels>;
  legacy: boolean;
  counts: AboutFigureCounts;
}

const LOCALE_NAME: Record<AboutLocale, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const LOCALE_SHORT: Record<AboutLocale, string> = {
  en: "EN",
  ar: "AR",
  ru: "RU",
};

const ICON_LABEL: Record<AboutIconName, string> = {
  shield: "Shield",
  conversation: "Conversation",
  truck: "Truck",
  target: "Target",
  star: "Star",
  map: "Map",
  users: "People",
  leaf: "Leaf",
  calendar: "Calendar",
  tag: "Tag",
  language: "Languages",
};

const SOURCE_LABEL: Record<AboutFigureSource, string> = {
  manual: "Typed figure",
  brands: "Brands we carry (automatic)",
  products: "Products in the shop (automatic)",
  showrooms: "Showrooms (automatic)",
};

const SECTION_ROWS: {
  key: Section;
  title: string;
  purpose: string;
  toggle: boolean;
  editable: boolean;
}[] = [
  {
    key: "story",
    title: "Our story",
    purpose:
      "The first section under the header: how the business began, beside a photo. Always shown.",
    toggle: false,
    editable: true,
  },
  {
    key: "figures",
    title: "Figures",
    purpose:
      "A band of up to four figures under Our story. A typed figure still in [brackets] stays hidden; an automatic figure is counted live from the shop and hidden at zero.",
    toggle: true,
    editable: true,
  },
  {
    key: "mission",
    title: "Our mission",
    purpose:
      "How you sell: one paragraph and exactly three points, beside a photo.",
    toggle: true,
    editable: true,
  },
  {
    key: "team",
    title: "Our team",
    purpose:
      "The people who serve customers, with a Contact us button, a photo and an optional album of the team, expos and events.",
    toggle: true,
    editable: true,
  },
  {
    key: "visit",
    title: "Visit us",
    purpose:
      "Your main store from Stores, with its map and hours. Nothing to edit here. Hidden while no main store is shown.",
    toggle: true,
    editable: false,
  },
];

const PHOTO_HINT =
  "Landscape 4:3, at least 1600 px wide, up to 4 MB, subject in the middle. JPEG, PNG or WebP. Until you add one, the page shows a dark placeholder tile.";

const EYEBROW_HINT = "A few words above the heading. Example: How it began";
const HEADING_HINT = "Example: Where we started";

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

function sectionShown(v: AboutPageValue, s: Section): boolean {
  if (s === "story") return true;
  if (s === "figures") return v.figures.visible;
  if (s === "mission") return v.mission.visible;
  if (s === "team") return v.team.visible;
  return v.visit.visible;
}

function filled(text: string): boolean {
  return text.trim() !== "";
}

function sectionDone(v: AboutPageValue, s: Section, l: AboutLocale): boolean {
  if (s === "story") {
    const c = v.story.copy[l];
    return filled(c.eyebrow) && filled(c.heading) && filled(c.body);
  }
  if (s === "figures") {
    return v.figures.items.every((item) => filled(item.label[l]));
  }
  if (s === "mission") {
    const c = v.mission.copy[l];
    return (
      filled(c.eyebrow) &&
      filled(c.heading) &&
      filled(c.body) &&
      c.points.every((p) => filled(p.title) && filled(p.line))
    );
  }
  if (s === "team") {
    const c = v.team.copy[l];
    return filled(c.eyebrow) && filled(c.heading) && filled(c.body);
  }
  return true;
}

function unfinishedCount(v: AboutPageValue, l: AboutLocale): number {
  return (["story", "figures", "mission", "team"] as const).filter(
    (s) => sectionShown(v, s) && !sectionDone(v, s, l),
  ).length;
}

function sectionTexts(v: AboutPageValue, s: Section, l: AboutLocale): string[] {
  if (s === "story") {
    const c = v.story.copy[l];
    return [c.eyebrow, c.heading, c.body];
  }
  if (s === "figures") {
    return v.figures.items.flatMap((item) => [item.value, item.label[l]]);
  }
  if (s === "mission") {
    const c = v.mission.copy[l];
    return [
      c.eyebrow,
      c.heading,
      c.body,
      ...c.points.flatMap((p) => [p.title, p.line]),
    ];
  }
  if (s === "team") {
    const c = v.team.copy[l];
    return [c.eyebrow, c.heading, c.body, ...v.team.album.map((a) => a.caption[l])];
  }
  return [];
}

function locateError(path: string): { section: Section; locale?: AboutLocale; tile?: number } {
  const parts = path.split(".");
  const section: Section = SECTIONS.includes(parts[0] as Section)
    ? (parts[0] as Section)
    : "story";
  const isLocale = (p: string | undefined): p is AboutLocale =>
    p === "en" || p === "ar" || p === "ru";
  if (parts[1] === "copy" && isLocale(parts[2])) {
    return { section, locale: parts[2] };
  }
  if (parts[1] === "items" && parts[3] === "label" && isLocale(parts[4])) {
    return { section, locale: parts[4] };
  }
  if (parts[1] === "album") {
    const tile = Number(parts[2]);
    return {
      section,
      tile: Number.isInteger(tile) ? tile : undefined,
      locale: parts[3] === "caption" && isLocale(parts[4]) ? parts[4] : undefined,
    };
  }
  return { section };
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

function Switch({
  enabled,
  disabled,
  label,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "2.5rem",
        height: "1.375rem",
        padding: "0.1875rem",
        backgroundColor: enabled
          ? "var(--color-action-primary)"
          : "var(--color-auth-input-border)",
        border: "none",
        borderRadius: "9999px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 150ms",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "1rem",
          height: "1rem",
          borderRadius: "9999px",
          backgroundColor: "#ffffff",
          transform: enabled ? "translateX(1.125rem)" : "translateX(0)",
          transition: "transform 150ms",
        }}
      />
    </button>
  );
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
  dir?: "rtl";
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

function PlaceholderNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div
      style={{
        padding: "0.625rem 0.875rem",
        fontSize: "var(--text-body-sm)",
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#92400e",
      }}
    >
      {count} {count === 1 ? "placeholder" : "placeholders"} in [brackets] still to
      replace.
    </div>
  );
}

function IconSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: AboutIconName;
  disabled: boolean;
  onChange: (next: AboutIconName) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as AboutIconName)}
          style={{ ...inputStyle, width: "auto", minWidth: "10rem" }}
        >
          {ABOUT_ICONS.map((name) => (
            <option key={name} value={name}>
              {ICON_LABEL[name]}
            </option>
          ))}
        </select>
        <span style={{ display: "inline-flex", color: "var(--color-action-primary)" }}>
          <AboutIcon name={value} size={22} />
        </span>
      </div>
    </div>
  );
}

export default function AboutSectionsEditor({
  initial,
  initialUrls,
  labels,
  legacy,
  counts,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [value, setValue] = useState<AboutPageValue>(initial);
  const [saved, setSaved] = useState<AboutPageValue>(initial);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [open, setOpen] = useState<Section>("story");
  const [lang, setLang] = useState<AboutLocale>("en");
  const [tile, setTile] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<
    Partial<Record<PhotoTarget, string>>
  >({});
  const [albumUploadErrors, setAlbumUploadErrors] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const busy = saving || uploading;
  const rtl = lang === "ar" ? ("rtl" as const) : undefined;

  useUnsavedGuard(dirty);

  function update(mutate: (draft: AboutPageValue) => void) {
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

  function urlOf(key: string): string {
    return urls[key] ?? getContentImageUrl(key) ?? getImageUrl(key);
  }

  async function uploadOne(
    file: File,
  ): Promise<{ key: string; url: string } | { error: string }> {
    const fd = new FormData();
    fd.set("image", file);
    try {
      const result = await uploadAboutPhotoAction(fd);
      return result.success
        ? { key: result.key, url: result.url }
        : { error: result.error };
    } catch {
      return { error: "Failed to upload image. Please try again." };
    }
  }

  async function handlePhoto(target: PhotoTarget, files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setPhotoErrors((e) => ({ ...e, [target]: undefined }));
    const result = await uploadOne(file);
    if ("error" in result) {
      setPhotoErrors((e) => ({ ...e, [target]: result.error }));
    } else {
      setUrls((u) => ({ ...u, [result.key]: result.url }));
      update((d) => {
        d[target].photo = result.key;
      });
    }
    setUploading(false);
  }

  async function handleAlbumPhotos(files: File[]) {
    if (files.length === 0) return;
    const picked = files;
    setUploading(true);
    setAlbumUploadErrors([]);
    let count = value.team.album.length;
    const failures: string[] = [];
    for (const file of picked) {
      if (count >= ABOUT_LIMITS.album) {
        failures.push("The album holds up to 12 photos.");
        break;
      }
      const result = await uploadOne(file);
      if ("error" in result) {
        failures.push(result.error);
        continue;
      }
      count += 1;
      setUrls((u) => ({ ...u, [result.key]: result.url }));
      update((d) => {
        d.team.album.push({ photo: result.key, caption: { en: "", ar: "", ru: "" } });
      });
    }
    setAlbumUploadErrors(failures);
    setUploading(false);
  }

  function focusFirstError(fieldErrors: Record<string, string[]>) {
    const first = Object.keys(fieldErrors)[0];
    if (!first) return;
    const where = locateError(first);
    setOpen(where.section);
    if (where.locale) setLang(where.locale);
    setTile(where.tile ?? null);
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await saveAboutPageAction(value);

    if (result.success) {
      toast.success("About page saved.");
      setSaved(value);
      router.refresh();
    } else if (
      (result.errorCode === "VALIDATION_ERROR" ||
        result.errorCode === "ENGLISH_REQUIRED" ||
        result.errorCode === "PHOTO_MISSING") &&
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
    setValue(saved);
    setErrors({});
    setFormError(null);
    setTile(null);
    setPhotoErrors({});
    setAlbumUploadErrors([]);
  }

  const albumErrors = Object.entries(errors)
    .filter(([path]) => path.startsWith("team.album") && !path.includes(".caption."))
    .flatMap(([, messages]) => messages);

  const tabs = (
    <div role="tablist" aria-label="Language" style={{ display: "flex", gap: "0.5rem" }}>
      {ABOUT_LOCALES.map((l) => (
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

  function placeholderNote(section: Section) {
    return (
      <PlaceholderNote
        count={sectionTexts(value, section, lang).reduce(
          (n, t) => n + countPlaceholders(t),
          0,
        )}
      />
    );
  }

  function renderPhoto(target: PhotoTarget, name: string, purpose: string) {
    const photo = value[target].photo;
    return (
      <AdminPhotoField
        name={name}
        purpose={purpose}
        spec={PHOTO_HINT}
        previewUrl={photo ? urlOf(photo) : null}
        onSelect={(files) => {
          void handlePhoto(target, files);
        }}
        busy={busy}
        error={photoErrors[target] ?? errorOf(`${target}.photo`) ?? null}
        onRemove={() =>
          update((d) => {
            d[target].photo = null;
          })
        }
      />
    );
  }

  function renderStory() {
    const copy = value.story.copy[lang];
    const base = `story.copy.${lang}`;
    return (
      <>
        <TextField
          id={`about-${base}.eyebrow`}
          label="Eyebrow"
          hint={EYEBROW_HINT}
          value={copy.eyebrow}
          max={ABOUT_LIMITS.eyebrow}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.eyebrow`)}
          onChange={(next) =>
            update((d) => {
              d.story.copy[lang].eyebrow = next;
            })
          }
        />
        <TextField
          id={`about-${base}.heading`}
          label="Heading"
          hint={HEADING_HINT}
          value={copy.heading}
          max={ABOUT_LIMITS.heading}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.heading`)}
          onChange={(next) =>
            update((d) => {
              d.story.copy[lang].heading = next;
            })
          }
        />
        <TextField
          id={`about-${base}.body`}
          label="Text"
          hint="Up to three paragraphs; leave an empty line between them."
          value={copy.body}
          max={ABOUT_LIMITS.storyText}
          rows={9}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.body`)}
          onChange={(next) =>
            update((d) => {
              d.story.copy[lang].body = next;
            })
          }
        />
        {placeholderNote("story")}
        {renderPhoto("story", "Story photo", "Shows beside the story text, first section under the header.")}
      </>
    );
  }

  function renderFigures() {
    const items = value.figures.items;
    return (
      <>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              padding: "0.875rem",
              border: "1px solid var(--color-shop-divider)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <span style={labelStyle}>Figure {i + 1}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  update((d) => {
                    d.figures.items.splice(i, 1);
                  })
                }
                style={linkBtn}
              >
                Remove
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label htmlFor={`about-figure-${i}-source`} style={labelStyle}>
                Source
              </label>
              <select
                id={`about-figure-${i}-source`}
                value={item.source}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as AboutFigureSource;
                  update((d) => {
                    d.figures.items[i].source = next;
                    if (next !== "manual") d.figures.items[i].value = "";
                  });
                }}
                style={{ ...inputStyle, width: "auto", minWidth: "10rem" }}
              >
                {ABOUT_FIGURE_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABEL[source]}
                  </option>
                ))}
              </select>
            </div>
            <IconSelect
              id={`about-figure-${i}-icon`}
              label="Icon"
              value={item.icon}
              disabled={busy}
              onChange={(next) =>
                update((d) => {
                  d.figures.items[i].icon = next;
                })
              }
            />
            {item.source === "manual" ? (
              <TextField
                id={`about-figure-${i}-value`}
                label="Figure (same in every language)"
                hint="The figure, then a short label below. Example: 25+ with Brands in stock"
                value={item.value}
                max={ABOUT_LIMITS.figureValue}
                disabled={busy}
                error={errorOf(`figures.items.${i}.value`)}
                onChange={(next) =>
                  update((d) => {
                    d.figures.items[i].value = next;
                  })
                }
              />
            ) : (
              <p style={hintStyle}>
                Counted live from the shop: now {formatFigureCount(item.source, counts[item.source])}.
                Hidden while the count is 0.
              </p>
            )}
            <TextField
              id={`about-figure-${i}-label-${lang}`}
              label="Label"
              hint="English is required while the Figures section is shown."
              value={item.label[lang]}
              max={ABOUT_LIMITS.figureLabel}
              dir={rtl}
              disabled={busy}
              error={errorOf(`figures.items.${i}.label.${lang}`)}
              onChange={(next) =>
                update((d) => {
                  d.figures.items[i].label[lang] = next;
                })
              }
            />
          </div>
        ))}
        {errorOf("figures.items") && (
          <p role="alert" style={errorStyle}>
            {errorOf("figures.items")}
          </p>
        )}
        {items.length < ABOUT_LIMITS.figures ? (
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                update((d) => {
                  d.figures.items.push({
                    source: "manual",
                    value: "",
                    icon: "star",
                    label: { en: "", ar: "", ru: "" },
                  });
                })
              }
              style={linkBtn}
            >
              + Add figure
            </button>
          </div>
        ) : (
          <p style={hintStyle}>Show up to four figures.</p>
        )}
        {placeholderNote("figures")}
      </>
    );
  }

  function renderMission() {
    const copy = value.mission.copy[lang];
    const base = `mission.copy.${lang}`;
    return (
      <>
        <TextField
          id={`about-${base}.eyebrow`}
          label="Eyebrow"
          hint={EYEBROW_HINT}
          value={copy.eyebrow}
          max={ABOUT_LIMITS.eyebrow}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.eyebrow`)}
          onChange={(next) =>
            update((d) => {
              d.mission.copy[lang].eyebrow = next;
            })
          }
        />
        <TextField
          id={`about-${base}.heading`}
          label="Heading"
          hint={HEADING_HINT}
          value={copy.heading}
          max={ABOUT_LIMITS.heading}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.heading`)}
          onChange={(next) =>
            update((d) => {
              d.mission.copy[lang].heading = next;
            })
          }
        />
        <TextField
          id={`about-${base}.body`}
          label="Text"
          hint="One paragraph, no empty lines."
          value={copy.body}
          max={ABOUT_LIMITS.missionText}
          rows={4}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.body`)}
          onChange={(next) =>
            update((d) => {
              d.mission.copy[lang].body = next;
            })
          }
        />
        {copy.points.map((point, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              padding: "0.875rem",
              border: "1px solid var(--color-shop-divider)",
            }}
          >
            <span style={labelStyle}>Point {i + 1}</span>
            <IconSelect
              id={`about-mission-icon-${i}`}
              label="Icon (same in every language)"
              value={value.mission.icons[i]}
              disabled={busy}
              onChange={(next) =>
                update((d) => {
                  d.mission.icons[i] = next;
                })
              }
            />
            <TextField
              id={`about-${base}.points.${i}.title`}
              label="Title"
              hint="Example: Verified once"
              value={point.title}
              max={ABOUT_LIMITS.pointTitle}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${base}.points.${i}.title`)}
              onChange={(next) =>
                update((d) => {
                  d.mission.copy[lang].points[i].title = next;
                })
              }
            />
            <TextField
              id={`about-${base}.points.${i}.line`}
              label="Line"
              hint="One sentence. Example: Every licensed shipment follows UAE regulations."
              value={point.line}
              max={ABOUT_LIMITS.pointLine}
              rows={2}
              dir={rtl}
              disabled={busy}
              error={errorOf(`${base}.points.${i}.line`)}
              onChange={(next) =>
                update((d) => {
                  d.mission.copy[lang].points[i].line = next;
                })
              }
            />
          </div>
        ))}
        {(errorOf(`${base}.points`) || errorOf("mission.icons")) && (
          <p role="alert" style={errorStyle}>
            {errorOf(`${base}.points`) ?? errorOf("mission.icons")}
          </p>
        )}
        {placeholderNote("mission")}
        {renderPhoto("mission", "Mission photo", "Shows beside the mission text.")}
      </>
    );
  }

  function renderTeam() {
    const copy = value.team.copy[lang];
    const base = `team.copy.${lang}`;
    const album = value.team.album;
    const selected = tile !== null && album[tile] ? tile : null;
    return (
      <>
        <TextField
          id={`about-${base}.eyebrow`}
          label="Eyebrow"
          hint={EYEBROW_HINT}
          value={copy.eyebrow}
          max={ABOUT_LIMITS.eyebrow}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.eyebrow`)}
          onChange={(next) =>
            update((d) => {
              d.team.copy[lang].eyebrow = next;
            })
          }
        />
        <TextField
          id={`about-${base}.heading`}
          label="Heading"
          hint={HEADING_HINT}
          value={copy.heading}
          max={ABOUT_LIMITS.heading}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.heading`)}
          onChange={(next) =>
            update((d) => {
              d.team.copy[lang].heading = next;
            })
          }
        />
        <TextField
          id={`about-${base}.body`}
          label="Text"
          hint="One or two paragraphs; leave an empty line between them."
          value={copy.body}
          max={ABOUT_LIMITS.teamText}
          rows={6}
          dir={rtl}
          disabled={busy}
          error={errorOf(`${base}.body`)}
          onChange={(next) =>
            update((d) => {
              d.team.copy[lang].body = next;
            })
          }
        />
        {placeholderNote("team")}
        {renderPhoto("team", "Team photo", "Shows beside the team text.")}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {album.length < ABOUT_LIMITS.album ? (
            <AdminPhotoField
              name="Album photos"
              purpose="Up to 12 squares under Our team. Visitors can open each one full screen."
              spec="Square works best, subject in the middle, up to 4 MB each. JPEG, PNG or WebP."
              previewUrl={null}
              multiple
              busy={busy}
              onSelect={(files) => {
                void handleAlbumPhotos(files);
              }}
            />
          ) : (
            <p style={hintStyle}>The album holds up to 12 photos.</p>
          )}
          {album.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start" }}>
              {album.map((item, i) => (
                <button
                  key={item.photo}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  aria-pressed={selected === i}
                  onClick={() => setTile(selected === i ? null : i)}
                  style={{
                    width: i === 0 ? "168px" : "80px",
                    height: i === 0 ? "168px" : "80px",
                    padding: 0,
                    border: "none",
                    background: "#f3f4f6",
                    cursor: "pointer",
                    outline:
                      selected === i ? "2px solid var(--color-action-primary)" : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlOf(item.photo)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>
          )}

          {selected !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
                padding: "0.875rem",
                border: "1px solid var(--color-shop-divider)",
              }}
            >
              <TextField
                id={`about-album-caption-${selected}-${lang}`}
                label={`Caption for photo ${selected + 1}`}
                hint="Optional. Example: Our stand at ADIHEX"
                value={album[selected].caption[lang]}
                max={ABOUT_LIMITS.caption}
                dir={rtl}
                disabled={busy}
                error={errorOf(`team.album.${selected}.caption.${lang}`)}
                onChange={(next) =>
                  update((d) => {
                    d.team.album[selected].caption[lang] = next;
                  })
                }
              />
              <div style={{ display: "flex", gap: "1rem" }}>
                {selected > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      update((d) => {
                        const [moved] = d.team.album.splice(selected, 1);
                        d.team.album.unshift(moved);
                      });
                      setTile(0);
                    }}
                    style={linkBtn}
                  >
                    Move first
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    update((d) => {
                      d.team.album.splice(selected, 1);
                    });
                    setTile(null);
                  }}
                  style={{ ...linkBtn, color: "var(--color-action-primary)" }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {[...albumUploadErrors, ...albumErrors].map((message, i) => (
            <p key={i} role="alert" style={errorStyle}>
              {message}
            </p>
          ))}
        </div>
      </>
    );
  }

  const activeRow = SECTION_ROWS.find((r) => r.key === open) ?? SECTION_ROWS[0];
  const activeIndex = SECTION_ROWS.indexOf(activeRow);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: 0,
          }}
        >
          Page sections
        </h2>
        <p style={{ ...hintStyle, marginTop: "0.25rem" }}>
          What visitors see below the photo header. Title and opening line are in tab 1;
          search settings are in tab 3.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.875rem" }}>
          {ABOUT_LOCALES.map((l) => {
            const left = unfinishedCount(value, l);
            return left === 0 ? (
              <Chip key={l} tone="green">
                {LOCALE_NAME[l]} complete
              </Chip>
            ) : (
              <Chip key={l} tone="grey">
                {LOCALE_NAME[l]}: {left} {left === 1 ? "section" : "sections"} to finish
              </Chip>
            );
          })}
        </div>
      </div>

      <div
        className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[170px_minmax(0,1fr)]"
        style={{ alignItems: "start" }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e8e8e8",
            borderRadius: "0",
          }}
        >
          {SECTION_ROWS.map((row, index) => {
            const shown = sectionShown(value, row.key);
            const active = open === row.key;
            return (
              <div
                key={row.key}
                style={{
                  borderTop: index === 0 ? "none" : "1px solid #e8e8e8",
                  borderInlineStart: `2px solid ${active ? "var(--color-action-primary)" : "transparent"}`,
                  backgroundColor: active ? "color-mix(in srgb, var(--color-action-primary) 5%, transparent)" : "transparent",
                  padding: "0.625rem 0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <button
                  type="button"
                  aria-current={active}
                  onClick={() => {
                    setOpen(row.key);
                    setTile(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "start",
                    cursor: "pointer",
                    fontSize: "var(--text-body)",
                    fontWeight: active ? "var(--font-semibold)" : "var(--font-medium)",
                    color: active ? "#0b0b0b" : "#6b6b6b",
                  }}
                >
                  {index + 1} · {row.title}
                </button>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  {!shown ? (
                    <Chip tone="grey">Hidden</Chip>
                  ) : row.key === "visit" ? (
                    <Chip tone="grey">Automatic</Chip>
                  ) : (
                    ABOUT_LOCALES.map((l) =>
                      sectionDone(value, row.key, l) ? (
                        <Chip key={l} tone="green">
                          {LOCALE_SHORT[l]} done
                        </Chip>
                      ) : (
                        <Chip key={l} tone="grey">
                          {LOCALE_SHORT[l]} to finish
                        </Chip>
                      ),
                    )
                  )}
                </div>
                {row.toggle && (
                  <div>
                    <Switch
                      enabled={shown}
                      disabled={busy}
                      label={`Show ${row.title}`}
                      onToggle={() =>
                        update((d) => {
                          if (row.key === "figures") d.figures.visible = !d.figures.visible;
                          else if (row.key === "mission") d.mission.visible = !d.mission.visible;
                          else if (row.key === "team") d.team.visible = !d.team.visible;
                          else d.visit.visible = !d.visit.visible;
                        })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
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
              These sections were saved by an earlier version of this editor and can&apos;t
              be read. The page shows the text below until you save.
            </div>
          )}
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
              }}
            >
              {activeIndex + 1} · {activeRow.title}
            </h3>
            <p style={{ ...hintStyle, marginTop: "0.25rem" }}>{activeRow.purpose}</p>
          </div>
          {activeRow.editable && tabs}
          {activeRow.key === "story" && renderStory()}
          {activeRow.key === "figures" && renderFigures()}
          {activeRow.key === "mission" && renderMission()}
          {activeRow.key === "team" && renderTeam()}
        </div>
      </div>

      {formError && (
        <p role="alert" style={{ ...errorStyle, textAlign: "end" }}>
          {formError}
        </p>
      )}

      <ContentSaveBar
        savedLabel={dirty ? null : "All changes saved"}
        dirty={dirty}
        saveLabel="Save sections"
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
        <AboutPreview
          value={value}
          urls={urls}
          counts={counts}
          labels={labels}
          initialLang={lang}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
