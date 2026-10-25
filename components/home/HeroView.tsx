import Image from "next/image";
import { isPreviewSrc } from "@/lib/utils/images";
import type { LinkSlot } from "./link-slot";

interface HeroViewProps {
  photoUrl: string;
  photoAlt: string;
  eyebrow: string;
  heading: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  link: LinkSlot;
}

export default function HeroView({
  photoUrl,
  photoAlt,
  eyebrow,
  heading,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  link,
}: HeroViewProps) {
  return (
    <section
      className="relative w-full overflow-hidden h-[calc(100svh-140px)] min-h-[440px] lg:h-[calc(100svh-112px)] lg:min-h-[560px]"
      style={{ backgroundColor: "var(--color-surface-sunken)" }}
      aria-label="Hero"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "var(--primitive-black)",
          clipPath: "inset(0)",
        }}
        role="img"
        aria-label={photoAlt}
      >
        <div className="absolute inset-0 lg:fixed">
          <Image
            src={photoUrl}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "center top" }}
            unoptimized={isPreviewSrc(photoUrl)}
          />
        </div>
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.15) 100%)",
          zIndex: 1,
        }}
      />

      <div
        className="absolute bottom-0 start-0 end-0 px-5 pb-8 lg:px-16 lg:pb-16"
        style={{ zIndex: 2 }}
      >
        <div className="mx-auto max-w-[1440px]">
          <p
            className="mb-3 text-label uppercase"
            style={{ color: "var(--color-content-secondary)" }}
          >
            {eyebrow}
          </p>

          <h1
            className="mb-6 max-lg:text-[2.25rem] max-lg:leading-[1.05] text-display font-bold uppercase lg:mb-8 lg:text-display"
            style={{
              color: "var(--color-content-primary)",
              whiteSpace: "pre-line",
            }}
          >
            {heading}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            {link({
              href: primaryHref,
              className:
                "flex h-12 lg:h-11 items-center px-7 text-body uppercase font-medium transition-colors duration-150",
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
                  "flex items-center gap-2 text-body uppercase font-medium transition-opacity duration-150 hover:opacity-70",
                style: {
                  color: "var(--color-content-primary)",
                  borderBottom: "1px solid currentColor",
                  paddingBottom: "2px",
                },
                children: (
                  <>
                    {secondaryLabel}
                    <span aria-hidden="true" className="inline-block flip-rtl">
                      →
                    </span>
                  </>
                ),
              })}
          </div>
        </div>
      </div>
    </section>
  );
}
