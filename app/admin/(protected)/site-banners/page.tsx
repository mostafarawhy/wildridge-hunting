import { requireStaff } from "@/lib/auth-staff";
import { getFreeShippingOffer } from "@/lib/db/queries/shipping";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { SITE_BUILTIN, sitePhotoKeys, type SiteLocale } from "@/lib/settings/site-banners";
import { dubaiDayFromIso } from "@/lib/utils/coupon-display";
import { formatAED } from "@/lib/utils/currency";
import { getContentImageUrl } from "@/lib/utils/images";
import SiteBannersEditor from "@/components/admin/SiteBannersEditor";
import type { SiteBannersLabels } from "@/components/admin/SiteBannersPreview";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

const CATALOGS = { en, ar, ru } as const;

export default async function Page() {
  await requireStaff("content:manage");
  const [{ value, saved, legacy, updatedAt }, offer] = await Promise.all([
    getSiteBanners(),
    getFreeShippingOffer(),
  ]);

  function labelsFor(locale: SiteLocale): SiteBannersLabels {
    const catalog = CATALOGS[locale];
    return {
      shippingText: offer
        ? catalog.home.announcement_shipping.replace(
            "{amount}",
            formatAED(offer.thresholdAed, locale),
          )
        : null,
      dealer: catalog.home.announcement_dealer,
      stores: catalog.footer.link_stores,
      allProducts: catalog.shop.all_products,
      riflesLabel: catalog.nav.rifles_pistols,
      shopAll: catalog.nav.shop_all,
    };
  }

  const initialUrls: Record<string, string> = {};
  for (const key of sitePhotoKeys(value)) {
    const url = getContentImageUrl(key);
    if (url) initialUrls[key] = url;
  }

  return (
    <SiteBannersEditor
      initial={value}
      saved={saved}
      legacy={legacy}
      savedAt={saved ? updatedAt : null}
      today={dubaiDayFromIso(new Date().toISOString())}
      initialUrls={initialUrls}
      builtIn={{
        shop: SITE_BUILTIN.shopPhoto,
        menu: SITE_BUILTIN.menuPhoto,
        pages: SITE_BUILTIN.pagesHero,
        stores: SITE_BUILTIN.storesHero,
      }}
      labels={{ en: labelsFor("en"), ar: labelsFor("ar"), ru: labelsFor("ru") }}
    />
  );
}
