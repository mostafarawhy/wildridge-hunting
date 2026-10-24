import { getLocale, getTranslations } from "next-intl/server";
import { getFreeShippingOffer } from "@/lib/db/queries/shipping";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { resolveAnnouncement } from "@/lib/settings/site-banners";
import { dubaiDayFromIso } from "@/lib/utils/coupon-display";
import { formatAED } from "@/lib/utils/currency";
import { Link } from "@/i18n/navigation";
import AnnouncementBarView from "./AnnouncementBarView";

export default async function AnnouncementBar() {
  const t = await getTranslations("home");
  const tFooter = await getTranslations("footer");
  const offer = await getFreeShippingOffer();
  const locale = await getLocale();
  const { value } = await getSiteBanners();
  const announcement = resolveAnnouncement(
    value,
    locale,
    dubaiDayFromIso(new Date().toISOString()),
  );

  const shippingText = offer
    ? t("announcement_shipping", {
        amount: formatAED(offer.thresholdAed, locale as "en" | "ar" | "ru"),
      })
    : null;

  return (
    <AnnouncementBarView
      shippingText={shippingText}
      message={announcement?.text ?? t("announcement_dealer")}
      messageHref={announcement?.href || null}
      storesLabel={tFooter("link_stores")}
      link={(p) => (
        <Link
          href={p.href}
          className={p.className}
          style={p.style}
          aria-label={p.ariaLabel}
        >
          {p.children}
        </Link>
      )}
    />
  );
}
