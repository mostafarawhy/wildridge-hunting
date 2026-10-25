import Image from "next/image";
import { WhatsAppIcon } from "@/components/ui/icons";
import { isPreviewSrc } from "@/lib/utils/images";
import type { LinkSlot } from "./link-slot";

interface NewsletterSocial {
  key: "instagram" | "whatsapp" | "youtube";
  href: string;
  ariaLabel: string;
}

interface NewsletterBandViewProps {
  heading: string;
  body: string;
  photoUrl: string;
  socials: NewsletterSocial[];
  form: React.ReactNode;
  legalPrefix: string;
  legalLinkLabel: string;
  legalSuffix: string;
  link: LinkSlot;
}

function SocialIcon({ name }: { name: NewsletterSocial["key"] }) {
  if (name === "whatsapp") return <WhatsAppIcon size={18} />;
  if (name === "instagram") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 9.5l5 2.5-5 2.5V9.5z" fill="currentColor" />
    </svg>
  );
}

export default function NewsletterBandView({
  heading,
  body,
  photoUrl,
  socials,
  form,
  legalPrefix,
  legalLinkLabel,
  legalSuffix,
  link,
}: NewsletterBandViewProps) {
  return (
    <section className="w-full" aria-label="Newsletter signup">
      <div
        className="grid grid-cols-1 lg:grid-cols-2"
        style={{ minHeight: "560px" }}
      >
        <div
          className="relative flex flex-col items-start justify-end p-10 lg:p-16"
          style={{ minHeight: "360px" }}
        >
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            style={{ objectPosition: "center" }}
            unoptimized={isPreviewSrc(photoUrl)}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.4) 100%)",
            }}
          />

          <div className="relative flex flex-col gap-6" style={{ zIndex: 1 }}>
            <h2
              className="text-heading font-bold uppercase tracking-tight leading-tight lg:text-heading-desktop"
              style={{
                color: "var(--color-content-primary)",
                whiteSpace: "pre-line",
              }}
            >
              {heading}
            </h2>

            {socials.length > 0 && (
              <div className="flex items-center gap-4">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    aria-label={s.ariaLabel}
                    className="transition-opacity duration-150 hover:opacity-60"
                    style={{ color: "var(--color-content-secondary)" }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <SocialIcon name={s.key} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex flex-col justify-center px-10 py-14 lg:px-16"
          style={{ backgroundColor: "var(--color-surface-sunken)" }}
        >
          <p
            className="mb-6 text-body leading-relaxed tracking-wide max-w-[380px]"
            style={{ color: "var(--color-content-secondary)" }}
          >
            {body}
          </p>

          <div className="flex flex-col gap-4 max-w-[420px]">
            {form}

            <p
              className="text-label tracking-wide"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {legalPrefix}{" "}
              {link({
                href: "/privacy",
                className:
                  "underline underline-offset-2 transition-opacity duration-150 hover:opacity-70",
                style: { color: "var(--color-content-tertiary)" },
                children: legalLinkLabel,
              })}
              {". "}
              {legalSuffix}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
