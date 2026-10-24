"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

const LOCALES = [
  { code: "en", short: "EN" },
  { code: "ar", short: "AR" },
  { code: "ru", short: "RU" },
] as const;

interface LanguageSwitcherProps {
  variant?: "dropdown" | "inline";
  onSelect?: () => void;
}

export default function LanguageSwitcher({
  variant = "dropdown",
  onSelect,
}: LanguageSwitcherProps = {}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(code: string) {
    const segments = pathname.split("/");
    segments[1] = code;
    startNavigationProgress(segments.join("/"));
    router.push(segments.join("/"), { scroll: false });

    setOpen(false);
  }

  const current = LOCALES.find((l) => l.code === locale);

  if (variant === "inline") {
    return (
      <div className="flex items-center" style={{ gap: "1rem" }}>
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-label={t(`lang_${l.code}` as Parameters<typeof t>[0])}
            onClick={() => {
              switchLocale(l.code);
              onSelect?.();
            }}
            className="text-body-sm tracking-widest uppercase cursor-pointer transition-opacity hover:opacity-70"
            style={{
              color:
                l.code === locale
                  ? "var(--color-content-primary)"
                  : "var(--color-content-tertiary)",
              fontWeight:
                l.code === locale
                  ? "var(--font-semibold)"
                  : "var(--font-normal)",
            }}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("lang_label")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-70"
        style={{ color: "var(--color-content-primary)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 8 6 6" />
          <path d="m4 14 6-6 2-3" />
          <path d="M2 5h12" />
          <path d="M7 2h1" />
          <path d="m22 22-5-10-5 10" />
          <path d="M14 18h6" />
        </svg>
        <span
          className="text-label tracking-widest uppercase"
          style={{ color: "var(--color-content-secondary)" }}
        >
          {current?.short}
        </span>
      </button>

      {open && (
        <div
          className="absolute end-0 top-full mt-2 flex flex-col py-1 min-w-[140px]"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-md)",
            zIndex: "var(--z-dropdown)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLocale(l.code)}
              className="flex items-center justify-between px-4 py-2.5 text-body-sm transition-colors duration-150 cursor-pointer"
              style={{
                color:
                  l.code === locale
                    ? "var(--color-content-primary)"
                    : "var(--color-content-secondary)",
                backgroundColor:
                  l.code === locale
                    ? "var(--color-surface-overlay)"
                    : "transparent",
                fontWeight:
                  l.code === locale
                    ? "var(--font-semibold)"
                    : "var(--font-normal)",
              }}
              onMouseEnter={(e) => {
                if (l.code !== locale)
                  e.currentTarget.style.backgroundColor =
                    "var(--color-surface-overlay)";
              }}
              onMouseLeave={(e) => {
                if (l.code !== locale)
                  e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span>{t(`lang_${l.code}` as Parameters<typeof t>[0])}</span>
              <span
                className="text-label tracking-widest"
                style={{ color: "var(--color-content-tertiary)" }}
              >
                {l.short}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
