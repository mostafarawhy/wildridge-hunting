import type { Block } from "@/lib/utils/page-blocks";
import { PageInline } from "@/components/pages/PageInline";
import { ANCHOR_OFFSET } from "@/components/pages/offsets";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const bodyText = "var(--color-auth-label-text)";
const hairline = "var(--color-shop-divider)";
const red = "var(--color-action-primary)";
const warmBand = "var(--color-auth-form-bg)";

function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth="1.5"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.75" r="0.9" fill={ink} stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth="2"
      style={{ flexShrink: 0 }}
    >
      <polyline points="4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export function PageBlocks({
  blocks,
  numbered,
  size,
  linkMode,
}: {
  blocks: Block[];
  numbered: boolean;
  size: "default" | "large";
  linkMode: "locale" | "plain";
}) {
  const h2Numbers: number[] = [];
  let h2Count = 0;
  for (const block of blocks) {
    if (block.type === "heading" && block.level === 2) h2Count += 1;
    h2Numbers.push(h2Count);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: size === "large" ? "18px" : "16.5px",
        lineHeight: 1.75,
        color: bodyText,
      }}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading" && block.level === 2) {
          const prefix = numbered ? `${h2Numbers[index]}. ` : "";
          return (
            <h2
              key={index}
              id={block.id}
              style={{
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: ink,
                marginTop: index === 0 ? 0 : "48px",
                marginBottom: "16px",
                scrollMarginTop: ANCHOR_OFFSET,
              }}
            >
              {prefix}
              {block.text}
            </h2>
          );
        }

        if (block.type === "heading" && block.level === 3) {
          return (
            <h3
              key={index}
              id={block.id}
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: ink,
                margin: "8px 0 12px",
                scrollMarginTop: ANCHOR_OFFSET,
              }}
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={index}
              style={{ margin: "0 0 18px", whiteSpace: "pre-line", color: bodyText }}
            >
              <PageInline inlines={block.inlines} linkMode={linkMode} />
            </p>
          );
        }

        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className="marker:text-[var(--color-content-tertiary)]"
              style={{
                listStyleType: block.ordered ? "decimal" : "disc",
                paddingInlineStart: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                margin: "0 0 24px",
                color: bodyText,
              }}
            >
              {block.items.map((item, i) => (
                <li key={i}>
                  <PageInline inlines={item} linkMode={linkMode} />
                </li>
              ))}
            </Tag>
          );
        }

        if (block.type === "pairs") {
          return (
            <div key={index} style={{ margin: "0 0 24px" }}>
              {block.rows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "24px",
                    padding: "12px 0",
                    borderBottom:
                      i === block.rows.length - 1 ? "none" : `1px solid ${hairline}`,
                  }}
                >
                  <span style={{ color: muted }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: ink }}>
                    <PageInline inlines={row.value} linkMode={linkMode} />
                  </span>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "note") {
          return (
            <div
              key={index}
              style={{
                margin: "0 0 32px",
                background: warmBand,
                border: `1px solid ${hairline}`,
                borderInlineStart: `3px solid ${ink}`,
                padding: "20px 24px",
                display: "flex",
                gap: "14px",
              }}
            >
              <InfoIcon />
              <div>
                {block.title && (
                  <div style={{ fontSize: "15px", fontWeight: 700, color: ink }}>
                    {block.title}
                  </div>
                )}
                {block.body.map((line, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "15.5px",
                      lineHeight: 1.65,
                      margin: block.title || i > 0 ? "6px 0 0" : 0,
                      color: bodyText,
                    }}
                  >
                    <PageInline inlines={line} linkMode={linkMode} />
                  </p>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === "highlight") {
          return (
            <div
              key={index}
              style={{
                margin: "0 0 40px",
                border: `1px solid ${hairline}`,
                borderInlineStart: `3px solid ${red}`,
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: red,
                }}
              >
                {block.title}
              </div>
              {block.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <CheckIcon />
                  <span style={{ color: ink }}>
                    <PageInline inlines={item} linkMode={linkMode} />
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
