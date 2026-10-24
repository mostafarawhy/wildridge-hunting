import Image from "next/image";
import { HOME_BUILTIN_MEDIA } from "@/lib/settings/home-page";
import InViewVideo from "@/components/ui/InViewVideo";
import { isPreviewSrc } from "@/lib/utils/images";
import { posterSrc } from "@/lib/utils/poster-src";
import type { LinkSlot } from "./link-slot";

interface BrandStoryViewProps {
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
  photoUrl: string | null;
  videoUrl: string | null;
  link: LinkSlot;
}

export default function BrandStoryView({
  eyebrow,
  heading,
  body,
  buttonLabel,
  buttonHref,
  photoUrl,
  videoUrl,
  link,
}: BrandStoryViewProps) {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ minHeight: "550px" }}
      aria-label="Brand story"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--color-surface-sunken)", zIndex: 0 }}
      />

      {photoUrl === null && !HOME_BUILTIN_MEDIA.story.video ? (
        <div
          className="absolute inset-0"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        >
          <Image
            src={HOME_BUILTIN_MEDIA.story.poster}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "center" }}
            unoptimized={isPreviewSrc(HOME_BUILTIN_MEDIA.story.poster)}
          />
        </div>
      ) : photoUrl === null ? (
        <InViewVideo
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          src={HOME_BUILTIN_MEDIA.story.video}
          poster={posterSrc(HOME_BUILTIN_MEDIA.story.poster)}
          muted
          loop
          playsInline
        />
      ) : videoUrl !== null ? (
        <InViewVideo
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 1 }}
          src={videoUrl}
          poster={posterSrc(photoUrl)}
          muted
          loop
          playsInline
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ zIndex: 1 }}
          aria-hidden="true"
        >
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "center" }}
            unoptimized={isPreviewSrc(photoUrl)}
          />
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.65) 100%)",
          zIndex: 2,
        }}
      />

      <div
        className="absolute bottom-0 start-0 end-0 px-8 pb-20 lg:px-16 lg:pb-24"
        style={{ zIndex: 3 }}
      >
        <div className="mx-auto max-w-[1440px] flex flex-col items-start gap-5 lg:max-w-[560px] lg:mx-0">
          <p
            className="text-eyebrow uppercase tracking-widest"
            style={{ color: "var(--color-content-primary)" }}
          >
            {eyebrow}
          </p>

          <h2
            className="font-bold uppercase leading-tight"
            style={{
              color: "var(--color-content-primary)",
              fontSize: "clamp(1.75rem, 3.5vw, var(--text-heading-desktop))",
              textShadow: "0 2px 24px rgba(0,0,0,0.5)",
              whiteSpace: "pre-line",
            }}
          >
            {heading}
          </h2>

          <p
            className="text-body leading-relaxed max-w-[420px]"
            style={{
              color: "var(--color-content-secondary)",
              textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            }}
          >
            {body}
          </p>

          {link({
            href: buttonHref,
            className:
              "mt-2 inline-flex h-10 items-center px-7 text-label uppercase font-medium tracking-widest transition-opacity duration-150 hover:opacity-80",
            style: {
              backgroundColor: "var(--color-action-primary)",
              color: "var(--color-action-primary-fg)",
            },
            children: buttonLabel,
          })}
        </div>
      </div>
    </section>
  );
}
