"use client";

import type { ReactNode } from "react";
import { PageBlocks } from "@/components/pages/PageBlocks";
import { useFaqSearch } from "@/components/pages/FaqSearch";
import { pluralize } from "@/lib/utils/plural";
import { ANCHOR_OFFSET } from "@/components/pages/offsets";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";
const inputBorder = "var(--color-auth-input-border)";

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primitive-white)" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function highlightTitle(question: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return question;
  const idx = question.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return question;
  const before = question.slice(0, idx);
  const match = question.slice(idx, idx + trimmed.length);
  const after = question.slice(idx + trimmed.length);
  return (
    <>
      {before}
      <mark
        style={{
          background: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
          color: "inherit",
        }}
      >
        {match}
      </mark>
      {after}
    </>
  );
}

export function FaqBrowser() {
  const { query, setQuery, filteredGroups, matchCount, openIds, toggle, labels } = useFaqSearch();
  const trimmed = query.trim();

  const searchSummaryText = trimmed
    ? labels.searchSummary
        .replace("{results}", pluralize(labels.resultsCount, labels.locale, matchCount))
        .replace("{query}", trimmed)
    : "";

  return (
    <div id="faq-results" className="flex flex-col" style={{ scrollMarginTop: ANCHOR_OFFSET }}>
      {trimmed !== "" && (
        <div className="flex items-center justify-between" style={{ marginBottom: "24px" }}>
          <span style={{ fontSize: "15px", color: muted }}>{searchSummaryText}</span>
          <button
            type="button"
            onClick={() => setQuery("")}
            style={{ fontSize: "14px", color: ink, textDecoration: "underline" }}
          >
            {labels.clear}
          </button>
        </div>
      )}

      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center" style={{ marginTop: "48px", gap: "16px" }}>
          <p style={{ fontSize: "15px", color: muted }}>
            {labels.noResultsFor.replace("{query}", trimmed)}
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            style={{ fontSize: "14px", color: ink, textDecoration: "underline" }}
          >
            {labels.clear}
          </button>
        </div>
      ) : (
        filteredGroups.map((group) => (
          <div key={group.id} id={group.id} style={{ marginTop: "56px", scrollMarginTop: ANCHOR_OFFSET }}>
            <div
              className="flex items-center justify-between"
              style={{
                borderBottom: `2px solid ${ink}`,
                paddingBottom: "16px",
              }}
            >
              <h2 style={{ fontSize: "28px", fontWeight: 700, color: ink }}>{group.title}</h2>
              <span style={{ fontSize: "13px", fontWeight: 600, color: muted }}>
                {pluralize(labels.questionCount, labels.locale, group.questions.length)}
              </span>
            </div>

            {group.questions.map((q) => {
              const open = openIds.has(q.id);
              const panelId = `${q.id}-answer`;
              return (
                <div
                  key={q.id}
                  id={q.id}
                  style={{
                    borderBottom: `1px solid ${hairline}`,
                    padding: "24px 0",
                    scrollMarginTop: ANCHOR_OFFSET,
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(q.id)}
                    className="flex w-full items-center justify-between text-start"
                  >
                    <span style={{ fontSize: "18px", fontWeight: 600, color: ink }}>
                      {highlightTitle(q.question, query)}
                    </span>
                    <span
                      className="flex items-center justify-center"
                      style={{
                        width: "32px",
                        height: "32px",
                        flexShrink: 0,
                        background: open ? ink : "transparent",
                        border: open ? "none" : `1px solid ${inputBorder}`,
                      }}
                    >
                      {open ? <MinusIcon /> : <PlusIcon />}
                    </span>
                  </button>
                  {open && (
                    <div id={panelId} style={{ maxWidth: "760px", marginTop: "14px" }}>
                      <PageBlocks blocks={q.answer} numbered={false} size="default" linkMode="locale" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
