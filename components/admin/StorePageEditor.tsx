"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { BRAND } from "@/lib/config/brand";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import ContentSaveBar from "@/components/admin/ContentSaveBar";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import {
  saveStorePageAction,
  setStorePagePublishedAction,
} from "@/lib/actions/store-page";
import { PAGE_CONFIG, type PageGroup, type PageKey } from "@/lib/utils/page-keys";
import { parsePageContent, parseFaqContent } from "@/lib/utils/page-blocks";
import {
  toggleLinePrefix,
  insertBlock,
  insertLink,
  lintPageContent,
  type LintIssue,
} from "@/lib/utils/page-editor";
import { PageBlocks } from "@/components/pages/PageBlocks";
import { PageInline } from "@/components/pages/PageInline";
import type { AdminStorePageRow } from "@/lib/db/queries/admin-pages";

type Locale = "en" | "ar" | "ru";

interface Props {
  pageKey: PageKey;
  initialRow: AdminStorePageRow;
  staffName: string;
  sectionsSlot?: React.ReactNode;
}

type TabId = "header" | "content" | "search";

interface LocaleFormState {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
}

interface FieldErrors {
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
}

const LOCALES: Locale[] = ["en", "ar", "ru"];
const LOCALE_TAB_LABELS: Record<Locale, string> = {
  en: "ENGLISH",
  ar: "ARABIC",
  ru: "RUSSIAN",
};
const TABS: { id: TabId; label: string }[] = [
  { id: "header", label: "Page header" },
  { id: "content", label: "Page content" },
  { id: "search", label: "Search results" },
];
const SKETCH_BY_TAB = { header: "header", content: "body", search: "search" } as const;

const EYEBROW_EN: Record<PageGroup, string> = {
  legal: "Legal",
  care: "Customer care",
  help: "Help centre",
  company: "Our story",
};

function buildForms(row: AdminStorePageRow): Record<Locale, LocaleFormState> {
  return {
    en: {
      title: row.titleEn,
      content: row.contentEn ?? "",
      metaTitle: row.metaTitleEn ?? "",
      metaDescription: row.metaDescriptionEn ?? "",
    },
    ar: {
      title: row.titleAr,
      content: row.contentAr ?? "",
      metaTitle: row.metaTitleAr ?? "",
      metaDescription: row.metaDescriptionAr ?? "",
    },
    ru: {
      title: row.titleRu ?? "",
      content: row.contentRu ?? "",
      metaTitle: row.metaTitleRu ?? "",
      metaDescription: row.metaDescriptionRu ?? "",
    },
  };
}

function statesEqual(a: LocaleFormState, b: LocaleFormState): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.metaTitle === b.metaTitle &&
    a.metaDescription === b.metaDescription
  );
}

function formatSavedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}

function lintMessage(issue: LintIssue): string {
  if (issue.code === "LIST_NEEDS_GAP")
    return `Line ${issue.line}: add an empty line before this list, or it shows as plain text.`;
  if (issue.code === "BLOCK_NEEDS_GAP")
    return `Line ${issue.line}: add an empty line above this heading or box, or it shows as plain text.`;
  if (issue.code === "MISSING_SPACE")
    return `Line ${issue.line}: add a space after the mark so it is formatted.`;
  if (issue.code === "BAD_LINK")
    return `Line ${issue.line}: the link ${issue.detail} will not work. Use /page, https://, mailto: or tel:.`;
  if (issue.code === "FAQ_EMPTY_CATEGORY")
    return `Category "${issue.detail}" has no questions yet.`;
  if (issue.code === "FAQ_TEXT_BEFORE_QUESTION")
    return `Line ${issue.line}: text under a category before its first question is not shown.`;
  if (issue.code === "LINK_PLACEHOLDER")
    return `Line ${issue.line}: replace the sample link text or /page with the real link.`;
  return issue.detail === "1"
    ? "1 placeholder in [brackets] still to replace."
    : `${issue.detail} placeholders in [brackets] still to replace.`;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "0",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "var(--color-auth-label-text)",
};

function EnabledSwitch({
  enabled,
  disabled,
  pending,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled || pending}
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
        cursor: disabled || pending ? "not-allowed" : "pointer",
        opacity: disabled || pending ? 0.5 : 1,
        transition: "background-color 150ms",
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

function HeadingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function SubheadingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="8" y1="8" x2="20" y2="8" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function NumberedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <text x="1" y="9" fontSize="7" fill="currentColor" stroke="none">1</text>
      <text x="1" y="17" fontSize="7" fill="currentColor" stroke="none">2</text>
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </svg>
  );
}

function KeyPointsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="4 12 9 17 20 6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 15l6-6" />
      <path d="M11 6l1-1a4 4 0 115 5l-1 1" />
      <path d="M13 18l-1 1a4 4 0 11-5-5l1-1" />
    </svg>
  );
}

function ToolbarDivider() {
  return <div aria-hidden style={{ width: "1px", alignSelf: "stretch", backgroundColor: "#e8e8e8" }} />;
}

function ToolbarButton({
  icon,
  label,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: "32px",
        padding: "0 10px",
        fontSize: "13px",
        color: "#0b0b0b",
        backgroundColor: "#ffffff",
        border: "1px solid #c9c4be",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

const FORMATTING_TABLE_ROWS: { youType: string; customersSee: string; example: string }[] = [
  { youType: "(empty line)", customersSee: "a new paragraph", example: "" },
  { youType: "(first paragraph)", customersSee: "the introduction under the page title", example: "" },
  {
    youType: "##",
    customersSee: "a section heading listed in On this page (FAQ: a category)",
    example: "## Delivery times",
  },
  {
    youType: "###",
    customersSee: "a sub-heading (FAQ: a question; the text below it is the answer)",
    example: "### How long does delivery take?",
  },
  { youType: "-", customersSee: "a bullet list, one line per item", example: "- Free returns" },
  { youType: "1.", customersSee: "numbered steps", example: "1. Contact us" },
  {
    youType: "- Label: value",
    customersSee: "a two-column table when every line reads Label: value",
    example: "- Standard: 1–2 working days",
  },
  {
    youType: "> ",
    customersSee: "a grey note box, the first line its title",
    example: "> Before you visit\n> Bring your Emirates ID",
  },
  {
    youType: ">!",
    customersSee: "a key-points box with ticks",
    example: ">! Key points\n- Verified once",
  },
  {
    youType: "[text](url)",
    customersSee: "a link (pages on this site start with /; also https://, mailto:, tel:)",
    example: "[Contact page](/contact)",
  },
  {
    youType: "[text]",
    customersSee: "a placeholder, shown exactly as typed; replace it before publishing",
    example: "[REVIEW TIME]",
  },
];

function PagePreview({
  pageKey,
  locale,
  title,
  content,
}: {
  pageKey: PageKey;
  locale: Locale;
  title: string;
  content: string;
}) {
  const config = PAGE_CONFIG[pageKey];
  const dir = locale === "ar" ? "rtl" : "ltr";

  const band = (lead: React.ReactNode, metaLine: string) => (
    <div
      style={{
        background: "var(--color-auth-form-bg)",
        padding: "24px",
        borderBottom: "1px solid var(--color-shop-divider)",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--color-action-primary)",
        }}
      >
        {EYEBROW_EN[config.group]}
      </p>
      <p style={{ fontSize: "30px", fontWeight: 700, color: "var(--primitive-black)", marginTop: "6px" }}>
        {title || "Untitled page"}
      </p>
      {lead}
      <p style={{ fontSize: "12px", color: "var(--color-content-tertiary)", marginTop: "10px" }}>
        {metaLine}
      </p>
    </div>
  );

  if (pageKey === "faq") {
    const { lead, groups } = parseFaqContent(content);
    return (
      <div lang={locale} dir={dir} data-surface="storefront">
        {band(
          lead && (
            <p style={{ fontSize: "14px", color: "var(--color-auth-label-text)", marginTop: "8px" }}>
              <PageInline inlines={lead} linkMode="plain" />
            </p>
          ),
          "Draft preview",
        )}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {groups.map((group) => (
            <div key={group.id}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--primitive-black)", marginBottom: "8px" }}>
                {group.title}
              </p>
              {group.questions.map((q) => (
                <div key={q.id} style={{ marginBottom: "12px" }}>
                  <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--primitive-black)" }}>
                    {q.question}
                  </p>
                  <div style={{ marginTop: "4px" }}>
                    <PageBlocks blocks={q.answer} numbered={false} size="default" linkMode="plain" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (pageKey === "about") {
    const { lead } = parsePageContent(content);
    return (
      <div lang={locale} dir={dir} data-surface="storefront">
        {band(
          lead && (
            <p style={{ fontSize: "14px", color: "var(--color-auth-label-text)", marginTop: "8px" }}>
              <PageInline inlines={lead} linkMode="plain" />
            </p>
          ),
          "Draft preview",
        )}
      </div>
    );
  }

  const { lead, blocks, wordCount } = parsePageContent(content);
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div lang={locale} dir={dir} data-surface="storefront">
      {band(
        lead && (
          <p style={{ fontSize: "14px", color: "var(--color-auth-label-text)", marginTop: "8px" }}>
            <PageInline inlines={lead} linkMode="plain" />
          </p>
        ),
        `${readTime} min read`,
      )}
      <div style={{ padding: "24px" }}>
        <PageBlocks blocks={blocks} numbered={config.numbered} size="default" linkMode="plain" />
      </div>
    </div>
  );
}

export default function StorePageEditor({ pageKey, initialRow, staffName, sectionsSlot }: Props) {
  const router = useRouter();
  const toast = useToast();
  const isFaq = pageKey === "faq";
  const isAbout = pageKey === "about";

  const kind = PAGE_CONFIG[pageKey].kind;
  const [activeTab, setActiveTab] = useState<TabId>("header");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [forms, setForms] = useState(() => buildForms(initialRow));
  const [initialForms, setInitialForms] = useState(() => buildForms(initialRow));
  const [fieldErrors, setFieldErrors] = useState<Record<Locale, FieldErrors>>({
    en: {},
    ar: {},
    ru: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [published, setPublished] = useState(initialRow.published);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [savedAt, setSavedAt] = useState<string | null>(initialRow.updatedAt);
  const [savedBy, setSavedBy] = useState<string | null>(initialRow.lastEditorName);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  const state = forms[activeLocale];
  const pristine = statesEqual(state, initialForms[activeLocale]);
  const errors = fieldErrors[activeLocale];
  const anyDirty = LOCALES.some((l) => !statesEqual(forms[l], initialForms[l]));
  useUnsavedGuard(anyDirty);

  const lintIssues = useMemo(
    () => lintPageContent(state.content, isFaq),
    [state.content, isFaq],
  );

  function updateState(patch: Partial<LocaleFormState>) {
    setForms((f) => ({ ...f, [activeLocale]: { ...f[activeLocale], ...patch } }));
  }

  function applyEdit(result: { text: string; selectionStart: number; selectionEnd: number }) {
    const el = contentRef.current;
    updateState({ content: result.text });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  function handleTogglePrefix(kind: "h2" | "h3" | "bullet" | "numbered") {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.content.length;
    const end = el.selectionEnd ?? state.content.length;
    applyEdit(toggleLinePrefix(state.content, start, end, kind));
  }

  function handleInsertBlock(template: string, selectFrom: number, selectTo: number) {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.content.length;
    const end = el.selectionEnd ?? state.content.length;
    applyEdit(insertBlock(state.content, start, end, template, selectFrom, selectTo));
  }

  function handleInsertLink() {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.content.length;
    const end = el.selectionEnd ?? state.content.length;
    applyEdit(insertLink(state.content, start, end));
  }

  async function handleSave() {
    setIsSaving(true);
    setFieldErrors((fe) => ({ ...fe, [activeLocale]: {} }));

    const result = await saveStorePageAction({
      key: pageKey,
      locale: activeLocale,
      title: state.title,
      content: state.content,
      metaTitle: state.metaTitle,
      metaDescription: state.metaDescription,
    });

    if (result.success) {
      toast.success("Page saved.");
      setInitialForms((f) => ({ ...f, [activeLocale]: state }));
      setSavedAt(new Date().toISOString());
      setSavedBy(staffName);
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.title) fe.title = result.fieldErrors.title[0];
      if (result.fieldErrors.content) fe.content = result.fieldErrors.content[0];
      if (result.fieldErrors.metaTitle) fe.metaTitle = result.fieldErrors.metaTitle[0];
      if (result.fieldErrors.metaDescription)
        fe.metaDescription = result.fieldErrors.metaDescription[0];
      setFieldErrors((prev) => ({ ...prev, [activeLocale]: fe }));
    } else {
      toast.error(result.error);
    }

    setIsSaving(false);
  }

  function handleDiscard() {
    setForms((f) => ({ ...f, [activeLocale]: initialForms[activeLocale] }));
    setFieldErrors((fe) => ({ ...fe, [activeLocale]: {} }));
  }

  async function applyPublishChange(next: boolean) {
    setIsTogglingPublish(true);
    const result = await setStorePagePublishedAction({ key: pageKey, published: next });

    if (result.success) {
      setPublished(next);
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setIsTogglingPublish(false);
  }

  function handlePublishToggle() {
    if (published) {
      setUnpublishConfirmOpen(true);
    } else {
      void applyPublishChange(true);
    }
  }

  async function handleConfirmUnpublish() {
    await applyPublishChange(false);
    setUnpublishConfirmOpen(false);
  }

  const isRtl = activeLocale === "ar";

  const label = initialRow.label;
  const purposeByKind: Record<typeof kind, string> = {
    policy: `The ${label} page customers read from the site footer. Written as plain text; the page builds the headings, lists and boxes from it.`,
    faq: "The FAQ customers search from the site footer. Each ## line is a category, each ### line a question, and the lines under it are the answer.",
    editorial:
      "The About page. Tab 1 is the title and the line under it; tab 2 holds the story, figures, mission, team, photos and Visit us.",
    contact:
      "The Contact page. Channels come from Store Profile and the showroom from Store Locations; this page holds its own text.",
    locator:
      "The Our Stores page. Every shown showroom comes from Store Locations; this page holds its own text.",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "#6b6b6b",
    margin: 0,
  };
  const counterStyle: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "#6b6b6b",
  };
  const textareaBase: React.CSSProperties = {
    padding: "0.625rem 0.875rem",
    color: "var(--color-auth-input-text)",
    backgroundColor: "var(--color-auth-input-bg)",
    border: "1.5px solid var(--color-auth-input-border)",
    borderRadius: "var(--radius-none)",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  };
  const toggleBtn = (on: boolean): React.CSSProperties => ({
    padding: "0.25rem 0.75rem",
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-bold)",
    textTransform: "uppercase",
    letterSpacing: "var(--tracking-wide)",
    backgroundColor: "#0b0b0b",
    color: "#ffffff",
    border: "none",
    borderRadius: "0",
    cursor: "pointer",
    opacity: on ? 1 : 0.45,
  });
  const guideCell: React.CSSProperties = {
    padding: "6px 10px",
    borderBottom: "1px solid #e8e8e8",
    verticalAlign: "top",
  };
  const guideHead: React.CSSProperties = {
    textAlign: "start",
    padding: "6px 10px",
    borderBottom: "1px solid #e8e8e8",
    backgroundColor: "#f5f5f5",
  };

  const localeToggles = (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {LOCALES.map((locale) => {
        const f = forms[locale];
        const authored = f.title.trim() !== "" && f.content.trim() !== "";
        const empty = f.title.trim() === "" && f.content.trim() === "";
        return (
          <button
            key={locale}
            type="button"
            onClick={() => setActiveLocale(locale)}
            aria-pressed={activeLocale === locale}
            style={toggleBtn(activeLocale === locale)}
          >
            {LOCALE_TAB_LABELS[locale]}
            {authored ? " •" : empty ? " · NOT WRITTEN" : ""}
          </button>
        );
      })}
    </div>
  );

  const showSaveBar = !(isAbout && activeTab === "content");

  return (
    <ContentPageFrame
      backHref="/admin/pages"
      backLabel="Back to Store Pages"
      title={label}
      status={{ label: published ? "Published" : "Draft", tone: published ? "green" : "grey" }}
      path={`/${pageKey}`}
      liveHref={published ? `/en/${pageKey}` : null}
      purpose={purposeByKind[kind]}
      sketch={SKETCH_BY_TAB[activeTab]}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
      tabsEnd={localeToggles}
    >
      {activeTab === "header" && (
        <div
          style={{ ...cardStyle, padding: "28px", display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Input
              id="store-page-title"
              label="Title"
              type="text"
              dir={isRtl ? "rtl" : undefined}
              value={state.title}
              onChange={(e) => updateState({ title: e.target.value })}
              disabled={isSaving}
              error={errors.title}
              hint="The big heading on the header photo. Keep it short."
            />
            <span style={counterStyle}>{state.title.length} / 120</span>
          </div>

          {isAbout && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={labelTextStyle}>Opening line</span>
              <p style={hintStyle}>
                One sentence under the title. Example: {BRAND.description}
              </p>
              <textarea
                ref={contentRef}
                value={state.content}
                onChange={(e) => updateState({ content: e.target.value })}
                disabled={isSaving}
                dir={isRtl ? "rtl" : undefined}
                style={{
                  ...textareaBase,
                  height: "140px",
                  fontFamily: "monospace",
                  fontSize: "13.5px",
                  lineHeight: 1.7,
                }}
              />
              {errors.content && (
                <p role="alert" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-error-text)", margin: 0 }}>
                  {errors.content}
                </p>
              )}
              {/\n\s*\n/.test(state.content) && (
                <div
                  style={{
                    padding: "0.625rem 0.875rem",
                    fontSize: "var(--text-body-sm)",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                  }}
                >
                  Only the first paragraph shows on the page. The text after it is no longer
                  used; remove it when you&apos;re ready.
                </div>
              )}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid #e8e8e8",
              paddingTop: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div>
              <p style={{ ...labelTextStyle, fontWeight: "var(--font-bold)", margin: "0 0 0.25rem" }}>
                {published ? "Published" : "Draft"}
              </p>
              <p style={hintStyle}>
                Published pages are live at the address above. A draft page shows customers a
                not-found page, and its footer link still shows.
              </p>
            </div>
            <EnabledSwitch
              enabled={published}
              disabled={false}
              pending={isTogglingPublish}
              onToggle={handlePublishToggle}
            />
          </div>
        </div>
      )}

      {activeTab === "content" && isAbout && sectionsSlot}

      {activeTab === "content" && !isAbout && (
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_24rem]">
          <div
            style={{ ...cardStyle, padding: "28px", display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={labelTextStyle}>Content</span>
              <span style={counterStyle}>{state.content.length} / 50,000 characters</span>
            </div>
            <p style={hintStyle}>
              Everything below the header photo. The first paragraph becomes the line under the
              title.
            </p>

            <div
              className="flex flex-wrap items-center"
              style={{ gap: "8px", padding: "8px 0" }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <ToolbarButton
                  icon={<HeadingIcon />}
                  label={isFaq ? "Category" : "Section heading"}
                  title={
                    isFaq
                      ? "Starts a new group of questions."
                      : "Starts a new section. It is listed in On this page."
                  }
                  onClick={() => handleTogglePrefix("h2")}
                  disabled={isSaving}
                />
                <ToolbarButton
                  icon={<SubheadingIcon />}
                  label={isFaq ? "Question" : "Sub-heading"}
                  title={
                    isFaq
                      ? "A question. The text below it, up to the next question, is the answer."
                      : "A smaller heading inside a section."
                  }
                  onClick={() => handleTogglePrefix("h3")}
                  disabled={isSaving}
                />
              </div>

              <ToolbarDivider />

              <div style={{ display: "flex", gap: "6px" }}>
                <ToolbarButton
                  icon={<BulletIcon />}
                  label="Bullet list"
                  title="Turns the selected lines into a bulleted list."
                  onClick={() => handleTogglePrefix("bullet")}
                  disabled={isSaving}
                />
                <ToolbarButton
                  icon={<NumberedIcon />}
                  label="Numbered steps"
                  title="Turns the selected lines into numbered steps."
                  onClick={() => handleTogglePrefix("numbered")}
                  disabled={isSaving}
                />
              </div>

              <ToolbarDivider />

              <div style={{ display: "flex", gap: "6px" }}>
                <ToolbarButton
                  icon={<TableIcon />}
                  label="Label & value table"
                  title="A two-column list, e.g. opening hours. Every line reads Label: value."
                  onClick={() => handleInsertBlock("- Label: value\n- Label: value", 2, 7)}
                  disabled={isSaving}
                />
                <ToolbarButton
                  icon={<NoteIcon />}
                  label="Note box"
                  title="A grey box for an important note. The first line is its title."
                  onClick={() => handleInsertBlock("> Note title\n> Note text", 2, 12)}
                  disabled={isSaving}
                />
                <ToolbarButton
                  icon={<KeyPointsIcon />}
                  label="Key points box"
                  title="A highlighted box of short points with ticks."
                  onClick={() =>
                    handleInsertBlock(">! Key points\n- First point\n- Second point", 16, 27)
                  }
                  disabled={isSaving}
                />
              </div>

              <ToolbarDivider />

              <div style={{ display: "flex", gap: "6px" }}>
                <ToolbarButton
                  icon={<LinkIcon />}
                  label="Link"
                  title="Links the selected text. Use /page for this site, https:// for other sites, mailto: or tel:."
                  onClick={handleInsertLink}
                  disabled={isSaving}
                />
              </div>
            </div>

            <textarea
              ref={contentRef}
              value={state.content}
              onChange={(e) => updateState({ content: e.target.value })}
              disabled={isSaving}
              dir={isRtl ? "rtl" : undefined}
              style={{
                ...textareaBase,
                height: "600px",
                fontFamily: "monospace",
                fontSize: "13.5px",
                lineHeight: 1.7,
              }}
            />
            {errors.content && (
              <p role="alert" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-error-text)", margin: 0 }}>
                {errors.content}
              </p>
            )}

            {lintIssues.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-bold)",
                    letterSpacing: "var(--tracking-widest)",
                    textTransform: "uppercase",
                    color: "#6b6b6b",
                  }}
                >
                  Check before saving
                </span>
                {lintIssues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.625rem 0.875rem",
                      fontSize: "var(--text-body-sm)",
                      backgroundColor: issue.level === "warn" ? "#fffbeb" : "#f7f7f7",
                      border: `1px solid ${issue.level === "warn" ? "#fde68a" : "#f7f7f7"}`,
                      color: issue.level === "warn" ? "#92400e" : "#6b6b6b",
                    }}
                  >
                    {lintMessage(issue)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              ...cardStyle,
              padding: "20px",
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              minWidth: 0,
            }}
          >
            <p
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              How formatting works
            </p>
            <p style={hintStyle}>
              Write plain text and leave an empty line between paragraphs. Use the buttons, or
              type the marks yourself.
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th style={guideHead}>You type</th>
                  <th style={guideHead}>Customers see</th>
                  <th style={guideHead}>Example</th>
                </tr>
              </thead>
              <tbody>
                {FORMATTING_TABLE_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...guideCell, fontFamily: "monospace", color: "#0b0b0b" }}>
                      {row.youType}
                    </td>
                    <td style={{ ...guideCell, color: "#2a2520" }}>{row.customersSee}</td>
                    <td
                      style={{
                        ...guideCell,
                        fontFamily: "monospace",
                        color: "#6b6b6b",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {row.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={hintStyle}>No HTML: text is shown exactly as written.</p>
          </div>
        </div>
      )}

      {activeTab === "search" && (
        <div
          style={{ ...cardStyle, padding: "28px", display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Input
              id="store-page-meta-title"
              label="Search title"
              type="text"
              dir={isRtl ? "rtl" : undefined}
              value={state.metaTitle}
              onChange={(e) => updateState({ metaTitle: e.target.value })}
              disabled={isSaving}
              error={errors.metaTitle}
              optional="(optional)"
              hint="The title in search results and when the link is shared. Leave empty to use the page title."
            />
            <span style={counterStyle}>{state.metaTitle.length} / 60</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <span style={labelTextStyle}>
              Search description{" "}
              <span style={{ fontWeight: "var(--font-normal)", color: "#6b6b6b" }}>(optional)</span>
            </span>
            <p style={hintStyle}>
              The short text under the link in search results. Around 150 characters.
            </p>
            <textarea
              value={state.metaDescription}
              onChange={(e) => updateState({ metaDescription: e.target.value })}
              disabled={isSaving}
              dir={isRtl ? "rtl" : undefined}
              rows={3}
              style={{ ...textareaBase, fontSize: "var(--text-body)" }}
            />
            <span style={counterStyle}>{state.metaDescription.length} / 160</span>
            {errors.metaDescription && (
              <p role="alert" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-error-text)", margin: 0 }}>
                {errors.metaDescription}
              </p>
            )}
          </div>
        </div>
      )}

      {showSaveBar && (
        <ContentSaveBar
          savedLabel={
            savedAt
              ? `Last saved ${formatSavedDate(savedAt)} by ${savedBy ?? "Unknown"}`
              : "Not saved yet"
          }
          dirty={!pristine}
          saveLabel={`Save ${LOCALE_TAB_LABELS[activeLocale]}`}
          onSave={() => {
            if (!pristine) void handleSave();
          }}
          saving={isSaving}
          onPreview={() => setPreviewOpen(true)}
          extra={
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving || pristine}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                textDecoration: "underline",
                cursor: isSaving || pristine ? "not-allowed" : "pointer",
                opacity: isSaving || pristine ? 0.6 : 1,
              }}
            >
              Discard
            </button>
          }
        />
      )}

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth={960}
        ariaLabel="Page preview"
      >
        <div style={{ backgroundColor: "#f5f5f5", padding: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["desktop", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  style={toggleBtn(previewMode === mode)}
                >
                  {mode === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div
            style={{
              width: previewMode === "mobile" ? "390px" : "100%",
              maxWidth: "100%",
              margin: previewMode === "mobile" ? "0 auto" : undefined,
              backgroundColor: "#ffffff",
              border: "1px solid #e8e8e8",
              overflow: "hidden",
            }}
          >
            <PagePreview
              pageKey={pageKey}
              locale={activeLocale}
              title={state.title}
              content={state.content}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={unpublishConfirmOpen}
        onClose={() => setUnpublishConfirmOpen(false)}
        onConfirm={() => {
          void handleConfirmUnpublish();
        }}
        title="Unpublish this page?"
        message="Customers will see a not-found page until you publish it again."
        confirmLabel="Unpublish"
        cancelLabel="Cancel"
        isPending={isTogglingPublish}
        destructive
      />
    </ContentPageFrame>
  );
}
