"use client";

import { useState } from "react";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={muted}
      strokeWidth="1.6"
      style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function MobileToc({
  sections,
  labels,
}: {
  sections: { id: string; title: string }[];
  labels: { title: string; sections: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        style={{ height: "52px", padding: "0 16px", border: `1px solid ${hairline}` }}
      >
        <span className="flex items-center gap-2">
          <ListIcon />
          <span style={{ fontSize: "14px", fontWeight: 600, color: ink }}>{labels.title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span style={{ fontSize: "13px", color: muted }}>{labels.sections}</span>
          <ChevronDownIcon open={open} />
        </span>
      </button>

      {open && (
        <ul style={{ border: `1px solid ${hairline}`, borderTop: "none" }}>
          {sections.map((section) => (
            <li key={section.id} style={{ borderTop: `1px solid ${hairline}` }}>
              <a
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  fontSize: "14px",
                  color: ink,
                }}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
