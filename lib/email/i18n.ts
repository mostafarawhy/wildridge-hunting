import "server-only";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";
import type { EmailChromeContext } from "@/lib/email/chrome";

export type EmailLocale = EmailChromeContext["locale"];

const CATALOGS = { en, ar, ru } as const;

export function isEmailLocale(value: string): value is EmailLocale {
  return value === "en" || value === "ar" || value === "ru";
}

export function emailChromeContext(locale: EmailLocale): EmailChromeContext {
  return {
    locale,
    dir: locale === "ar" ? "rtl" : "ltr",
    strings: (CATALOGS[locale] as typeof en).email,
  };
}
