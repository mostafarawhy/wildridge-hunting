"use client";

import { BRAND } from "@/lib/config/brand";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import HomePopupView, {
  popupCtaClass,
  popupCtaStyle,
} from "./HomePopupView";
import NewsletterForm from "@/components/home/NewsletterForm";
import type { HomePopupStyle } from "@/lib/utils/home-popup";

interface Popup {
  id: string;
  version: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  imageUrl: string;
  fallback: boolean;
}

const SEEN_KEY = `${BRAND.storageKeyPrefix}-popup-seen`;
const DELAY_MS = 2000;
const BLOCKED_PREFIXES = ["/cart", "/account", "/auth", "/checkout"];

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function hasSeen(value: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === value;
  } catch {
    return false;
  }
}

function markSeen(value: string) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    // ignore
  }
}

export default function HomePopupClient({
  popup,
  style,
}: {
  popup: Popup;
  style: HomePopupStyle;
}) {
  const t = useTranslations("home");
  const tShop = useTranslations("shop");
  const pathname = usePathname();
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const seenValue = `${popup.id}:${popup.version}`;
  const eligible = !BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    if (!eligible || hasSeen(seenValue)) return;
    const timer = setTimeout(() => {
      if (!hasSeen(seenValue)) setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [eligible, seenValue]);

  const close = useCallback(() => {
    markSeen(seenValue);
    setOpen(false);
  }, [seenValue]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [open, close]);

  if (!isClient || !open) return null;

  const ctaClass = popupCtaClass;
  const ctaStyle = popupCtaStyle(style.buttonColor);

  let cta: React.ReactNode;
  if (style.purpose === "newsletter") {
    cta = (
      <NewsletterForm
        source="POPUP"
        tone={style.theme}
        buttonLabel={popup.cta}
        buttonColor={style.buttonColor}
        onSubscribed={() => markSeen(seenValue)}
      />
    );
  } else if (popup.href.startsWith("https://")) {
    cta = (
      <a
        href={popup.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className={ctaClass}
        style={ctaStyle}
      >
        {popup.cta}
      </a>
    );
  } else if (popup.href.startsWith("/")) {
    cta = (
      <Link href={popup.href} onClick={close} className={ctaClass} style={ctaStyle}>
        {popup.cta}
      </Link>
    );
  } else {
    cta = (
      <button type="button" onClick={close} className={ctaClass} style={ctaStyle}>
        {popup.cta}
      </button>
    );
  }

  return createPortal(
    <HomePopupView
      headingId={headingId}
      title={popup.title}
      body={popup.body}
      imageUrl={popup.imageUrl}
      closeLabel={tShop("close")}
      dismissLabel={t("popup_dismiss")}
      theme={style.theme}
      buttonColor={style.buttonColor}
      onClose={close}
      cta={cta}
      lang={popup.fallback ? "en" : undefined}
      dir={popup.fallback ? "ltr" : undefined}
      dialogRef={dialogRef}
      closeRef={closeRef}
    />,
    document.body,
  );
}
