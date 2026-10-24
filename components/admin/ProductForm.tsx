"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ProductStatusMenu from "@/components/admin/ProductStatusMenu";
import {
  createProductAction,
  updateProductAction,
} from "@/lib/actions/product";
import { formatDateTime } from "@/lib/utils/date";
import { formatAED } from "@/lib/utils/currency";
import {
  dubaiDayEndIso,
  dubaiDayFromIso,
  dubaiDayStartIso,
} from "@/lib/utils/coupon-display";
import {
  computeOrderPointsWithRules,
  type EffectiveLoyaltyRule,
} from "@/lib/utils/loyalty-points";
import { slugFromName } from "@/lib/utils/slug";
import type { AdminProductEditProjection } from "@/lib/db/queries/products";

export interface ProductFormCategory {
  id: string;
  slug: string;
  nameEn: string;
  isVisible: boolean;
  children: {
    id: string;
    slug: string;
    nameEn: string;
    isVisible: boolean;
  }[];
}

interface Props {
  mode: "create" | "edit";
  initial?: AdminProductEditProjection;
  categoryTree: ProductFormCategory[];
  brandOptions: { id: string; nameEn: string; isVisible: boolean }[];
  slots?: {
    images?: ReactNode;
    inventory?: ReactNode;
    specs?: ReactNode;
    addons?: ReactNode;
  };
  imageCount?: number;
  specCount?: number;
  loyaltyProgram: { enabled: boolean; earnRate: number };
}

interface FormState {
  sku: string;
  nameEn: string;
  nameAr: string;
  nameRu: string;
  slugEn: string;
  categoryId: string;
  extraCategoryIds: string[];
  brandId: string;
  actionType: string;
  caliberMm: string;
  tags: string;
  price: string;
  compareAtPrice: string;
  openingStock: string;
  lowStockThreshold: string;
  weightGrams: string;
  requiresIdVerification: boolean;
  serialTracking: string;
  supportsAddons: boolean;
  b2bAvailable: boolean;
  isNewArrival: boolean;
  isFeatured: boolean;
  minOrderQty: string;
  maxOrderQty: string;
  sortOrder: string;
  loyaltyRule: string;
  loyaltyMultiplier: string;
  loyaltyPointsEarn: string;
  loyaltyStartsDay: string;
  loyaltyEndsDay: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionRu: string;
  metaTitleEn: string;
  metaTitleAr: string;
  metaTitleRu: string;
  metaDescriptionEn: string;
  metaDescriptionAr: string;
  metaDescriptionRu: string;
  internalNotes: string;
}

type StringKey = {
  [K in keyof FormState]: FormState[K] extends string ? K : never;
}[keyof FormState];

type BooleanKey = {
  [K in keyof FormState]: FormState[K] extends boolean ? K : never;
}[keyof FormState];

type Lang = "en" | "ar" | "ru";
type SectionKey = "addons" | "seo" | "advanced";

function buildState(initial?: AdminProductEditProjection): FormState {
  return {
    sku: initial?.sku ?? "",
    nameEn: initial?.nameEn ?? "",
    nameAr: initial?.nameAr ?? "",
    nameRu: initial?.nameRu ?? "",
    slugEn: initial?.slugEn ?? "",
    categoryId: initial?.categoryId ?? "",
    extraCategoryIds: [...(initial?.extraCategoryIds ?? [])].sort(),
    brandId: initial?.brandId ?? "",
    actionType: initial?.actionType ?? "",
    caliberMm: initial?.caliberMm != null ? String(initial.caliberMm) : "",
    tags: (initial?.tags ?? []).join(", "),
    price: initial?.price != null ? String(initial.price) : "",
    compareAtPrice:
      initial?.compareAtPrice != null ? String(initial.compareAtPrice) : "",
    openingStock: "0",
    lowStockThreshold: String(initial?.lowStockThreshold ?? 5),
    weightGrams: initial?.weightGrams != null ? String(initial.weightGrams) : "",
    requiresIdVerification: initial?.requiresIdVerification ?? false,
    serialTracking: initial?.serialTracking ?? "NONE",
    supportsAddons: initial?.supportsAddons ?? false,
    b2bAvailable: initial?.b2bAvailable ?? false,
    isNewArrival: initial?.isNewArrival ?? false,
    isFeatured: initial?.isFeatured ?? false,
    minOrderQty: String(initial?.minOrderQty ?? 1),
    maxOrderQty: initial?.maxOrderQty != null ? String(initial.maxOrderQty) : "",
    sortOrder: initial?.sortOrder != null ? String(initial.sortOrder) : "",
    loyaltyRule: initial?.loyaltyRule ?? "STANDARD",
    loyaltyMultiplier:
      initial?.loyaltyMultiplier != null ? String(initial.loyaltyMultiplier) : "",
    loyaltyPointsEarn: String(initial?.loyaltyPointsEarn ?? 0),
    loyaltyStartsDay: initial?.loyaltyRuleStartsAt
      ? dubaiDayFromIso(initial.loyaltyRuleStartsAt)
      : "",
    loyaltyEndsDay: initial?.loyaltyRuleEndsAt
      ? dubaiDayFromIso(initial.loyaltyRuleEndsAt)
      : "",
    descriptionEn: initial?.descriptionEn ?? "",
    descriptionAr: initial?.descriptionAr ?? "",
    descriptionRu: initial?.descriptionRu ?? "",
    metaTitleEn: initial?.metaTitleEn ?? "",
    metaTitleAr: initial?.metaTitleAr ?? "",
    metaTitleRu: initial?.metaTitleRu ?? "",
    metaDescriptionEn: initial?.metaDescriptionEn ?? "",
    metaDescriptionAr: initial?.metaDescriptionAr ?? "",
    metaDescriptionRu: initial?.metaDescriptionRu ?? "",
    internalNotes: initial?.internalNotes ?? "",
  };
}

const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const LANGS: Lang[] = ["en", "ar", "ru"];

const SECTION_FIELDS: Record<SectionKey, string[]> = {
  addons: [],
  seo: [
    "metaTitleEn",
    "metaTitleAr",
    "metaTitleRu",
    "metaDescriptionEn",
    "metaDescriptionAr",
    "metaDescriptionRu",
  ],
  advanced: [
    "tags",
    "b2bAvailable",
    "minOrderQty",
    "maxOrderQty",
    "weightGrams",
    "loyaltyPointsEarn",
    "loyaltyRule",
    "loyaltyMultiplier",
    "loyaltyRuleStartsAt",
    "loyaltyRuleEndsAt",
    "sortOrder",
  ],
};

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

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1rem",
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

interface CategoryInfo {
  id: string;
  slug: string;
  label: string;
  hidden: boolean;
}

function buildCategoryInfo(
  tree: ProductFormCategory[],
): Map<string, CategoryInfo> {
  const map = new Map<string, CategoryInfo>();
  for (const c of tree) {
    map.set(c.id, {
      id: c.id,
      slug: c.slug,
      label: c.nameEn,
      hidden: !c.isVisible,
    });
    for (const ch of c.children) {
      map.set(ch.id, {
        id: ch.id,
        slug: ch.slug,
        label: `${c.nameEn} › ${ch.nameEn}`,
        hidden: !c.isVisible || !ch.isVisible,
      });
    }
  }
  return map;
}

function CategoryStatusPill({ shown }: { shown: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        backgroundColor: shown ? "#dcfce7" : "#f3f4f6",
        color: shown ? "#166534" : "#374151",
      }}
    >
      {shown ? "Shown" : "Hidden"}
    </span>
  );
}

const taStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "var(--color-auth-input-text)",
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1.5px solid var(--color-auth-input-border)",
  borderRadius: "var(--radius-none)",
  outline: "none",
  resize: "vertical",
  minHeight: "6rem",
  fontFamily: "inherit",
  transition: "border-color 150ms",
};

function DateField({
  id,
  label,
  optional,
  hint,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? "var(--color-auth-input-border-focus)"
    : focused
      ? "var(--color-auth-input-border-focus)"
      : "var(--color-auth-input-border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-auth-label-text)",
        }}
      >
        {label}
        {optional && (
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-normal)",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            {optional}
          </span>
        )}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.625rem 0.875rem",
          fontSize: "var(--text-body)",
          color: "var(--color-auth-input-text)",
          backgroundColor: "var(--color-auth-input-bg)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-none)",
          outline: "none",
          transition: "border-color 150ms",
        }}
      />
      {error ? (
        <p
          role="alert"
          id={`${id}-error`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CheckmarkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckboxField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: "1rem",
            height: "1rem",
            border: "1.5px solid var(--color-auth-input-border)",
            backgroundColor: checked
              ? "var(--color-action-primary)"
              : "var(--color-auth-input-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 150ms, border-color 150ms",
          }}
        >
          {checked && <CheckmarkIcon />}
        </span>
        <span style={{ fontSize: "var(--text-body)", color: "#0b0b0b" }}>
          {label}
        </span>
      </label>
      {hint && (
        <p style={{ ...mutedText, paddingInlineStart: "1.625rem" }}>{hint}</p>
      )}
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  optional?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-auth-label-text)",
        }}
      >
        {label}
        {optional && (
          <span
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-normal)",
              color: "var(--color-auth-input-placeholder)",
            }}
          >
            {optional}
          </span>
        )}
      </label>
      <textarea
        id={id}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        style={{
          ...taStyle,
          borderColor: error
            ? "var(--color-auth-input-border-focus)"
            : "var(--color-auth-input-border)",
        }}
      />
      {error ? (
        <p
          role="alert"
          id={`${id}-error`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} style={mutedText}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-auth-form-border)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "1.25rem 1.5rem",
          fontSize: "var(--text-body-lg)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
        }}
      >
        {title}
      </summary>
      <div style={{ ...stack, padding: "0 1.5rem 1.5rem" }}>{children}</div>
    </details>
  );
}

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

function counterHint(value: string, max: number, text: string) {
  return `${value.length} / ${max} · ${text}`;
}

export default function ProductForm({
  mode,
  initial,
  categoryTree,
  brandOptions,
  slots,
  imageCount = 0,
  specCount = 0,
  loyaltyProgram,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<FormState>(() => buildState(initial));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [langTab, setLangTab] = useState<Lang>("en");
  const [slugFollowsName, setSlugFollowsName] = useState(mode === "create");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [extraSearch, setExtraSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    addons: false,
    seo: false,
    advanced: false,
  });

  const syncKey = initial ? new Date(initial.updatedAt).getTime() : 0;
  const [synced, setSynced] = useState(() => ({
    key: syncKey,
    base: buildState(initial),
  }));
  const [justSaved, setJustSaved] = useState(false);
  if (synced.key !== syncKey) {
    const keepEdits =
      !justSaved && JSON.stringify(form) !== JSON.stringify(synced.base);
    setSynced({ key: syncKey, base: buildState(initial) });
    setJustSaved(false);
    if (!keepEdits) {
      setForm(buildState(initial));
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
        setField(key, e.target.value),
      error: fieldErrors[key],
    };
  }

  function area(key: StringKey) {
    return {
      value: form[key],
      onChange: (v: string) => setField(key, v),
      error: fieldErrors[key],
    };
  }

  function check(key: BooleanKey) {
    return {
      checked: form[key],
      onChange: (v: boolean) => setField(key, v),
    };
  }

  function discard() {
    setForm(synced.base);
    setFieldErrors({});
    setSlugFollowsName(mode === "create");
  }

  function changeMainCategory(value: string) {
    setForm((prev) => ({
      ...prev,
      categoryId: value,
      extraCategoryIds: prev.extraCategoryIds.filter((id) => id !== value),
    }));
    clearError("categoryId");
  }

  function toggleExtraCategory(id: string) {
    setForm((prev) => ({
      ...prev,
      extraCategoryIds: prev.extraCategoryIds.includes(id)
        ? prev.extraCategoryIds.filter((c) => c !== id)
        : [...prev.extraCategoryIds, id].sort(),
    }));
    clearError("extraCategoryIds");
  }

  function toggleSection(key: SectionKey, open: boolean) {
    setOpenSections((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }));
  }

  async function save() {
    if (pending) return;
    setPending(true);

    const parsedTags = Array.from(
      new Set(
        form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );

    const basePayload = {
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      nameRu: form.nameRu,
      slugEn: form.slugEn,
      brandId: form.brandId,
      actionType: form.actionType,
      caliberMm: form.caliberMm,
      descriptionEn: form.descriptionEn,
      descriptionAr: form.descriptionAr,
      descriptionRu: form.descriptionRu,
      categoryId: form.categoryId,
      extraCategoryIds: form.extraCategoryIds,
      tags: parsedTags,
      price: form.price,
      compareAtPrice: form.compareAtPrice,
      lowStockThreshold: form.lowStockThreshold,
      weightGrams: form.weightGrams,
      requiresIdVerification: form.requiresIdVerification,
      serialTracking: form.serialTracking,
      supportsAddons: form.supportsAddons,
      b2bAvailable: form.b2bAvailable,
      minOrderQty: form.minOrderQty,
      maxOrderQty: form.maxOrderQty,
      isNewArrival: form.isNewArrival,
      isFeatured: form.isFeatured,
      sortOrder: form.sortOrder,
      loyaltyRule: form.loyaltyRule,
      loyaltyMultiplier:
        form.loyaltyRule === "BOOSTED" ? form.loyaltyMultiplier : "",
      loyaltyPointsEarn: form.loyaltyRule === "FIXED" ? form.loyaltyPointsEarn : "0",
      loyaltyRuleStartsAt:
        (form.loyaltyRule === "BOOSTED" || form.loyaltyRule === "FIXED") &&
        form.loyaltyStartsDay
          ? dubaiDayStartIso(form.loyaltyStartsDay)
          : "",
      loyaltyRuleEndsAt:
        (form.loyaltyRule === "BOOSTED" || form.loyaltyRule === "FIXED") &&
        form.loyaltyEndsDay
          ? dubaiDayEndIso(form.loyaltyEndsDay)
          : "",
      metaTitleEn: form.metaTitleEn,
      metaTitleAr: form.metaTitleAr,
      metaTitleRu: form.metaTitleRu,
      metaDescriptionEn: form.metaDescriptionEn,
      metaDescriptionAr: form.metaDescriptionAr,
      metaDescriptionRu: form.metaDescriptionRu,
      internalNotes: form.internalNotes,
    };

    const result =
      mode === "create"
        ? await createProductAction({
            ...basePayload,
            sku: form.sku,
            openingStock: form.openingStock,
          })
        : await updateProductAction(initial!.id, basePayload);

    setPending(false);

    if (!result.success) {
      if (result.fieldErrors) {
        const errs: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length > 0) errs[k] = msgs[0];
        }
        setFieldErrors(errs);

        const badLang = LANGS.find(
          (l) =>
            errs[`name${l === "en" ? "En" : l === "ar" ? "Ar" : "Ru"}`] ||
            errs[`description${l === "en" ? "En" : l === "ar" ? "Ar" : "Ru"}`],
        );
        if (badLang) setLangTab(badLang);

        setOpenSections((prev) => {
          const next = { ...prev };
          (Object.keys(SECTION_FIELDS) as SectionKey[]).forEach((key) => {
            if (SECTION_FIELDS[key].some((f) => errs[f])) next[key] = true;
          });
          return next;
        });
      }
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Product created." : "Product updated.");

    if (mode === "create") {
      const href = `/admin/products/${result.data.id}`;
      startNavigationProgress(href);
      router.push(href);
    } else {
      setJustSaved(true);
      router.refresh();
    }
  }

  const langSuffix = (l: Lang) => (l === "en" ? "En" : l === "ar" ? "Ar" : "Ru");
  const nameKey = (l: Lang) => `name${langSuffix(l)}` as StringKey;
  const descKey = (l: Lang) => `description${langSuffix(l)}` as StringKey;

  const categoryKnown = categoryTree.some(
    (c) => c.id === form.categoryId || c.children.some((ch) => ch.id === form.categoryId),
  );

  const brandKnown = brandOptions.some((b) => b.id === form.brandId);

  const loyaltyPriceNumber = Number(form.price.trim());
  const loyaltyPriceValid =
    form.price.trim() !== "" &&
    Number.isFinite(loyaltyPriceNumber) &&
    loyaltyPriceNumber > 0;
  const loyaltyMultiplierNumber = Number(form.loyaltyMultiplier.trim());
  const loyaltyMultiplierValid =
    form.loyaltyMultiplier.trim() !== "" &&
    Number.isFinite(loyaltyMultiplierNumber) &&
    loyaltyMultiplierNumber >= 1.1 &&
    loyaltyMultiplierNumber <= 10;
  const loyaltyFixedNumber = Number(form.loyaltyPointsEarn.trim());
  const loyaltyFixedValid =
    form.loyaltyPointsEarn.trim() !== "" &&
    Number.isInteger(loyaltyFixedNumber) &&
    loyaltyFixedNumber >= 1 &&
    loyaltyFixedNumber <= 100000;
  const loyaltyHasDates = form.loyaltyStartsDay !== "" || form.loyaltyEndsDay !== "";
  const loyaltyRateText = loyaltyProgram.earnRate.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

  function loyaltyUnitPoints(rule: EffectiveLoyaltyRule): number {
    return computeOrderPointsWithRules({
      lines: [{ lineTotal: loyaltyPriceNumber.toFixed(2), quantity: 1, rule }],
      discountTotal: "0.00",
      earnRate: loyaltyProgram.earnRate,
    });
  }

  function loyaltyPreview(): string {
    if (!loyaltyPriceValid) return "Enter a price to see the points.";
    if (form.loyaltyRule === "NONE") return "This product earns no points.";
    const standard = loyaltyUnitPoints({ kind: "STANDARD" });
    if (form.loyaltyRule === "BOOSTED") {
      if (!loyaltyMultiplierValid) return "Enter a multiplier to see the points.";
      const boosted = loyaltyUnitPoints({
        kind: "BOOSTED",
        multiplier: loyaltyMultiplierNumber,
      });
      return `One unit at ${formatAED(loyaltyPriceNumber)} earns ${boosted} points while the boost runs, and ${standard} points otherwise. Discounts reduce points at checkout.`;
    }
    if (form.loyaltyRule === "FIXED") {
      if (!loyaltyFixedValid) return "Enter points per unit to see the points.";
      return loyaltyHasDates
        ? `One unit earns ${loyaltyFixedNumber} points while the dates apply, and ${standard} points otherwise.`
        : `One unit earns ${loyaltyFixedNumber} points.`;
    }
    return `One unit earns ${standard} points at the store rate.`;
  }

  const currentCategory = (() => {
    const id = initial?.categoryId;
    for (const c of categoryTree) {
      if (c.id === id) return c;
      const child = c.children.find((ch) => ch.id === id);
      if (child) return child;
    }
    return null;
  })();

  const viewHref =
    initial && initial.publishStatus === "PUBLISHED" && currentCategory
      ? `/en/shop/${currentCategory.slug}/${initial.slugEn}`
      : null;

  const categoryInfo = buildCategoryInfo(categoryTree);
  const extraNeedle = extraSearch.trim().toLowerCase();
  const matchesExtra = (name: string) =>
    extraNeedle === "" || name.toLowerCase().includes(extraNeedle);
  const extraRows = form.extraCategoryIds.map(
    (id) =>
      categoryInfo.get(id) ?? { id, slug: "", label: id, hidden: true },
  );
  const mainLabel = categoryInfo.get(form.categoryId)?.label ?? form.categoryId;
  const listedCount = 1 + extraRows.length;
  const canViewExtras =
    mode === "edit" && initial?.publishStatus === "PUBLISHED";

  const readyStock =
    initial != null &&
    initial.stockQuantity > 0 &&
    initial.stockQuantity > initial.lowStockThreshold;

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
        <Link
          href="/admin/products"
          style={{
            display: "inline-block",
            marginBottom: "1rem",
            fontSize: "var(--text-body-sm)",
            color: "#0b0b0b",
            textDecoration: "underline",
          }}
        >
          Products
        </Link>
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexWrap: "wrap" }}>
                <ProductStatusMenu
                  productId={initial.id}
                  name={initial.nameEn}
                  status={initial.publishStatus}
                  dirty={dirty}
                />
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
              </div>
              <p style={mutedText}>
                SKU {initial.sku} · updated {formatDateTime(initial.updatedAt, "en")}
              </p>
            </div>
            {viewHref && (
              <a
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "var(--text-body)",
                  color: "#0b0b0b",
                  textDecoration: "underline",
                }}
              >
                View on store
              </a>
            )}
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
              New product
            </h1>
            <p style={mutedText}>
              Saved as a draft. Publish it from this page once it has an image.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px]">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", minWidth: 0 }}>
          <div style={card}>
            <p style={cardTitle}>Name and description</p>
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
                const hasError = !!(
                  fieldErrors[nameKey(l)] || fieldErrors[descKey(l)]
                );
                const emptyDescription = form[descKey(l)].trim() === "";
                const dot = hasError ? "#dc2626" : emptyDescription ? "#f59e0b" : null;
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
                        aria-label={hasError ? "Has errors" : "Description is empty"}
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
                id={`pf-name-${langTab}`}
                label={`Name (${LANG_LABEL[langTab]})`}
                {...text(nameKey(langTab))}
                onChange={(e) => {
                  const value = e.target.value;
                  setField(nameKey(langTab), value);
                  if (langTab === "en" && slugFollowsName) {
                    setField("slugEn", slugFromName(value));
                  }
                }}
                required={langTab !== "ru"}
                optional={langTab === "ru" ? "optional" : undefined}
                dir={langTab === "ar" ? "rtl" : undefined}
                hint="Shown on the store, in search and in emails."
              />
              <TextareaField
                key={`desc-${langTab}`}
                id={`pf-desc-${langTab}`}
                label={`Description (${LANG_LABEL[langTab]})`}
                {...area(descKey(langTab))}
                optional="optional"
                dir={langTab === "ar" ? "rtl" : undefined}
                hint="Shown open on the product page. Leave a blank line between paragraphs."
              />
              <Input
                id="pf-slug-en"
                label="Slug"
                {...text("slugEn")}
                onChange={(e) => {
                  const value = e.target.value;
                  setField("slugEn", value);
                  setSlugFollowsName(mode === "create" && value === "");
                }}
                required
                dir="ltr"
                hint={
                  mode === "create"
                    ? "Filled from the English name until you edit it. The web address: /shop/<category>/<slug>. If it is taken, the store adds -2, -3."
                    : "The web address: /shop/<category>/<slug>. Lowercase letters, numbers and hyphens. Changing it breaks old links."
                }
              />
            </div>
          </div>

          {mode === "edit" ? (
            slots?.images
          ) : (
            <div style={card}>
              <p style={mutedText}>
                Save the product to add images, stock adjustments, specifications
                and accessories.
              </p>
            </div>
          )}

          <div style={card}>
            <p style={cardTitle}>Pricing</p>
            <div style={grid2}>
              <Input
                id="pf-price"
                label="Price"
                {...text("price")}
                required
                inputMode="decimal"
                dir="ltr"
                hint="Selling price in AED, VAT included."
              />
              <Input
                id="pf-compare-at-price"
                label="Compare-at Price"
                {...text("compareAtPrice")}
                optional="optional"
                inputMode="decimal"
                dir="ltr"
                hint="Optional. Set it above the price to show a Sale badge with the old price struck through."
              />
            </div>
          </div>

          {mode === "edit" ? (
            slots?.inventory
          ) : (
            <div style={card}>
              <p style={cardTitle}>Inventory</p>
              <div style={grid2}>
                <Input
                  id="pf-opening-stock"
                  label="Opening Stock"
                  {...text("openingStock")}
                  inputMode="numeric"
                  dir="ltr"
                  hint="Units you have now. Recorded as an opening stock movement."
                />
                <Input
                  id="pf-low-stock-threshold"
                  label="Low Stock Threshold"
                  {...text("lowStockThreshold")}
                  inputMode="numeric"
                  dir="ltr"
                  hint="Customers and staff see Low stock when on-hand stock is at or below this number."
                />
              </div>
            </div>
          )}

          {mode === "edit" && slots?.specs}

          {mode === "edit" && (
            <Collapsible
              title="Accessories"
              open={openSections.addons}
              onToggle={(o) => toggleSection("addons", o)}
            >
              {slots?.addons}
            </Collapsible>
          )}

          <Collapsible
            title="Search engine listing"
            open={openSections.seo}
            onToggle={(o) => toggleSection("seo", o)}
          >
            {LANGS.map((l) => {
              const sfx = langSuffix(l);
              const titleKey = `metaTitle${sfx}` as StringKey;
              const descKeyMeta = `metaDescription${sfx}` as StringKey;
              return (
                <div key={l} style={stack}>
                  <Input
                    id={`pf-meta-title-${l}`}
                    label={`Meta Title (${LANG_LABEL[l]})`}
                    {...text(titleKey)}
                    optional="optional"
                    dir={l === "ar" ? "rtl" : undefined}
                    hint={counterHint(
                      form[titleKey],
                      60,
                      "Shown in search results and the browser tab. Leave blank to use the product name.",
                    )}
                  />
                  <TextareaField
                    id={`pf-meta-desc-${l}`}
                    label={`Meta Description (${LANG_LABEL[l]})`}
                    {...area(descKeyMeta)}
                    optional="optional"
                    dir={l === "ar" ? "rtl" : undefined}
                    hint={counterHint(
                      form[descKeyMeta],
                      160,
                      "Shown under the title in search results. Leave blank to use the start of the description.",
                    )}
                  />
                </div>
              );
            })}
          </Collapsible>

          <Collapsible
            title="Advanced"
            open={openSections.advanced}
            onToggle={(o) => toggleSection("advanced", o)}
          >
            <Input
              id="pf-tags"
              label="Tags"
              {...text("tags")}
              optional="optional"
              placeholder="Comma-separated"
              hint="Saved, but the store doesn't use it yet."
            />
            <CheckboxField
              id="pf-b2b-available"
              label="B2B Available"
              hint="Saved, but the store doesn't use it yet."
              {...check("b2bAvailable")}
            />
            <div style={grid2}>
              <Input
                id="pf-min-order-qty"
                label="Min Order Qty"
                {...text("minOrderQty")}
                inputMode="numeric"
                dir="ltr"
                hint="Saved, but the store doesn't use it yet."
              />
              <Input
                id="pf-max-order-qty"
                label="Max Order Qty"
                {...text("maxOrderQty")}
                optional="optional"
                inputMode="numeric"
                dir="ltr"
                hint="Saved, but the store doesn't use it yet."
              />
              <Input
                id="pf-weight-grams"
                label="Weight (grams)"
                {...text("weightGrams")}
                optional="optional"
                inputMode="numeric"
                dir="ltr"
                hint="Saved, but the store doesn't use it yet."
              />
              <Input
                id="pf-sort-order"
                label="Sort Order"
                {...text("sortOrder")}
                optional="optional"
                inputMode="numeric"
                dir="ltr"
                hint="Lower numbers come first when customers sort by Featured."
              />
            </div>
            <div style={stack}>
              <p style={{ ...cardTitle, fontSize: "var(--text-body)" }}>
                Loyalty points
              </p>
              <Select
                id="pf-loyalty-rule"
                label="Earning rule"
                {...text("loyaltyRule")}
                hint="Standard follows the store rate. Boosted multiplies it. Fixed points sets points per unit. No points turns earning off for this product."
              >
                <option value="STANDARD">Standard</option>
                <option value="BOOSTED">Boosted</option>
                <option value="FIXED">Fixed points</option>
                <option value="NONE">No points</option>
              </Select>
              {form.loyaltyRule === "BOOSTED" && (
                <Input
                  id="pf-loyalty-multiplier"
                  label="Multiplier"
                  {...text("loyaltyMultiplier")}
                  inputMode="decimal"
                  dir="ltr"
                  hint={`1.1 to 10, one decimal. Multiplies the store rate of ${loyaltyRateText} ${loyaltyProgram.earnRate === 1 ? "point" : "points"} per AED 1.`}
                />
              )}
              {form.loyaltyRule === "FIXED" && (
                <Input
                  id="pf-loyalty-fixed-points"
                  label="Points per unit"
                  {...text("loyaltyPointsEarn")}
                  inputMode="numeric"
                  dir="ltr"
                  hint="Whole number, 1 to 100,000. Replaces the store rate."
                />
              )}
              {(form.loyaltyRule === "BOOSTED" || form.loyaltyRule === "FIXED") && (
                <>
                  <div style={grid2}>
                    <DateField
                      id="pf-loyalty-starts"
                      label="Starts"
                      optional="optional"
                      value={form.loyaltyStartsDay}
                      onChange={(v) => {
                        setField("loyaltyStartsDay", v);
                        clearError("loyaltyRuleStartsAt");
                      }}
                      error={fieldErrors.loyaltyRuleStartsAt}
                    />
                    <DateField
                      id="pf-loyalty-ends"
                      label="Ends"
                      optional="optional"
                      value={form.loyaltyEndsDay}
                      onChange={(v) => {
                        setField("loyaltyEndsDay", v);
                        clearError("loyaltyRuleEndsAt");
                      }}
                      error={fieldErrors.loyaltyRuleEndsAt}
                    />
                  </div>
                  <p style={mutedText}>
                    Dubai dates, whole days. Outside them the product earns the store rate.
                  </p>
                </>
              )}
              <div
                style={{
                  padding: "0.625rem 0.875rem",
                  fontSize: "var(--text-body-sm)",
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  color: "#0b0b0b",
                }}
              >
                {loyaltyPreview()}
              </div>
              {!loyaltyProgram.enabled && (
                <div
                  style={{
                    padding: "0.625rem 0.875rem",
                    fontSize: "var(--text-body-sm)",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                  }}
                >
                  Earning is paused store-wide. Rules apply again when it&apos;s switched on.
                </div>
              )}
            </div>
          </Collapsible>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: "1.5rem", minWidth: 0 }}>
          {mode === "edit" && initial && (
            <div style={sideCard}>
              <p style={cardTitle}>Ready to sell</p>
              <ul style={{ ...stack, gap: "0.625rem", margin: 0, padding: 0 }}>
                <ReadyRow
                  ok={imageCount > 0}
                  label="Main image"
                  note="Required to publish"
                  failTone="error"
                />
                <ReadyRow
                  ok={form.nameEn.trim() !== "" && form.nameAr.trim() !== ""}
                  label="English and Arabic names"
                />
                <ReadyRow
                  ok={form.descriptionEn.trim() !== ""}
                  label="English description"
                />
                <ReadyRow
                  ok={form.descriptionAr.trim() !== ""}
                  label="Arabic description"
                />
                <ReadyRow
                  ok={form.nameRu.trim() !== "" && form.descriptionRu.trim() !== ""}
                  label="Russian name and description"
                />
                <ReadyRow ok={specCount > 0} label="Specifications" />
                <ReadyRow ok={readyStock} label="Stock above the low-stock level" />
              </ul>
            </div>
          )}

          <div id="category" style={sideCard}>
            <p style={cardTitle}>Organization</p>
            <div style={stack}>
              <Select
                id="pf-category"
                label="Main category"
                {...text("categoryId")}
                onChange={(e) => changeMainCategory(e.target.value)}
                required
                hint="Sets the web address and breadcrumb. Links to its old address keep working."
              >
                <option value="">— Select category —</option>
                {!categoryKnown && form.categoryId && (
                  <option value={form.categoryId}>{form.categoryId} (current)</option>
                )}
                {categoryTree.map((c) =>
                  c.children.length === 0 ? (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                      {c.isVisible ? "" : " (hidden)"}
                    </option>
                  ) : (
                    <optgroup
                      key={c.id}
                      label={`${c.nameEn}${c.isVisible ? "" : " (hidden)"}`}
                    >
                      <option value={c.id}>{c.nameEn}</option>
                      {c.children.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {"\u00a0\u00a0"}
                          {ch.nameEn}
                          {ch.isVisible ? "" : " (hidden)"}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </Select>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--color-auth-label-text)",
                    }}
                  >
                    Also in · {extraRows.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExtrasOpen((o) => !o)}
                    style={{ ...textButton, fontSize: "var(--text-body-sm)" }}
                  >
                    Edit categories
                  </button>
                </div>

                {extraRows.length === 0 ? (
                  <p style={mutedText}>Only in its main category.</p>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      border: "1px solid var(--color-shop-divider)",
                    }}
                  >
                    {extraRows.map((c, i) => (
                      <li
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "0.5rem 0.75rem",
                          padding: "0.5rem 0.75rem",
                          borderTop:
                            i === 0 ? "none" : "1px solid var(--color-shop-divider)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                            minWidth: 0,
                          }}
                        >
                          <Link
                            href={`/admin/categories/${c.id}`}
                            onClick={() =>
                              startNavigationProgress(`/admin/categories/${c.id}`)
                            }
                            style={{
                              fontSize: "var(--text-body-sm)",
                              color: "#0b0b0b",
                              textDecoration: "underline",
                            }}
                          >
                            {c.label}
                          </Link>
                          <CategoryStatusPill shown={!c.hidden} />
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          {canViewExtras && !c.hidden && c.slug && initial && (
                            <a
                              href={`/en/shop/${c.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "var(--text-body-sm)",
                                color: "#0b0b0b",
                                textDecoration: "underline",
                                whiteSpace: "nowrap",
                              }}
                            >
                              View on store ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExtraCategory(c.id)}
                            style={{
                              ...textButton,
                              fontSize: "var(--text-body-sm)",
                              color: "#991b1b",
                            }}
                          >
                            Remove
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {fieldErrors.extraCategoryIds && (
                  <p
                    role="alert"
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-auth-error-text)",
                      margin: 0,
                    }}
                  >
                    {fieldErrors.extraCategoryIds}
                  </p>
                )}

                {extrasOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      padding: "0.75rem",
                      border: "1px solid var(--color-shop-divider)",
                    }}
                  >
                    <Input
                      id="pf-extra-search"
                      label="Search categories"
                      value={extraSearch}
                      onChange={(e) => setExtraSearch(e.target.value)}
                    />
                    <div style={{ columnCount: 2, columnGap: "1rem" }}>
                      {categoryTree.map((c) => {
                        const children = c.children.filter(
                          (ch) => matchesExtra(c.nameEn) || matchesExtra(ch.nameEn),
                        );
                        if (!matchesExtra(c.nameEn) && children.length === 0) {
                          return null;
                        }
                        const rows: {
                          id: string;
                          name: string;
                          hidden: boolean;
                          child: boolean;
                        }[] = [
                          {
                            id: c.id,
                            name: c.nameEn,
                            hidden: !c.isVisible,
                            child: false,
                          },
                          ...children.map((ch) => ({
                            id: ch.id,
                            name: ch.nameEn,
                            hidden: !c.isVisible || !ch.isVisible,
                            child: true,
                          })),
                        ];
                        return (
                          <div
                            key={c.id}
                            style={{
                              breakInside: "avoid",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.375rem",
                              marginBottom: "0.625rem",
                            }}
                          >
                            {rows.map((r) => {
                              const isMain = r.id === form.categoryId;
                              return (
                                <label
                                  key={r.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    paddingInlineStart: r.child ? "1rem" : 0,
                                    fontSize: "var(--text-body-sm)",
                                    fontWeight: r.child
                                      ? "var(--font-normal)"
                                      : "var(--font-bold)",
                                    color: isMain ? "#6b6b6b" : "#0b0b0b",
                                    cursor: isMain ? "not-allowed" : "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      isMain ||
                                      form.extraCategoryIds.includes(r.id)
                                    }
                                    disabled={isMain}
                                    onChange={() => toggleExtraCategory(r.id)}
                                    style={{
                                      width: 16,
                                      height: 16,
                                      flexShrink: 0,
                                      accentColor: "#0b0b0b",
                                    }}
                                  />
                                  <span>
                                    {r.name}
                                    {isMain ? " · Main" : ""}
                                    {r.hidden ? " (hidden)" : ""}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <p style={mutedText}>
                      A parent and its subcategory can both be ticked.
                    </p>
                    <button
                      type="button"
                      onClick={() => setExtrasOpen(false)}
                      style={{
                        ...textButton,
                        fontSize: "var(--text-body-sm)",
                        alignSelf: "flex-start",
                      }}
                    >
                      Done
                    </button>
                  </div>
                )}

                {form.categoryId && (
                  <p style={mutedText}>
                    Lists on {listedCount} category{" "}
                    {listedCount === 1 ? "page" : "pages"}: {mainLabel} (main)
                    {extraRows.length > 0
                      ? `, ${extraRows.map((c) => c.label).join(", ")}`
                      : ""}
                    .
                  </p>
                )}
              </div>
              <Select
                id="pf-brand"
                label="Brand"
                {...text("brandId")}
                required
                hint="Add or rename brands in Catalog › Brands."
              >
                <option value="">— Select brand —</option>
                {!brandKnown && form.brandId && (
                  <option value={form.brandId}>{form.brandId} (current)</option>
                )}
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameEn}
                    {b.isVisible ? "" : " (hidden)"}
                  </option>
                ))}
              </Select>
              <Select
                id="pf-action-type"
                label="Action Type"
                {...text("actionType")}
                required
                hint="Used by the store's action type filter."
              >
                <option value="">— Select action type —</option>
                <option value="Spring">Spring</option>
                <option value="PCP">PCP</option>
                <option value="CO2">CO2</option>
                <option value="Gas_Ram">Gas Ram</option>
                <option value="Multi_Pump">Multi Pump</option>
                <option value="NA">N/A</option>
              </Select>
              <Input
                id="pf-caliber"
                label="Caliber (mm)"
                {...text("caliberMm")}
                optional="optional"
                inputMode="decimal"
                dir="ltr"
                hint="In millimetres, for example 4.5. Used by the caliber filter."
              />
              <Input
                id="pf-sku"
                label="SKU"
                {...text("sku")}
                required={mode === "create"}
                readOnly={mode === "edit"}
                disabled={mode === "edit"}
                dir="ltr"
                hint={
                  mode === "create"
                    ? "Your internal code. Letters, numbers, dots, dashes and underscores. It can't be changed later."
                    : undefined
                }
              />
            </div>
          </div>

          <div style={sideCard}>
            <p style={cardTitle}>Sales rules</p>
            <div style={stack}>
              <CheckboxField
                id="pf-requires-id"
                label="Requires ID Verification"
                hint="Customers need an approved ID verification before checkout."
                {...check("requiresIdVerification")}
              />
              <Select
                id="pf-serial-tracking"
                label="Serial tracking"
                {...text("serialTracking")}
                hint="Every unit is checked before packing. On Serial or Lot products only staff with override permission can mark a unit as having no serial."
              >
                <option value="NONE">
                  Optional — staff record a serial or tick No serial
                </option>
                <option value="SERIAL">
                  Serial required — one unique serial per unit
                </option>
                <option value="LOT">
                  Lot required — lot or batch number per unit
                </option>
              </Select>
              <CheckboxField
                id="pf-featured"
                label="Featured"
                hint="Listed first when customers sort by Featured."
                {...check("isFeatured")}
              />
              <CheckboxField
                id="pf-new-arrival"
                label="New Arrival"
                hint="Shows a New Arrival badge."
                {...check("isNewArrival")}
              />
              {mode === "edit" && (
                <Input
                  id="pf-low-stock-threshold"
                  label="Low Stock Threshold"
                  {...text("lowStockThreshold")}
                  inputMode="numeric"
                  dir="ltr"
                  hint="Customers and staff see Low stock when on-hand stock is at or below this number."
                />
              )}
            </div>
          </div>

          <div style={sideCard}>
            <p style={cardTitle}>Internal notes</p>
            <TextareaField
              id="pf-internal-notes"
              label="Internal Notes"
              {...area("internalNotes")}
              optional="optional"
              hint="Staff only. Never shown to customers."
            />
          </div>
        </aside>
      </div>

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
            {pending ? "Creating…" : "Create product"}
          </button>
          <Link
            href="/admin/products"
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              textDecoration: "underline",
            }}
          >
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}
