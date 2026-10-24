"use client";

import { useFaqSearch } from "@/components/pages/FaqSearch";

const ink = "var(--primitive-black)";
const red = "var(--color-action-primary)";
const hairline = "var(--color-shop-divider)";

export function FaqTiles({
  tiles,
}: {
  tiles: { id: string; title: string; countLabel: string }[];
}) {
  const { query } = useFaqSearch();

  if (query.trim() !== "") return null;
  if (tiles.length === 0) return null;

  return (
    <section
      className="px-6 pt-10 lg:px-24 lg:pt-16"
      style={{ background: "var(--color-auth-input-bg)" }}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile, i) => (
          <a
            key={tile.id}
            href={`#${tile.id}`}
            style={{
              border: `1px solid ${hairline}`,
              borderInlineStart: i === 0 ? `3px solid ${red}` : `1px solid ${hairline}`,
              padding: "28px",
            }}
          >
            <p style={{ fontSize: "18px", fontWeight: 700, color: ink }}>{tile.title}</p>
            <p style={{ fontSize: "13px", fontWeight: 600, color: red, marginTop: "6px" }}>
              {tile.countLabel}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
