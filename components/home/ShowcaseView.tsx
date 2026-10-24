import FadeImage from "@/components/ui/FadeImage";
import type { LinkSlot } from "./link-slot";

interface ShowcaseViewProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  photoUrl: string;
  photoAlt: string;
  flip: boolean;
  link: LinkSlot;
}

export default function ShowcaseView({
  eyebrow,
  heading,
  body,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  photoUrl,
  photoAlt,
  flip,
  link,
}: ShowcaseViewProps) {
  return (
    <section
      className="w-full"
      style={{ backgroundColor: "var(--color-surface-inverse)" }}
      aria-label="Product showcase"
    >
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-20 py-16 lg:py-24">
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <FadeImage
              src={photoUrl}
              alt={photoAlt}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{
                transform: flip ? "scaleX(-1)" : "none",
              }}
            />
          </div>

          <div className="flex flex-col items-start">
            <p
              className="mb-4 text-eyebrow tracking-widest uppercase"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {eyebrow}
            </p>

            <h2
              className="mb-6 text-display-sm font-bold uppercase leading-[1.05] tracking-tight lg:text-display-sm-desktop"
              style={{
                color: "var(--color-content-inverse)",
                whiteSpace: "pre-line",
              }}
            >
              {heading}
            </h2>

            <p
              className="mb-10 max-w-[420px] text-body leading-relaxed tracking-wide"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {body}
            </p>

            <div className="flex flex-wrap items-center gap-6">
              {link({
                href: primaryHref,
                className:
                  "inline-flex h-11 items-center px-8 text-label tracking-widest uppercase font-medium transition-opacity duration-150 hover:opacity-80",
                style: {
                  backgroundColor: "var(--color-action-primary)",
                  color: "var(--color-action-primary-fg)",
                },
                children: primaryLabel,
              })}
              {secondaryHref &&
                link({
                  href: secondaryHref,
                  className:
                    "inline-flex items-center gap-2 text-label tracking-widest uppercase font-medium transition-opacity duration-150 hover:opacity-80",
                  style: {
                    color: "var(--color-content-inverse)",
                    borderBottom: "1px solid currentColor",
                  },
                  children: (
                    <>
                      {secondaryLabel}
                      <span aria-hidden="true" className="inline-block flip-rtl">→</span>
                    </>
                  ),
                })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
