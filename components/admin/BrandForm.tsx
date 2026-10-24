"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import BrandPageActions from "@/components/admin/BrandPageActions";
import Input from "@/components/ui/Input";
import { createBrandAction, updateBrandAction } from "@/lib/actions/brand";
import { slugFromName } from "@/lib/utils/slug";
import type { AdminBrandDetail } from "@/lib/db/queries/brands";

interface Props {
  mode: "create" | "edit";
  initial?: AdminBrandDetail;
  slots?: {
    products?: ReactNode;
  };
}

interface FormState {
  nameEn: string;
  nameAr: string;
  nameRu: string;
  slug: string;
}

type Lang = "en" | "ar" | "ru";

const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const LANGS: Lang[] = ["en", "ar", "ru"];

const NAME_KEY: Record<Lang, "nameEn" | "nameAr" | "nameRu"> = {
  en: "nameEn",
  ar: "nameAr",
  ru: "nameRu",
};

function buildState(initial?: AdminBrandDetail): FormState {
  return {
    nameEn: initial?.nameEn ?? "",
    nameAr: initial?.nameAr ?? "",
    nameRu: initial?.nameRu ?? "",
    slug: initial?.slug ?? "",
  };
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

const textButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const textLink: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.5rem",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--radius-none)",
  cursor: "pointer",
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-heading)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  lineHeight: "var(--leading-tight)",
  letterSpacing: "var(--tracking-tight)",
};

export default function BrandForm({ mode, initial, slots }: Props) {
  const router = useRouter();
  const toast = useToast();

  const baseState = buildState(initial);
  const syncKey = JSON.stringify(baseState);

  const [form, setForm] = useState<FormState>(baseState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [langTab, setLangTab] = useState<Lang>("en");
  const [slugFollowsName, setSlugFollowsName] = useState(mode === "create");

  const [synced, setSynced] = useState(() => ({
    key: syncKey,
    base: baseState,
  }));
  const [justSaved, setJustSaved] = useState(false);
  if (synced.key !== syncKey) {
    const keepEdits =
      !justSaved && JSON.stringify(form) !== JSON.stringify(synced.base);
    setSynced({ key: syncKey, base: baseState });
    setJustSaved(false);
    if (!keepEdits) {
      setForm(baseState);
      setFieldErrors({});
    }
  }

  const dirty =
    mode === "edit" && JSON.stringify(form) !== JSON.stringify(synced.base);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function clearError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearError(key);
  }

  function text(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setField(key, e.target.value),
      error: fieldErrors[key],
    };
  }

  function discard() {
    setForm(synced.base);
    setFieldErrors({});
    setSlugFollowsName(mode === "create");
  }

  async function save() {
    if (pending) return;

    setPending(true);
    const saved = form;

    const payload = {
      nameEn: saved.nameEn,
      nameAr: saved.nameAr,
      nameRu: saved.nameRu,
      slug: saved.slug,
    };

    const result =
      mode === "create"
        ? await createBrandAction(payload)
        : await updateBrandAction(initial!.id, payload);

    setPending(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        if (Object.keys(errs).length > 0) {
          setFieldErrors(errs);
          const badLang = LANGS.find((l) => errs[NAME_KEY[l]]);
          if (badLang) setLangTab(badLang);
          return;
        }
      }
      toast.error(result.error);
      return;
    }

    if (mode === "create") {
      toast.success("Brand created.");
      const href = `/admin/brands/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      toast.success("Brand saved.");
      setSynced((prev) => ({ ...prev, base: saved }));
      setJustSaved(true);
      router.refresh();
    }
  }

  return (
    <div>
      {dirty && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #0b0b0b",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-bold)",
              color: "#0b0b0b",
            }}
          >
            Unsaved changes
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <button
              type="button"
              onClick={discard}
              disabled={pending}
              style={textButton}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending}
              style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            margin: 0,
            marginBottom: "1rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
          }}
        >
          <Link
            href="/admin/brands"
            style={{ color: "#0b0b0b", textDecoration: "underline" }}
          >
            Brands
          </Link>
        </p>
        {mode === "edit" && initial ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <h1 style={headingStyle}>{initial.nameEn}</h1>
              <p style={mutedText}>{initial.slug}</p>
            </div>
            <BrandPageActions
              brand={{
                id: initial.id,
                nameEn: initial.nameEn,
                slug: initial.slug,
                isVisible: initial.isVisible,
                productCount: initial.productCount,
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <h1 style={headingStyle}>New brand</h1>
            <p style={mutedText}>
              Add the brand here first, then pick it on products.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", minWidth: 0 }}>
        <div style={card}>
          <p style={cardTitle}>Name</p>
          <div
            role="tablist"
            aria-label="Language"
            style={{
              display: "flex",
              gap: "1.5rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            {LANGS.map((l) => {
              const active = langTab === l;
              const hasError = !!fieldErrors[NAME_KEY[l]];
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLangTab(l)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    background: "none",
                    border: "none",
                    borderBottom: active
                      ? "2px solid #0b0b0b"
                      : "2px solid transparent",
                    marginBottom: "-1px",
                    padding: "0.5rem 0",
                    fontSize: "var(--text-body)",
                    fontWeight: active ? "var(--font-bold)" : "var(--font-medium)",
                    color: active ? "#0b0b0b" : "#6b6b6b",
                    cursor: "pointer",
                  }}
                >
                  {LANG_LABEL[l]}
                  {hasError && (
                    <span
                      role="img"
                      aria-label="Has errors"
                      style={{
                        width: "0.5rem",
                        height: "0.5rem",
                        borderRadius: "50%",
                        backgroundColor: "#dc2626",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div style={stack}>
            <Input
              key={`name-${langTab}`}
              id={`bf-name-${langTab}`}
              label={`Name (${LANG_LABEL[langTab]})`}
              {...text(NAME_KEY[langTab])}
              onChange={(e) => {
                const value = e.target.value;
                setField(NAME_KEY[langTab], value);
                if (langTab === "en" && slugFollowsName) {
                  setField("slug", slugFromName(value));
                }
              }}
              required={langTab === "en"}
              optional={langTab !== "en" ? "optional" : undefined}
              dir={langTab === "ar" ? "rtl" : undefined}
              hint={
                langTab === "en"
                  ? "Shown in the store filter and on product cards."
                  : "Leave blank to show the English name."
              }
            />
            <Input
              id="bf-slug"
              label="Web handle"
              {...text("slug")}
              onChange={(e) => {
                const value = e.target.value;
                setField("slug", value);
                setSlugFollowsName(mode === "create" && value === "");
              }}
              required={mode === "edit"}
              optional={mode === "create" ? "optional" : undefined}
              dir="ltr"
              hint={
                mode === "create"
                  ? "Filled from the English name until you edit it. Leave blank to generate one."
                  : "Used in shop filter links. Changing it breaks old links."
              }
            />
          </div>
        </div>
      </div>

      {mode === "edit" && slots?.products}

      {mode === "create" && (
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Creating…" : "Create brand"}
          </button>
          <Link href="/admin/brands" style={textLink}>
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
