"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Block, Inline } from "@/lib/utils/page-blocks";
import { pluralize } from "@/lib/utils/plural";

type Question = { id: string; question: string; answer: Block[] };
type Group = { id: string; title: string; questions: Question[] };

interface FaqLabels {
  resultsCount: string;
  searchSummary: string;
  noResultsFor: string;
  showResults: string;
  clear: string;
  locale: string;
  questionCount: string;
}

interface FaqSearchContextValue {
  query: string;
  setQuery: (query: string) => void;
  filteredGroups: Group[];
  matchCount: number;
  openIds: Set<string>;
  toggle: (id: string) => void;
  labels: FaqLabels;
}

const FaqSearchContext = createContext<FaqSearchContextValue | null>(null);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[ً-ْـ]/g, "");
}

function inlineText(inlines: Inline[]): string {
  return inlines.map((i) => i.text).join(" ");
}

export function blockText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph") return inlineText(b.inlines);
      if (b.type === "heading") return b.text;
      if (b.type === "list") return b.items.map(inlineText).join(" ");
      if (b.type === "pairs") return b.rows.map((r) => `${r.label} ${inlineText(r.value)}`).join(" ");
      if (b.type === "note") return `${b.title ?? ""} ${b.body.map(inlineText).join(" ")}`;
      return `${b.title} ${b.items.map(inlineText).join(" ")}`;
    })
    .join(" ");
}

function matchQuestion(q: Question, normalizedQuery: string): boolean {
  return (
    normalize(q.question).includes(normalizedQuery) ||
    normalize(blockText(q.answer)).includes(normalizedQuery)
  );
}

function filterGroups(groups: Group[], query: string): Group[] {
  const trimmed = query.trim();
  if (!trimmed) return groups;
  const normalizedQuery = normalize(trimmed);
  return groups
    .map((group) => ({
      ...group,
      questions: group.questions.filter((q) => matchQuestion(q, normalizedQuery)),
    }))
    .filter((group) => group.questions.length > 0);
}

function firstQuestionId(groups: Group[]): string[] {
  return groups[0]?.questions[0] ? [groups[0].questions[0].id] : [];
}

export function FaqSearchProvider({
  groups,
  labels,
  initialQuery,
  children,
}: {
  groups: Group[];
  labels: FaqLabels;
  initialQuery?: string;
  children: React.ReactNode;
}) {
  const [query, setQueryState] = useState(initialQuery ?? "");
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    initialQuery?.trim()
      ? new Set(
          filterGroups(groups, initialQuery).flatMap((g) => g.questions.map((qq) => qq.id)),
        )
      : new Set(firstQuestionId(groups)),
  );

  const filteredGroups = useMemo(() => filterGroups(groups, query), [groups, query]);
  const matchCount = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.questions.length, 0),
    [filteredGroups],
  );

  function setQuery(q: string) {
    setQueryState(q);
    if (q.trim()) {
      const matched = filterGroups(groups, q);
      setOpenIds(new Set(matched.flatMap((g) => g.questions.map((qq) => qq.id))));
    } else {
      setOpenIds(new Set(firstQuestionId(groups)));
    }
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <FaqSearchContext.Provider
      value={{ query, setQuery, filteredGroups, matchCount, openIds, toggle, labels }}
    >
      {children}
    </FaqSearchContext.Provider>
  );
}

export function useFaqSearch(): FaqSearchContextValue {
  const ctx = useContext(FaqSearchContext);
  if (!ctx) throw new Error("useFaqSearch must be used inside <FaqSearchProvider>");
  return ctx;
}

export function scrollToResults(): void {
  const el = document.getElementById("faq-results");
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  if (top >= 0 && top <= window.innerHeight / 2) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
}

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const inputBorder = "var(--color-auth-input-border)";
const white = "var(--primitive-white)";

function mix(token: string, percent: number): string {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="1.6">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={white} strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  );
}

export function FaqSearchInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  const { query, setQuery, matchCount, labels } = useFaqSearch();
  const lastScrolledQuery = useRef<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2 || matchCount === 0) return;
    if (lastScrolledQuery.current === trimmed) return;

    const timer = setTimeout(() => {
      lastScrolledQuery.current = trimmed;
      scrollToResults();
    }, 700);

    return () => clearTimeout(timer);
  }, [trimmed, matchCount]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      scrollToResults();
    }
  }

  const resultsText = trimmed
    ? labels.searchSummary
        .replace("{results}", pluralize(labels.resultsCount, labels.locale, matchCount))
        .replace("{query}", trimmed)
    : "";
  const noResultsText = trimmed ? labels.noResultsFor.replace("{query}", trimmed) : "";

  return (
    <div className="w-full" style={{ maxWidth: "680px", marginTop: "36px" }}>
      <label htmlFor="faq-search" className="sr-only">
        {label}
      </label>
      <div
        className="flex items-center gap-3"
        style={{
          height: "60px",
          background: "var(--color-auth-input-bg)",
          border: `1px solid ${inputBorder}`,
          padding: "0 20px",
        }}
      >
        <SearchIcon />
        <input
          id="faq-search"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 outline-none [&::-webkit-search-cancel-button]:appearance-none"
          style={{ fontSize: "15px", color: ink, background: "transparent" }}
        />
        {query !== "" && (
          <button
            type="button"
            aria-label={labels.clear}
            onClick={() => setQuery("")}
            className="flex items-center justify-center"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: "24px",
          marginTop: "14px",
          fontSize: "15px",
          color: mix("--primitive-white", 85),
        }}
      >
        {trimmed !== "" &&
          (matchCount > 0 ? (
            <>
              {resultsText}{" "}
              <button
                type="button"
                onClick={scrollToResults}
                className="inline-flex items-center gap-1"
                style={{ color: white, textDecoration: "underline" }}
              >
                {labels.showResults}
                <DownArrowIcon />
              </button>
            </>
          ) : (
            noResultsText
          ))}
      </p>
    </div>
  );
}
