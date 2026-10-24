"use client";

import { useId, useState } from "react";

export function FilterSection({
  label,
  children,
  defaultOpen = true,
  summary,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  summary?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div
      className="px-5 py-5"
      style={{ borderBottom: "1px solid var(--color-shop-divider)" }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-3 w-full text-start cursor-pointer ${
          open ? "mb-4" : ""
        }`}
      >
        <span
          className="text-eyebrow tracking-widest uppercase ps-2 flex-shrink-0"
          style={{
            color: "var(--color-content-tertiary)",
            fontWeight: "var(--font-semibold)",
            borderInlineStart: "2px solid var(--color-action-primary)",
          }}
        >
          {label}
        </span>
        <span className="flex items-center gap-2 min-w-0">
          {!open && summary && (
            <span
              className="text-body-sm truncate"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {summary}
            </span>
          )}
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0 transition-transform duration-200"
            style={{
              color: "var(--color-content-tertiary)",
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-2.5">
          {children}
        </div>
      )}
    </div>
  );
}
