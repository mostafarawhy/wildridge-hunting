import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";
import type { StorePreviewLabels } from "@/components/admin/StorePreview";
import type { PopupSignupLabels } from "@/components/admin/HomePopupPreview";

const CATALOGS = { en, ar, ru } as const;

function storeLabels(locale: "en" | "ar" | "ru"): StorePreviewLabels {
  const pages = CATALOGS[locale].pages;
  return {
    mainShowroom: pages.stores.mainShowroom,
    showroom: pages.contact.showroom,
    openNow: pages.stores.openNow,
    closedNow: pages.stores.closedNow,
    until: pages.stores.until,
    opensToday: pages.stores.opensToday,
    opensOn: pages.stores.opensOn,
    closed: pages.stores.closed,
    hoursTitle: pages.stores.hoursTitle,
    visitCta: pages.contact.visitCta,
    callCta: pages.contact.callCta,
    mapTitle: pages.contact.mapTitle,
  };
}

function signupLabels(locale: "en" | "ar" | "ru"): PopupSignupLabels {
  return {
    placeholder: CATALOGS[locale].common.email_placeholder,
    consentPrefix: CATALOGS[locale].home.newsletter_legal_prefix,
    consentLink: CATALOGS[locale].home.newsletter_legal_link,
    consentSuffix: CATALOGS[locale].home.newsletter_legal_suffix,
  };
}

export const popupSignupLabels: Record<"en" | "ar" | "ru", PopupSignupLabels> = {
  en: signupLabels("en"),
  ar: signupLabels("ar"),
  ru: signupLabels("ru"),
};

export function buildStorePreviewLabels(): Record<"en" | "ar" | "ru", StorePreviewLabels> {
  return { en: storeLabels("en"), ar: storeLabels("ar"), ru: storeLabels("ru") };
}
