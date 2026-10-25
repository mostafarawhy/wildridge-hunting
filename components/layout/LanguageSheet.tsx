"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import BottomSheet from "@/components/ui/BottomSheet";
import { useSwitchLocale } from "@/components/home/LanguageSwitcher";

const LOCALES = [
  { code: "en", short: "EN", native: "English", dir: "ltr" },
  { code: "ar", short: "AR", native: "العربية", dir: "rtl" },
  { code: "ru", short: "RU", native: "Русский", dir: "ltr" },
] as const;

export default function LanguageSheet() {
  const t = useTranslations("nav");
  const tShop = useTranslations("shop");
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale);

  return (
    <>
      <button
        type="button"
        aria-label={`${t("lang_label")}: ${current?.short}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden relative flex shrink-0 items-center gap-1.5 cursor-pointer px-3 transition-opacity duration-150 active:opacity-60 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
        style={{
          height: "36px",
          borderRadius: "18px",
          border:
            "1px solid color-mix(in srgb, var(--color-content-primary) 35%, transparent)",
          color: "var(--color-content-primary)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
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
        <span className="text-label tracking-widest uppercase">
          {current?.short}
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={t("lang_label")}
        title={t("lang_label")}
        closeLabel={tShop("close")}
      >
        <ul role="list">
          {LOCALES.map((l) => {
            const selected = l.code === locale;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    switchLocale(l.code);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 text-start cursor-pointer transition-colors duration-150 active:bg-[var(--color-surface-overlay)] [@media(hover:hover)]:hover:bg-[var(--color-surface-overlay)]"
                  style={{ minHeight: "56px" }}
                >
                  <span className="flex flex-col">
                    <span
                      lang={l.code === "en" ? undefined : l.code}
                      dir={l.code === "ar" ? "rtl" : undefined}
                      className="text-body-lg"
                      style={{
                        color: "var(--color-content-primary)",
                        fontWeight: selected
                          ? "var(--font-semibold)"
                          : "var(--font-normal)",
                      }}
                    >
                      {l.native}
                    </span>
                    <span
                      className="text-body-sm"
                      style={{ color: "var(--color-content-tertiary)" }}
                    >
                      {t(`lang_${l.code}` as Parameters<typeof t>[0])}
                    </span>
                  </span>
                  {selected && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-action-primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
