"use client";

import { BRAND } from "@/lib/config/brand";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import FadeImage from "@/components/ui/FadeImage";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { brandName } from "@/lib/utils/brand";
import type { SearchSuggestions } from "@/types/shop";

interface SearchComboboxProps {
  variant: "shop" | "nav";
  initialValue?: string;
  scopeCategory?: string;
  placeholder: string;
  actions?: ReactNode;
  autoFocus?: boolean;
  onDone?: () => void;
}

type PanelOption =
  | { kind: "link"; href: string }
  | { kind: "submit" }
  | { kind: "recent"; query: string };

const RECENT_KEY = `${BRAND.storageKeyPrefix}-recent-searches`;
const RECENT_LIMIT = 5;
const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function writeRecents(list: string[]) {
  try {
    if (list.length === 0) localStorage.removeItem(RECENT_KEY);
    else localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    return;
  }
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold">
        {text.slice(at, at + query.length)}
      </span>
      {text.slice(at + query.length)}
    </>
  );
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClearIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <path
        d="M1 1L9 9M9 1L1 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 2H8L14 8L8 14L2 8V2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.5V8L10.5 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Maybe({
  when,
  className,
  style,
  children,
}: {
  when: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return when ? (
    <div className={className} style={style}>
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}

const NAV_INNER = "mx-auto max-w-[1440px] px-6 lg:px-10";

export default function SearchCombobox({
  variant,
  initialValue = "",
  scopeCategory,
  placeholder,
  actions,
  autoFocus,
  onDone,
}: SearchComboboxProps) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const [results, setResults] = useState<SearchSuggestions | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navKey = `${pathname}?${searchParams.toString()}`;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = autoFocus !== false && openKey === navKey;

  const trimmed = value.trim();
  const typing = trimmed.length >= MIN_CHARS;

  const filterKey = useMemo(() => {
    if (variant !== "shop") return "";
    const p = new URLSearchParams(searchParams.toString());
    p.delete("search");
    p.delete("page");
    return p.toString();
  }, [variant, searchParams]);

  useEffect(() => {
    if (!typing) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams(filterKey);
      qs.set("q", trimmed);
      if (variant === "shop" && scopeCategory) {
        qs.set("scopeCategory", scopeCategory);
      }
      try {
        const res = await fetch(`/api/search/suggest?${qs.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchSuggestions;
        setResults(data);
        setActiveIndex(-1);
      } catch {
        return;
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typing, trimmed, filterKey, variant, scopeCategory]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [autoFocus]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const hasResults =
    results !== null &&
    (results.products.length > 0 ||
      results.brands.length > 0 ||
      results.categories.length > 0);

  const mode: "results" | "recent" | "empty" | "none" = typing
    ? results === null
      ? "none"
      : hasResults
        ? "results"
        : "empty"
    : recents.length > 0
      ? "recent"
      : "none";

  const options: PanelOption[] = [];
  if (mode === "results" && results) {
    for (const b of results.brands) {
      options.push({ kind: "link", href: `/shop?brand=${b.slug}` });
    }
    for (const c of results.categories) {
      options.push({ kind: "link", href: `/shop/${c.slug}` });
    }
    for (const p of results.products) {
      options.push({
        kind: "link",
        href: `/shop/${p.categorySlug}/${p.slugEn}`,
      });
    }
    options.push({ kind: "submit" });
  } else if (mode === "recent") {
    for (const r of recents) options.push({ kind: "recent", query: r });
  }

  const panelVisible = open && mode !== "none";
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  function finish() {
    setOpenKey(null);
    setActiveIndex(-1);
    onDone?.();
  }

  function submit(query?: string) {
    const q = (query ?? value).trim();
    if (query !== undefined) setValue(q);

    if (q.length > 0) {
      const next = [
        q,
        ...readRecents().filter((r) => r.toLowerCase() !== q.toLowerCase()),
      ].slice(0, RECENT_LIMIT);
      writeRecents(next);
      setRecents(next);
    }

    if (variant === "shop") {
      const params = new URLSearchParams(searchParams.toString());
      if (q.length > 0) params.set("search", q);
      else params.delete("search");
      params.delete("page");
      const qs = params.toString();
      startNavigationProgress();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: false,
      });
    } else {
      const params = new URLSearchParams();
      if (q.length > 0) params.set("search", q);
      const qs = params.toString();
      startNavigationProgress();
      router.push(qs ? `/shop?${qs}` : "/shop");
    }
    finish();
  }

  function activate(option: PanelOption) {
    if (option.kind === "link") {
      router.push(option.href);
      finish();
    } else if (option.kind === "submit") {
      submit();
    } else {
      submit(option.query);
    }
  }

  function onClear() {
    setValue("");
    setActiveIndex(-1);
    if (variant === "shop" && searchParams.has("search")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("search");
      params.delete("page");
      const qs = params.toString();
      startNavigationProgress();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: false,
      });
    }
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpenKey(null);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      if (!panelVisible) {
        setRecents(readRecents());
        setOpenKey(navKey);
        return;
      }
      const last = options.length - 1;
      setActiveIndex((i) =>
        e.key === "ArrowDown"
          ? i >= last
            ? 0
            : i + 1
          : i <= 0
            ? last
            : i - 1,
      );
      return;
    }
    if (e.key === "Enter" && panelVisible && activeIndex >= 0) {
      e.preventDefault();
      const option = options[activeIndex];
      if (option) activate(option);
    }
  }

  const isShop = variant === "shop";
  const typedLocale = locale === "ar" || locale === "ru" ? locale : "en";
  const localName = (en: string, ar: string, ru: string | null) =>
    typedLocale === "ar" ? ar : typedLocale === "ru" ? (ru ?? en) : en;

  const rowBase = "flex items-center gap-3 w-full px-4 text-start cursor-pointer";
  const rowStyle = (i: number): React.CSSProperties => ({
    minHeight: "44px",
    backgroundColor:
      i === activeIndex ? "var(--color-auth-form-bg)" : "transparent",
  });

  const brandCount = results?.brands.length ?? 0;
  const categoryCount = results?.categories.length ?? 0;
  const productOffset = brandCount + categoryCount;
  const footerIndex = productOffset + (results?.products.length ?? 0);

  const hasLeftColumn = brandCount + categoryCount > 0;
  const hasProducts = (results?.products.length ?? 0) > 0;
  const navResultsClass = `${NAV_INNER} py-6${
    hasLeftColumn && hasProducts
      ? " lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10"
      : ""
  }`;
  const linkRowStyle = (i: number): React.CSSProperties =>
    isShop
      ? rowStyle(i)
      : {
          ...rowStyle(i),
          borderInlineStart:
            i === activeIndex
              ? "2px solid var(--primitive-black)"
              : "2px solid transparent",
        };
  const groupEyebrowClass = isShop
    ? "text-eyebrow tracking-widest uppercase px-4 pt-3 pb-1"
    : "text-eyebrow tracking-widest uppercase pb-2";

  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode="search"
      role="combobox"
      aria-expanded={panelVisible}
      aria-controls={listboxId}
      aria-activedescendant={
        panelVisible && activeIndex >= 0 ? optionId(activeIndex) : undefined
      }
      aria-autocomplete="list"
      autoComplete="off"
      enterKeyHint="search"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setActiveIndex(-1);
        setRecents(readRecents());
        setOpenKey(navKey);
      }}
      onFocus={() => {
        const stored = readRecents();
        setRecents(stored);
        if (stored.length > 0 || typing) setOpenKey(navKey);
      }}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={
        isShop
          ? "w-full h-9 ps-9 pe-8 text-body-sm outline-none transition-colors"
          : "flex-1 h-10 text-body outline-none bg-transparent"
      }
      style={
        isShop
          ? {
              backgroundColor: "var(--primitive-white)",
              border: "1px solid var(--color-content-tertiary)",
              borderRadius: "var(--radius-none)",
              color: "var(--primitive-black)",
            }
          : { color: "var(--color-content-primary)" }
      }
    />
  );

  const clearButton = value.length > 0 && (
    <button
      type="button"
      onClick={onClear}
      aria-label={t("search_clear")}
      className={
        isShop
          ? "absolute top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70 cursor-pointer"
          : "transition-opacity hover:opacity-70"
      }
      style={
        isShop
          ? {
              insetInlineEnd: "0.5rem",
              color: "var(--color-content-tertiary)",
            }
          : { color: "var(--color-content-tertiary)" }
      }
    >
      <ClearIcon size={isShop ? 10 : 12} />
    </button>
  );

  return (
    <div
      ref={rootRef}
      className={isShop ? "relative w-full" : "mx-auto max-w-[1440px]"}
    >
      {isShop ? (
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              insetInlineStart: "0.75rem",
              color: "var(--color-content-tertiary)",
            }}
            aria-hidden="true"
          >
            <SearchIcon size={14} />
          </span>
          {input}
          {clearButton}
          {actions}
        </form>
      ) : (
        <form
          role="search"
          className="flex items-center gap-3 h-[80px] px-6 lg:px-10"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <span
            style={{ color: "var(--color-content-tertiary)" }}
            aria-hidden="true"
          >
            <SearchIcon size={16} />
          </span>
          {input}
          {clearButton}
          {actions}
        </form>
      )}

      {panelVisible && (
        <div
          className={
            isShop
              ? "absolute top-full lg:min-w-[420px]"
              : "absolute top-full w-full"
          }
          style={
            isShop
              ? {
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  maxHeight: "min(70dvh, 560px)",
                  overflowY: "auto",
                  backgroundColor: "var(--color-auth-input-bg)",
                  color: "var(--primitive-black)",
                  border: "1px solid var(--color-shop-divider)",
                  borderTop: "none",
                  zIndex: "var(--z-dropdown)",
                  borderRadius: "var(--radius-none)",
                }
              : {
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  maxHeight: "min(75dvh, 640px)",
                  overflowY: "auto",
                  backgroundColor: "var(--color-auth-input-bg)",
                  color: "var(--primitive-black)",
                  borderBottom: "1px solid var(--color-auth-input-border)",
                  boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
                  zIndex: "var(--z-dropdown)",
                  borderRadius: "var(--radius-none)",
                }
          }
        >
          {mode === "results" && results && (
            <div
              id={listboxId}
              role="listbox"
              aria-label={t("search_suggestions_label")}
            >
              <Maybe when={!isShop} className={navResultsClass}>
              {(brandCount > 0 || categoryCount > 0) && (
                <div role="group" aria-labelledby={`${baseId}-bc`}>
                  <p
                    id={`${baseId}-bc`}
                    className={groupEyebrowClass}
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    {t("search_brands_categories")}
                  </p>
                  {results.brands.map((b, i) => (
                    <Link
                      key={`b-${b.slug}`}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                      href={`/shop?brand=${b.slug}`}
                      onClick={finish}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={rowBase}
                      style={linkRowStyle(i)}
                    >
                      <span style={{ color: "var(--color-content-tertiary)" }}>
                        <BrandIcon />
                      </span>
                      <span className="flex-1 min-w-0 text-body-sm truncate">
                        <Highlight
                          text={brandName(b, locale)}
                          query={trimmed}
                        />
                      </span>
                      <span
                        className="text-body-sm flex-shrink-0"
                        style={{ color: "var(--color-content-tertiary)" }}
                      >
                        {t("search_kind_brand")}
                      </span>
                    </Link>
                  ))}
                  {results.categories.map((c, j) => {
                    const i = brandCount + j;
                    return (
                      <Link
                        key={`c-${c.slug}`}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === activeIndex}
                        href={`/shop/${c.slug}`}
                        onClick={finish}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={rowBase}
                        style={linkRowStyle(i)}
                      >
                        <span
                          style={{ color: "var(--color-content-tertiary)" }}
                        >
                          <CategoryIcon />
                        </span>
                        <span className="flex-1 min-w-0 text-body-sm truncate">
                          <Highlight
                            text={brandName(c, locale)}
                            query={trimmed}
                          />
                        </span>
                        <span
                          className="text-body-sm flex-shrink-0"
                          style={{ color: "var(--color-content-tertiary)" }}
                        >
                          {t("search_kind_category")}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {results.products.length > 0 && (
                <div role="group" aria-labelledby={`${baseId}-pr`}>
                  <p
                    id={`${baseId}-pr`}
                    className={groupEyebrowClass}
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    {t("search_products")}
                  </p>
                  <Maybe when={!isShop} className="lg:grid lg:grid-cols-5 lg:gap-4">
                  {results.products.map((p, j) => {
                    const i = productOffset + j;
                    const name = localName(p.nameEn, p.nameAr, p.nameRu);
                    const brandLabel = brandName(p.brand, locale);
                    const onSale =
                      p.price !== null &&
                      p.compareAtPrice !== null &&
                      p.compareAtPrice > p.price;
                    return (
                      <Link
                        key={`p-${p.categorySlug}-${p.slugEn}`}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === activeIndex}
                        href={`/shop/${p.categorySlug}/${p.slugEn}`}
                        onClick={finish}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={
                          isShop
                            ? rowBase
                            : "flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-2 w-full text-start cursor-pointer"
                        }
                        style={{ ...rowStyle(i), paddingBlock: "6px" }}
                      >
                        <span
                          className={
                            isShop
                              ? "relative flex-shrink-0"
                              : "relative flex-shrink-0 w-10 h-10 lg:w-full lg:h-auto lg:aspect-square"
                          }
                          style={
                            isShop
                              ? {
                                  width: "40px",
                                  height: "40px",
                                  backgroundColor: "var(--primitive-white)",
                                  border: "1px solid var(--color-shop-divider)",
                                }
                              : {
                                  backgroundColor: "var(--color-auth-form-bg)",
                                  border:
                                    i === activeIndex
                                      ? "1px solid var(--primitive-black)"
                                      : "1px solid var(--color-shop-divider)",
                                }
                          }
                        >
                          <FadeImage
                            src={getImageUrl(p.primaryImage?.storageKey)}
                            alt=""
                            fill
                            sizes={isShop ? "40px" : "(min-width: 1024px) 15vw, 40px"}
                            className="object-contain"
                          />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          {brandLabel && (
                            <span
                              className="text-eyebrow uppercase truncate"
                              style={{ color: "var(--color-content-tertiary)" }}
                            >
                              {brandLabel}
                            </span>
                          )}
                          <span
                            className={
                              isShop
                                ? "text-body-sm truncate"
                                : "text-body-sm line-clamp-2"
                            }
                          >
                            <Highlight text={name} query={trimmed} />
                          </span>
                        </span>
                        <span className="flex-shrink-0 flex flex-col items-end text-body-sm">
                          {results.businessMode || p.price === null ? (
                            <span
                              style={{ color: "var(--color-content-tertiary)" }}
                            >
                              {t("contact_for_pricing")}
                            </span>
                          ) : (
                            <>
                              <span
                                className="font-medium"
                                style={{
                                  color: onSale
                                    ? "var(--color-action-primary)"
                                    : "var(--primitive-black)",
                                }}
                              >
                                {formatAED(p.price)}
                              </span>
                              {onSale && p.compareAtPrice !== null && (
                                <span
                                  style={{
                                    color: "var(--color-content-tertiary)",
                                    textDecoration: "line-through",
                                  }}
                                >
                                  {formatAED(p.compareAtPrice)}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                  </Maybe>
                </div>
              )}
              </Maybe>

              <Maybe
                when={!isShop}
                style={{
                  backgroundColor: "var(--color-auth-form-bg)",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <Maybe
                  when={!isShop}
                  className={`${NAV_INNER} py-3 flex items-center justify-between gap-4`}
                >
                  <button
                    type="button"
                    id={optionId(footerIndex)}
                    role="option"
                    aria-selected={footerIndex === activeIndex}
                    tabIndex={-1}
                    onClick={() => submit()}
                    onMouseEnter={() => setActiveIndex(footerIndex)}
                    className={
                      isShop
                        ? `${rowBase} justify-between mt-1`
                        : "text-label tracking-widest uppercase px-5 h-10 w-full lg:w-auto cursor-pointer"
                    }
                    style={
                      isShop
                        ? {
                            ...rowStyle(footerIndex),
                            borderTop: "1px solid var(--color-shop-divider)",
                          }
                        : {
                            backgroundColor: "#0b0b0b",
                            color: "#fff",
                            outline:
                              footerIndex === activeIndex
                                ? "2px solid var(--color-accent)"
                                : undefined,
                            outlineOffset:
                              footerIndex === activeIndex ? "2px" : undefined,
                          }
                    }
                  >
                    {isShop ? (
                      <>
                        <span className="text-body-sm underline">
                          {t("search_see_all", { count: results.total, query: trimmed })}
                        </span>
                        <span
                          className="hidden lg:inline text-eyebrow flex-shrink-0"
                          style={{ color: "var(--color-content-tertiary)" }}
                        >
                          {t("search_keyboard_hint")}
                        </span>
                      </>
                    ) : (
                      t("search_see_all", { count: results.total, query: trimmed })
                    )}
                  </button>
                  {!isShop && (
                    <span
                      className="hidden lg:inline text-eyebrow flex-shrink-0"
                      style={{ color: "var(--color-content-tertiary)" }}
                    >
                      {t("search_keyboard_hint")}
                    </span>
                  )}
                </Maybe>
              </Maybe>
            </div>
          )}

          {mode === "recent" && (
            <Maybe when={!isShop} className={NAV_INNER}>
            <div>
              <div
                className={
                  isShop
                    ? "flex items-center justify-between px-4 pt-3 pb-1"
                    : "flex items-center justify-between pt-3 pb-1"
                }
              >
                <p
                  id={`${baseId}-rc`}
                  className="text-eyebrow tracking-widest uppercase"
                  style={{ color: "var(--color-content-tertiary)" }}
                >
                  {t("search_recent")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    writeRecents([]);
                    setRecents([]);
                  }}
                  className="text-body-sm underline cursor-pointer"
                  style={{ color: "var(--color-content-tertiary)" }}
                >
                  {t("search_recent_clear")}
                </button>
              </div>
              <div
                id={listboxId}
                role="listbox"
                aria-label={t("search_suggestions_label")}
                className={
                  isShop
                    ? "flex flex-wrap gap-2 px-4 pb-3"
                    : "flex flex-wrap gap-2 pb-3"
                }
              >
                {recents.map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    tabIndex={-1}
                    onClick={() => submit(r)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="inline-flex items-center gap-2 px-3 text-body-sm cursor-pointer"
                    style={{
                      minHeight: "44px",
                      border: "1px solid var(--color-shop-divider)",
                      borderRadius: "var(--radius-none)",
                      backgroundColor:
                        i === activeIndex
                          ? "var(--color-auth-form-bg)"
                          : "transparent",
                    }}
                  >
                    <span style={{ color: "var(--color-content-tertiary)" }}>
                      <ClockIcon />
                    </span>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            </Maybe>
          )}

          {mode === "empty" && (
            <Maybe when={!isShop} className={NAV_INNER}>
            <div
              className={
                isShop
                  ? "flex flex-col gap-1 px-4 py-4"
                  : "flex flex-col gap-1 py-4"
              }
            >
              <p className="text-body-sm font-semibold">
                {t("search_no_match", { query: trimmed })}
              </p>
              <p
                className="text-body-sm"
                style={{ color: "var(--color-content-tertiary)" }}
              >
                {t("search_no_match_hint")}
              </p>
              <Link
                href="/shop"
                onClick={finish}
                className="text-body-sm underline self-start"
              >
                {t("search_browse_all")}
              </Link>
            </div>
            </Maybe>
          )}
        </div>
      )}
    </div>
  );
}
