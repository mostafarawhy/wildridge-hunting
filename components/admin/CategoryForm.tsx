"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import CategoryPageActions from "@/components/admin/CategoryPageActions";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/category";
import { slugFromName } from "@/lib/utils/slug";
import type { AdminCategoryDetail } from "@/lib/db/queries/categories";

export interface CategoryFormParent {
  id: string;
  nameEn: string;
  isVisible: boolean;
}

interface Props {
  mode: "create" | "edit";
  initial?: AdminCategoryDetail;
  parentOptions: CategoryFormParent[];
  initialParentId?: string;
  slots?: {
    products?: ReactNode;
  };
}

interface FormState {
  nameEn: string;
  nameAr: string;
  nameRu: string;
  slug: string;
  placement: "top" | "sub";
  navGroup: string;
  parentId: string;
  displayOrder: string;
}

type StringKey = {
  [K in keyof FormState]: FormState[K] extends string ? K : never;
}[keyof FormState];

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

function buildState(
  initial?: AdminCategoryDetail,
  initialParentId?: string,
): FormState {
  const parentId = initial?.parentId ?? initialParentId ?? "";
  return {
    nameEn: initial?.nameEn ?? "",
    nameAr: initial?.nameAr ?? "",
    nameRu: initial?.nameRu ?? "",
    slug: initial?.slug ?? "",
    placement: parentId ? "sub" : "top",
    navGroup: initial?.navGroup ?? "",
    parentId,
    displayOrder: initial ? String(initial.displayOrder) : "0",
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

const sideCard: React.CSSProperties = {
  ...card,
  padding: "1.25rem",
  gap: "1rem",
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

function ReadyRow({
  ok,
  label,
  note,
  failTone = "warn",
}: {
  ok: boolean;
  label: string;
  note?: string;
  failTone?: "warn" | "error";
}) {
  const color = ok ? "#166534" : failTone === "error" ? "#991b1b" : "#b45309";
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
        fontSize: "var(--text-body)",
        color: "#0b0b0b",
        listStyle: "none",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        role="img"
        aria-label={ok ? "Done" : "Needs attention"}
        style={{ flexShrink: 0, marginTop: "0.125rem", color }}
      >
        {ok ? (
          <path
            d="M5 12.5l4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              d="M12 4l9 16H3L12 4z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 10v4M12 17.25v.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <span>
        {label}
        {note && !ok && (
          <span style={{ display: "block", ...mutedText, color }}>{note}</span>
        )}
      </span>
    </li>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function CategoryForm({
  mode,
  initial,
  parentOptions,
  initialParentId,
  slots,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const baseState = buildState(initial, initialParentId);
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

  function text(key: StringKey) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setField(key, e.target.value as FormState[typeof key]),
      error: fieldErrors[key],
    };
  }

  function discard() {
    setForm(synced.base);
    setFieldErrors({});
    setSlugFollowsName(mode === "create");
  }

  function go(href: string) {
    startNavigationProgress(href);
  }

  async function save() {
    if (pending) return;

    const sub = form.placement === "sub";
    if (sub && !form.parentId) {
      setFieldErrors({ parentId: "Choose a parent category." });
      return;
    }

    setPending(true);
    const saved = form;

    const payload = {
      nameEn: saved.nameEn,
      nameAr: saved.nameAr,
      nameRu: saved.nameRu,
      slug: saved.slug,
      parentId: sub ? saved.parentId : null,
      navGroup: sub ? null : saved.navGroup || null,
      displayOrder: saved.displayOrder,
    };

    const result =
      mode === "create"
        ? await createCategoryAction(payload)
        : await updateCategoryAction(initial!.id, payload);

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
      toast.success("Category created.");
      const href = `/admin/categories/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      toast.success("Category saved.");
      setSynced((prev) => ({ ...prev, base: saved }));
      setJustSaved(true);
      router.refresh();
    }
  }

  const hasChildren = mode === "edit" && (initial?.childCount ?? 0) > 0;
  const sub = form.placement === "sub";

  const placementButton = (active: boolean, disabled = false) => ({
    ...blackButton,
    opacity: active ? 1 : 0.45,
    cursor: disabled ? "not-allowed" : "pointer",
  });

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
            href="/admin/categories"
            style={{ color: "#0b0b0b", textDecoration: "underline" }}
          >
            Categories
          </Link>
          {mode === "edit" && initial?.parent && (
            <>
              {" / "}
              <Link
                href={`/admin/categories/${initial.parent.id}`}
                onClick={() => go(`/admin/categories/${initial.parent!.id}`)}
                style={{ color: "#0b0b0b", textDecoration: "underline" }}
              >
                {initial.parent.nameEn}
              </Link>
            </>
          )}
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
              <h1
                style={{
                  margin: 0,
                  fontSize: "var(--text-heading)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "var(--tracking-tight)",
                }}
              >
                {initial.nameEn}
              </h1>
              <p style={mutedText}>/shop/{initial.slug}</p>
            </div>
            <CategoryPageActions
              category={{
                id: initial.id,
                nameEn: initial.nameEn,
                slug: initial.slug,
                isVisible: initial.isVisible,
                parentId: initial.parentId,
                productCount: initial.productCount,
                extraProductCount: initial.extraProductCount,
                childCount: initial.childCount,
              }}
              parents={parentOptions}
              dirty={dirty}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--text-heading)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                lineHeight: "var(--leading-tight)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              New category
            </h1>
            <p style={mutedText}>
              Choose where it sits in the store menu, then add products to it.
            </p>
          </div>
        )}
      </div>

      <div
        className={
          mode === "edit"
            ? "grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]"
            : "grid grid-cols-1 gap-6"
        }
      >
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
                const emptyOptional = l === "ru" && form.nameRu.trim() === "";
                const dot = hasError ? "#dc2626" : emptyOptional ? "#f59e0b" : null;
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
                    {dot && (
                      <span
                        role="img"
                        aria-label={hasError ? "Has errors" : "Name is empty"}
                        style={{
                          width: "0.5rem",
                          height: "0.5rem",
                          borderRadius: "50%",
                          backgroundColor: dot,
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
                id={`cf-name-${langTab}`}
                label={`Name (${LANG_LABEL[langTab]})`}
                {...text(NAME_KEY[langTab])}
                onChange={(e) => {
                  const value = e.target.value;
                  setField(NAME_KEY[langTab], value);
                  if (langTab === "en" && slugFollowsName) {
                    setField("slug", slugFromName(value));
                  }
                }}
                required={langTab !== "ru"}
                optional={langTab === "ru" ? "optional" : undefined}
                dir={langTab === "ar" ? "rtl" : undefined}
                hint="Shown in the store menu, on the category page and in filters."
              />
              <Input
                id="cf-slug"
                label="Web address"
                {...text("slug")}
                onChange={(e) => {
                  const value = e.target.value;
                  setField("slug", value);
                  setSlugFollowsName(mode === "create" && value === "");
                }}
                required
                dir="ltr"
                hint={
                  mode === "create"
                    ? "Filled from the English name until you edit it. The page lives at /shop/<web address>."
                    : "The page lives at /shop/<web address>. Changing it breaks old links."
                }
              />
            </div>
          </div>

          <div style={card}>
            <p style={cardTitle}>Placement</p>
            <div style={stack}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <div
                  role="group"
                  aria-label="Placement"
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    aria-pressed={!sub}
                    onClick={() => {
                      setField("placement", "top");
                      clearError("parentId");
                    }}
                    style={placementButton(!sub)}
                  >
                    Top level
                  </button>
                  <button
                    type="button"
                    aria-pressed={sub}
                    disabled={hasChildren}
                    onClick={() => setField("placement", "sub")}
                    style={placementButton(sub, hasChildren)}
                  >
                    Subcategory
                  </button>
                </div>
                {hasChildren && (
                  <p style={mutedText}>
                    It has subcategories, so it stays at the top level.
                  </p>
                )}
              </div>
              {sub ? (
                <Select
                  id="cf-parent"
                  label="Parent"
                  {...text("parentId")}
                  required
                >
                  <option value="">— Select parent —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn}
                      {p.isVisible ? "" : " (hidden)"}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  id="cf-nav-group"
                  label="Menu group"
                  {...text("navGroup")}
                  hint="Categories in a group share one heading in the store menu."
                >
                  <option value="">None — its own menu item</option>
                  <option value="RIFLES">Rifles &amp; Pistols</option>
                  <option value="OPTICS">Optics</option>
                  <option value="AMMO">Ammo</option>
                  <option value="ACCESSORIES">Accessories</option>
                </Select>
              )}
              <Input
                id="cf-display-order"
                type="number"
                min={0}
                label="Display order"
                {...text("displayOrder")}
                inputMode="numeric"
                dir="ltr"
                hint="Lower numbers show first among categories at the same level."
              />
            </div>
          </div>
        </div>

        {mode === "edit" && initial && (
          <aside style={{ display: "flex", flexDirection: "column", gap: "1.5rem", minWidth: 0 }}>
            <div style={sideCard}>
              <p style={cardTitle}>Ready for the store</p>
              <ul style={{ ...stack, gap: "0.625rem", margin: 0, padding: 0 }}>
                <ReadyRow
                  ok={form.nameEn.trim() !== "" && form.nameAr.trim() !== ""}
                  label="English and Arabic names"
                />
                <ReadyRow ok={form.nameRu.trim() !== ""} label="Russian name" />
                <ReadyRow
                  ok={initial.productCount > 0 || initial.extraProductCount > 0 || initial.childCount > 0}
                  label="Has products"
                  note="An empty category shows an empty page."
                />
                <ReadyRow ok={initial.isVisible} label="Shown in the store" />
              </ul>
            </div>

            {!initial.parent && (
              <div style={sideCard}>
                <p style={cardTitle}>Subcategories</p>
                <div style={stack}>
                  {initial.children.length === 0 ? (
                    <p style={mutedText}>No subcategories.</p>
                  ) : (
                    <ul style={{ ...stack, gap: "0.75rem", margin: 0, padding: 0 }}>
                      {initial.children.map((c) => (
                        <li key={c.id} style={{ listStyle: "none" }}>
                          <Link
                            href={`/admin/categories/${c.id}`}
                            onClick={() => go(`/admin/categories/${c.id}`)}
                            style={textLink}
                          >
                            {c.nameEn}
                          </Link>
                          <p style={mutedText}>
                            {plural(c.productCount, "product", "products")} ·{" "}
                            {c.isVisible ? "Shown" : "Hidden"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/admin/categories/new?parent=${initial.id}`}
                    onClick={() => go(`/admin/categories/new?parent=${initial.id}`)}
                    style={textLink}
                  >
                    Add subcategory
                  </Link>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {mode === "edit" && slots?.products}

      {mode === "create" && (
        <p style={{ ...mutedText, marginTop: "1.5rem" }}>
          New categories start hidden. Show it from its page when it&apos;s ready.
        </p>
      )}

      {mode === "create" && (
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            marginTop: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Creating…" : "Create category"}
          </button>
          <Link href="/admin/categories" style={textLink}>
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
