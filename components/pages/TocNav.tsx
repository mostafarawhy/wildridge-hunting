"use client";

import { useEffect, useState } from "react";
import { ANCHOR_OFFSET_PX } from "@/components/pages/offsets";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";
const red = "var(--color-action-primary)";

function UpArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={muted}
      strokeWidth="1.8"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </svg>
  );
}

export function TocNav({
  sections,
  labels,
}: {
  sections: { id: string; title: string }[];
  labels: { title: string; sections: string; backToTop: string };
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: `-${ANCHOR_OFFSET_PX}px 0px -70% 0px` },
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="hidden lg:flex flex-col">
      <p
        style={{
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: muted,
          marginBottom: "12px",
        }}
      >
        {labels.title}
      </p>
      <ul style={{ borderInlineStart: `1px solid ${hairline}` }}>
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                style={{
                  display: "block",
                  paddingInlineStart: "16px",
                  paddingBlock: "6px",
                  fontSize: "14px",
                  color: active ? ink : muted,
                  fontWeight: active ? 600 : 400,
                  borderInlineStart: active ? `2px solid ${red}` : "2px solid transparent",
                  marginInlineStart: active ? "-1px" : 0,
                }}
              >
                {section.title}
              </a>
            </li>
          );
        })}
      </ul>
      <p style={{ fontSize: "12px", color: muted, marginTop: "12px" }}>{labels.sections}</p>
      <a
        href="#top"
        className="flex items-center gap-2"
        style={{ fontSize: "13px", color: muted, marginTop: "16px" }}
      >
        <UpArrowIcon />
        {labels.backToTop}
      </a>
    </div>
  );
}
