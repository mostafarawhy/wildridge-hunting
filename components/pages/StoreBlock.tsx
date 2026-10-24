import { getTranslations } from "next-intl/server";
import type { PublicStore } from "@/lib/db/queries/stores";
import { StoreBlockView } from "@/components/pages/StoreBlockView";

export async function StoreBlock({
  store,
  locale,
  compact = false,
}: {
  store: PublicStore;
  locale: "en" | "ar" | "ru";
  compact?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "pages" });

  return (
    <StoreBlockView
      store={store}
      locale={locale}
      compact={compact}
      labels={{
        mainShowroom: t("stores.mainShowroom"),
        showroom: t("contact.showroom"),
        openNow: t("stores.openNow"),
        closedNow: t("stores.closedNow"),
        until: (time) => t("stores.until", { time }),
        opensToday: (time) => t("stores.opensToday", { time }),
        opensOn: (day, time) => t("stores.opensOn", { day, time }),
        closed: t("stores.closed"),
        hoursTitle: t("stores.hoursTitle"),
        visitCta: t("contact.visitCta"),
        callCta: t("contact.callCta"),
        mapTitle: t("contact.mapTitle"),
      }}
    />
  );
}
