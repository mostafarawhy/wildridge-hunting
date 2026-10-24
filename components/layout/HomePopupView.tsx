"use client";

import type { ReactNode, Ref } from "react";
import FadeImage from "@/components/ui/FadeImage";
import {
  popupButtonColors,
  type HomePopupButtonColor,
  type HomePopupTheme,
} from "@/lib/utils/home-popup";

export const popupCtaClass =
  "inline-flex h-12 w-full sm:w-auto items-center justify-center px-8 mt-7 text-body-sm uppercase tracking-widest font-bold transition-opacity duration-150 hover:opacity-85";

export function popupCtaStyle(buttonColor: HomePopupButtonColor = "gold") {
  const { bg, fg } = popupButtonColors[buttonColor];
  return { backgroundColor: bg, color: fg };
}

interface HomePopupViewProps {
  headingId: string;
  title: string;
  body: string;
  imageUrl: string;
  unoptimized?: boolean;
  theme?: HomePopupTheme;
  buttonColor?: HomePopupButtonColor;
  closeLabel: string;
  dismissLabel: string;
  onClose: () => void;
  cta?: ReactNode;
  ctaLabel?: string;
  dir?: "ltr" | "rtl";
  lang?: string;
  dialogRef?: Ref<HTMLDivElement>;
  closeRef?: Ref<HTMLButtonElement>;
}

export default function HomePopupView({
  headingId,
  title,
  body,
  imageUrl,
  unoptimized,
  theme = "dark",
  buttonColor = "gold",
  closeLabel,
  dismissLabel,
  onClose,
  cta,
  ctaLabel,
  dir,
  lang,
  dialogRef,
  closeRef,
}: HomePopupViewProps) {
  const light = theme === "light";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: "var(--z-modal)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        lang={lang}
        dir={dir}
        className="popup-rise relative flex w-full max-w-[400px] flex-col overflow-y-auto sm:max-w-[760px] sm:flex-row"
        style={{
          backgroundColor: light
            ? "var(--color-auth-input-bg)"
            : "var(--primitive-black)",
          border: light ? "1px solid var(--color-shop-divider)" : undefined,
          boxShadow: "var(--shadow-modal)",
          maxHeight: "calc(100dvh - 2rem)",
        }}
      >
        <div className="relative w-full shrink-0 aspect-[16/10] sm:aspect-auto sm:w-[46%] sm:min-h-[420px]">
          <FadeImage
            tone="dark"
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 350px, 400px"
            className="object-cover"
            unoptimized={unoptimized}
          />
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute top-3 flex items-center justify-center cursor-pointer"
          style={{
            insetInlineEnd: "0.75rem",
            zIndex: 1,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: light
              ? "rgba(255,255,255,0.85)"
              : "rgba(11,11,11,0.55)",
            color: light ? "var(--primitive-black)" : "var(--primitive-white)",
            border: light
              ? "1px solid rgba(11,11,11,0.25)"
              : "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 3L13 13M13 3L3 13" />
          </svg>
        </button>

        <div className="flex flex-1 flex-col justify-center px-6 pt-6 pb-7 sm:px-10 sm:py-12">
          <span
            aria-hidden="true"
            className="block h-px w-8 mb-5"
            style={{ backgroundColor: "var(--primitive-gold)" }}
          />
          <h2
            id={headingId}
            className="text-heading font-bold leading-tight"
            style={{
              color: light ? "var(--primitive-black)" : "var(--primitive-white)",
            }}
          >
            {title}
          </h2>
          {body && (
            <p
              className="text-body mt-3"
              style={{
                color: light ? "rgba(11,11,11,0.68)" : "rgba(255,255,255,0.68)",
              }}
            >
              {body}
            </p>
          )}
          {cta ??
            (ctaLabel ? (
              <button
                type="button"
                className={popupCtaClass}
                style={popupCtaStyle(buttonColor)}
              >
                {ctaLabel}
              </button>
            ) : null)}
          <button
            type="button"
            onClick={onClose}
            className="self-center sm:self-start mt-4 text-body-sm underline cursor-pointer"
            style={{
              color: light ? "rgba(11,11,11,0.6)" : "rgba(255,255,255,0.55)",
              background: "none",
              border: "none",
            }}
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
