import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { Inline } from "@/lib/utils/page-blocks";

const linkStyle = {
  color: "var(--color-action-primary)",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
} as const;

export function PageInline({
  inlines,
  linkMode,
}: {
  inlines: Inline[];
  linkMode: "locale" | "plain";
}) {
  return (
    <>
      {inlines.map((inline, i) => {
        if (inline.type === "text")
          return <Fragment key={i}>{inline.text}</Fragment>;
        if (linkMode === "locale" && inline.href.startsWith("/")) {
          return (
            <Link key={i} href={inline.href} style={linkStyle}>
              {inline.text}
            </Link>
          );
        }
        if (linkMode === "plain" || inline.href.startsWith("https://")) {
          return (
            <a
              key={i}
              href={inline.href}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              {inline.text}
            </a>
          );
        }
        return (
          <a key={i} href={inline.href} style={linkStyle}>
            {inline.text}
          </a>
        );
      })}
    </>
  );
}
