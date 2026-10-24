"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import HomePopupPreview, {
  type PopupSignupLabels,
} from "@/components/admin/HomePopupPreview";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { saveHomePopupAction } from "@/lib/actions/banner";
import {
  BUTTON_COLORS_BY_THEME,
  BUTTON_COLOR_LABELS,
  HOME_POPUP_THEMES,
  popupButtonColors,
  type HomePopupButtonColor,
  type HomePopupPurpose,
  type HomePopupTheme,
} from "@/lib/utils/home-popup";

export type PopupStatus = "Live" | "Scheduled" | "Off" | "Ended";

interface FormState {
  isActive: boolean;
  titleEn: string;
  titleAr: string;
  titleRu: string;
  subtitleEn: string;
  subtitleAr: string;
  subtitleRu: string;
  ctaEn: string;
  ctaAr: string;
  ctaRu: string;
  linkUrl: string;
  startsOn: string;
  endsOn: string;
  theme: HomePopupTheme;
  buttonColor: HomePopupButtonColor;
  purpose: HomePopupPurpose;
}

interface Props {
  initial: FormState & { status: PopupStatus };
  imageUrl: string | null;
  signupLabels: Record<"en" | "ar" | "ru", PopupSignupLabels>;
}

type Errors = Record<string, string | undefined>;
type Lang = "En" | "Ar" | "Ru";

const LANGS: { key: Lang; label: string; rtl: boolean }[] = [
  { key: "En", label: "English", rtl: false },
  { key: "Ar", label: "Arabic", rtl: true },
  { key: "Ru", label: "Russian", rtl: false },
];

const FORM_KEYS = [
  "isActive",
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
  "startsOn",
  "endsOn",
  "theme",
  "buttonColor",
  "purpose",
] as const satisfies readonly (keyof FormState)[];

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.25rem",
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

export default function HomePopupForm({ initial, imageUrl, signupLabels }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<FormState>({
    isActive: initial.isActive,
    titleEn: initial.titleEn,
    titleAr: initial.titleAr,
    titleRu: initial.titleRu,
    subtitleEn: initial.subtitleEn,
    subtitleAr: initial.subtitleAr,
    subtitleRu: initial.subtitleRu,
    ctaEn: initial.ctaEn,
    ctaAr: initial.ctaAr,
    ctaRu: initial.ctaRu,
    linkUrl: initial.linkUrl,
    startsOn: initial.startsOn,
    endsOn: initial.endsOn,
    theme: initial.theme,
    buttonColor: initial.buttonColor,
    purpose: initial.purpose,
  });
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<Lang>("En");
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<Lang | null>(null);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const dirty = file !== null || FORM_KEYS.some((key) => form[key] !== initial[key]);
  useUnsavedGuard(dirty);
  const canPreview = !!form.titleEn.trim() && !!form.ctaEn.trim();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError(null);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setTheme(theme: HomePopupTheme) {
    setForm((f) => ({
      ...f,
      theme,
      buttonColor: BUTTON_COLORS_BY_THEME[theme].includes(f.buttonColor)
        ? f.buttonColor
        : "gold",
    }));
    setFormError(null);
    if (errors.buttonColor) setErrors((e) => ({ ...e, buttonColor: undefined }));
  }

  async function handleSubmit() {
    const missing: Errors = {};
    if (!form.titleEn.trim()) missing.titleEn = "Add an English heading.";
    if (!form.ctaEn.trim()) missing.ctaEn = "Add English button text.";
    if (!file && !imageUrl) missing.image = "Add an image.";
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      if (missing.titleEn || missing.ctaEn) setTab("En");
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setFormError(null);

    const fd = new FormData();
    fd.set("isActive", form.isActive ? "true" : "false");
    for (const key of [
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
      "startsOn",
      "endsOn",
      "theme",
      "buttonColor",
      "purpose",
    ] as const) {
      fd.set(key, form[key]);
    }
    if (file) fd.set("image", file);

    const result = await saveHomePopupAction(fd);

    if (result.success) {
      toast.success("Popup saved.");
      setFile(null);
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const next: Errors = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (messages?.[0]) next[key] = messages[0];
      }
      setErrors(next);
      const failingLang = LANGS.find((l) =>
        [`title${l.key}`, `subtitle${l.key}`, `cta${l.key}`].some(
          (k) => next[k],
        ),
      );
      if (failingLang) setTab(failingLang.key);
    } else if (
      result.errorCode === "INVALID_IMAGE" ||
      result.errorCode === "IMAGE_TOO_LARGE"
    ) {
      setErrors({ image: result.error });
    } else if (result.errorCode === "NO_CHANGES") {
      setFormError(result.error);
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  const lang = LANGS.find((l) => l.key === tab) ?? LANGS[0];
  const titleKey = `title${lang.key}` as keyof FormState;
  const subtitleKey = `subtitle${lang.key}` as keyof FormState;
  const ctaKey = `cta${lang.key}` as keyof FormState;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: "0",
      }}
    >
      <div style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <label
            htmlFor="popup-active"
            style={{
              ...labelStyle,
              alignItems: "center",
              gap: "0.5rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            <input
              id="popup-active"
              type="checkbox"
              checked={form.isActive}
              disabled={isSubmitting}
              onChange={(e) => setField("isActive", e.target.checked)}
              style={{ accentColor: "#0b0b0b", width: "1rem", height: "1rem" }}
            />
            Show popup
          </label>
          <p style={{ ...hintStyle, marginTop: "-0.875rem" }}>
            Visitors see it once per saved version.
          </p>

          <AdminPhotoField
            name="Popup photo"
            purpose="Shows beside the black panel, and above it on phones."
            spec="JPEG, PNG or WebP, up to 4 MB. The popup crops the photo to fit, so keep the subject in the middle."
            previewUrl={fileUrl ?? imageUrl}
            busy={isSubmitting}
            error={errors.image ?? null}
            onSelect={(files) => {
              setFile(files[0] ?? null);
              if (errors.image) setErrors((er) => ({ ...er, image: undefined }));
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={labelStyle}>Theme</span>
              <div role="group" aria-label="Theme" style={{ display: "flex", gap: "0.5rem" }}>
                {HOME_POPUP_THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.theme === t}
                    disabled={isSubmitting}
                    onClick={() => setTheme(t)}
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
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      opacity: form.theme === t ? 1 : 0.45,
                    }}
                  >
                    {t === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
              <p style={hintStyle}>The panel behind the text.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={labelStyle}>Button colour</span>
              <div role="group" aria-label="Button colour" style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}>
                {BUTTON_COLORS_BY_THEME[form.theme].map((c) => {
                  const selected = form.buttonColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={selected}
                      aria-label={BUTTON_COLOR_LABELS[c]}
                      disabled={isSubmitting}
                      onClick={() => setField("buttonColor", c)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.375rem",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        data-surface="storefront"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "3rem",
                          height: "3rem",
                          fontSize: "var(--text-body-sm)",
                          fontWeight: "var(--font-bold)",
                          backgroundColor: popupButtonColors[c].bg,
                          color: popupButtonColors[c].fg,
                          border: "1px solid #c9c4be",
                          outline: selected ? "2px solid #0b0b0b" : "none",
                          outlineOffset: "2px",
                        }}
                      >
                        Aa
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-auth-label-text)",
                          fontWeight: selected ? "var(--font-bold)" : undefined,
                        }}
                      >
                        {BUTTON_COLOR_LABELS[c]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.buttonColor ? (
                <p role="alert" style={errorStyle}>
                  {errors.buttonColor}
                </p>
              ) : (
                <p style={hintStyle}>
                  Only colours that stay readable on this theme are offered.
                </p>
              )}
            </div>

            <div role="tablist" aria-label="Language" style={{ display: "flex", gap: "0.5rem" }}>
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === l.key}
                  onClick={() => setTab(l.key)}
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
                    opacity: tab === l.key ? 1 : 0.45,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <Input
              id={`popup-title-${lang.key}`}
              label="Heading"
              type="text"
              dir={lang.rtl ? "rtl" : undefined}
              value={form[titleKey] as string}
              onChange={(e) => setField(titleKey, e.target.value as never)}
              disabled={isSubmitting}
              error={errors[titleKey]}
              hint="The large line on the black panel. English is required."
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label htmlFor={`popup-subtitle-${lang.key}`} style={labelStyle}>
                Text
              </label>
              <textarea
                id={`popup-subtitle-${lang.key}`}
                rows={3}
                dir={lang.rtl ? "rtl" : undefined}
                value={form[subtitleKey] as string}
                onChange={(e) => setField(subtitleKey, e.target.value as never)}
                disabled={isSubmitting}
                aria-invalid={!!errors[subtitleKey]}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.875rem",
                  fontSize: "var(--text-body)",
                  color: "var(--color-auth-input-text)",
                  backgroundColor: "var(--color-auth-input-bg)",
                  border: "1.5px solid var(--color-auth-input-border)",
                  borderRadius: "var(--radius-none)",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              />
              {errors[subtitleKey] ? (
                <p role="alert" style={errorStyle}>
                  {errors[subtitleKey]}
                </p>
              ) : (
                <p style={hintStyle}>One or two short sentences under the heading.</p>
              )}
            </div>

            <Input
              id={`popup-cta-${lang.key}`}
              label="Button text"
              type="text"
              dir={lang.rtl ? "rtl" : undefined}
              value={form[ctaKey] as string}
              onChange={(e) => setField(ctaKey, e.target.value as never)}
              disabled={isSubmitting}
              error={errors[ctaKey]}
              hint="Shown on the button. In sign-up mode use a word like Subscribe. English is required."
            />

            <p style={hintStyle}>
              Arabic and Russian visitors see their language only when its
              heading and button are filled; otherwise they see English.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span style={labelStyle}>Button action</span>
            <div role="group" aria-label="Button action" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(
                [
                  ["link", "Open the link"],
                  ["newsletter", "Newsletter sign-up"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.purpose === value}
                  disabled={isSubmitting}
                  onClick={() => setField("purpose", value)}
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
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: form.purpose === value ? 1 : 0.45,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={hintStyle}>What the button does when a visitor presses it.</p>
          </div>

          {form.purpose === "link" ? (
            <Input
              id="popup-link"
              label="Link"
              type="text"
              dir="ltr"
              value={form.linkUrl}
              onChange={(e) => setField("linkUrl", e.target.value)}
              disabled={isSubmitting}
              error={errors.linkUrl}
              hint="Where the button goes, for example /shop. Leave it empty and the button only closes the popup."
            />
          ) : (
            <p style={hintStyle}>
              In sign-up mode the button subscribes the visitor, so no link is used.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
                gap: "0.875rem",
              }}
            >
              <Input
                id="popup-starts"
                label="Starts"
                type="date"
                value={form.startsOn}
                onChange={(e) => setField("startsOn", e.target.value)}
                disabled={isSubmitting}
                error={errors.startsOn}
                hint="Dubai day it starts. Leave empty to start now."
              />
              <Input
                id="popup-ends"
                label="Ends"
                type="date"
                value={form.endsOn}
                onChange={(e) => setField("endsOn", e.target.value)}
                disabled={isSubmitting}
                error={errors.endsOn}
                hint="Dubai day it ends. Leave empty to keep it running."
              />
            </div>
          </div>
        </div>
      </div>

    </div>

      {formError && (
        <p role="alert" style={{ ...errorStyle, textAlign: "end" }}>
          {formError}
        </p>
      )}

      <ContentSaveBar
        savedLabel={null}
        dirty={dirty}
        saveLabel="Save"
        onSave={() => {
          void handleSubmit();
        }}
        saving={isSubmitting}
        onPreview={canPreview ? () => setPreviewLang(tab) : undefined}
        extra={
          canPreview ? undefined : (
            <p id="popup-preview-hint" style={hintStyle}>
              Fill the English heading and button text to preview
            </p>
          )
        }
      />

      {previewLang && (
        <HomePopupPreview
          values={form}
          imageSrc={fileUrl ?? imageUrl}
          theme={form.theme}
          buttonColor={form.buttonColor}
          purpose={form.purpose}
          signupLabels={signupLabels}
          initialLang={previewLang}
          onClose={() => setPreviewLang(null)}
        />
      )}
    </div>
  );
}
