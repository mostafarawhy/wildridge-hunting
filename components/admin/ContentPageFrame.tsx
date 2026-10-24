"use client";

import Link from "next/link";

type Sketch =
  | "header"
  | "body"
  | "search"
  | "popup"
  | "showroom"
  | "footer"
  | "homepage"
  | "siteBanners";

interface Props {
  backHref: string;
  backLabel: string;
  title: string;
  status?: { label: string; tone: "green" | "grey" };
  path?: string;
  liveHref?: string | null;
  purpose: string;
  sketch: Sketch;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  tabsEnd?: React.ReactNode;
  children: React.ReactNode;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: "dark" | "light";
  edit?: boolean;
}

const SKETCHES: Record<Sketch, Block[]> = {
  header: [
    { x: 0, y: 0, w: 120, h: 28, fill: "dark", edit: true },
    { x: 8, y: 38, w: 104, h: 6, fill: "light" },
    { x: 8, y: 50, w: 88, h: 6, fill: "light" },
    { x: 8, y: 62, w: 96, h: 6, fill: "light" },
  ],
  body: [
    { x: 0, y: 0, w: 120, h: 18, fill: "dark" },
    { x: 8, y: 26, w: 104, h: 50, fill: "light", edit: true },
  ],
  search: [
    { x: 8, y: 14, w: 64, h: 8, fill: "dark", edit: true },
    { x: 8, y: 28, w: 104, h: 5, fill: "light", edit: true },
    { x: 8, y: 37, w: 84, h: 5, fill: "light", edit: true },
    { x: 8, y: 54, w: 64, h: 8, fill: "dark" },
    { x: 8, y: 68, w: 104, h: 5, fill: "light" },
  ],
  popup: [
    { x: 0, y: 0, w: 120, h: 80, fill: "light" },
    { x: 20, y: 12, w: 80, h: 56, fill: "light", edit: true },
    { x: 20, y: 12, w: 40, h: 56, fill: "dark", edit: true },
  ],
  showroom: [
    { x: 8, y: 10, w: 52, h: 60, fill: "light", edit: true },
    { x: 68, y: 14, w: 44, h: 8, fill: "dark", edit: true },
    { x: 68, y: 28, w: 44, h: 5, fill: "light", edit: true },
    { x: 68, y: 38, w: 36, h: 5, fill: "light", edit: true },
    { x: 68, y: 52, w: 44, h: 14, fill: "dark", edit: true },
  ],
  footer: [
    { x: 8, y: 8, w: 104, h: 6, fill: "light" },
    { x: 8, y: 20, w: 88, h: 6, fill: "light" },
    { x: 0, y: 44, w: 120, h: 36, fill: "dark", edit: true },
  ],
  homepage: [
    { x: 0, y: 0, w: 120, h: 18, fill: "dark", edit: true },
    { x: 4, y: 21, w: 25, h: 10, fill: "light", edit: true },
    { x: 31, y: 21, w: 25, h: 10, fill: "light", edit: true },
    { x: 58, y: 21, w: 25, h: 10, fill: "light", edit: true },
    { x: 85, y: 21, w: 25, h: 10, fill: "light", edit: true },
    { x: 4, y: 33, w: 25, h: 10, fill: "dark", edit: true },
    { x: 31, y: 33, w: 25, h: 10, fill: "dark", edit: true },
    { x: 58, y: 33, w: 25, h: 10, fill: "dark", edit: true },
    { x: 85, y: 33, w: 25, h: 10, fill: "dark", edit: true },
    { x: 0, y: 45, w: 120, h: 8, fill: "dark", edit: true },
    { x: 0, y: 55, w: 60, h: 9, fill: "dark", edit: true },
    { x: 60, y: 55, w: 60, h: 9, fill: "light", edit: true },
    { x: 0, y: 66, w: 120, h: 6, fill: "light", edit: true },
    { x: 0, y: 74, w: 120, h: 6, fill: "dark", edit: true },
  ],
  siteBanners: [
    { x: 0, y: 0, w: 120, h: 6, fill: "dark", edit: true },
    { x: 0, y: 8, w: 120, h: 14, fill: "dark" },
    { x: 8, y: 28, w: 104, h: 46, fill: "dark", edit: true },
  ],
};

function Schematic({ sketch }: { sketch: Sketch }) {
  return (
    <div style={{ flexShrink: 0, width: "120px" }}>
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: "120px",
          height: "80px",
          backgroundColor: "#ffffff",
          border: "1px solid #e8e8e8",
          boxSizing: "content-box",
          marginInlineStart: "-1px",
          overflow: "hidden",
        }}
      >
        {SKETCHES[sketch].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${b.x}px`,
              top: `${b.y}px`,
              width: `${b.w}px`,
              height: `${b.h}px`,
              backgroundColor: b.fill === "dark" ? "#0b0b0b" : "#e8e8e8",
              outline: b.edit ? "1.5px solid var(--color-action-primary)" : "none",
              outlineOffset: b.edit ? "-1.5px" : 0,
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "#6b6b6b",
          margin: "0.375rem 0 0",
        }}
      >
        Red: what you are editing
      </p>
    </div>
  );
}

export default function ContentPageFrame({
  backHref,
  backLabel,
  title,
  status,
  path,
  liveHref,
  purpose,
  sketch,
  tabs,
  activeTab,
  onTabChange,
  tabsEnd,
  children,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {backLabel}
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h1
                style={{
                  fontSize: "var(--text-heading)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "var(--tracking-tight)",
                }}
              >
                {title}
              </h1>
              {status && (
                <span
                  style={{
                    display: "inline-block",
                    paddingInline: "0.5rem",
                    paddingBlock: "0.125rem",
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    backgroundColor: status.tone === "green" ? "#dcfce7" : "#f3f4f6",
                    color: status.tone === "green" ? "#166534" : "#374151",
                  }}
                >
                  {status.label}
                </span>
              )}
            </div>
            {path && (
              <div
                dir="ltr"
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-body-sm)",
                  color: "#9a9a9a",
                  marginTop: "0.25rem",
                }}
              >
                {path}
              </div>
            )}
          </div>

          {liveHref && (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                textDecoration: "underline",
              }}
            >
              View live page ↗
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.25rem",
          padding: "1rem 1.25rem",
          backgroundColor: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: "0",
        }}
      >
        <div style={{ flex: "1 1 18rem", minWidth: 0 }}>
          <p
            style={{
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "#6b6b6b",
              margin: "0 0 0.375rem",
            }}
          >
            WHAT THIS PAGE IS
          </p>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              margin: 0,
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {purpose}
          </p>
        </div>
        <Schematic sketch={sketch} />
      </div>

      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "0.75rem",
            borderBottom: "1px solid #e8e8e8",
          }}
        >
          <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
            {tabs.map((tab, i) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange?.(tab.id)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: `2px solid ${active ? "var(--color-action-primary)" : "transparent"}`,
                    marginBottom: "-1px",
                    padding: "0.625rem 0",
                    fontSize: "var(--text-body)",
                    fontWeight: active ? "var(--font-semibold)" : "var(--font-medium)",
                    color: active ? "#0b0b0b" : "#6b6b6b",
                    cursor: "pointer",
                  }}
                >
                  {`${i + 1} · ${tab.label}`}
                </button>
              );
            })}
          </div>
          {tabsEnd && <div style={{ paddingBottom: "0.5rem" }}>{tabsEnd}</div>}
        </div>
      )}

      {children}
    </div>
  );
}
