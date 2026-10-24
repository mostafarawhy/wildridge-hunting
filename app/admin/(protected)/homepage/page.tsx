import type { AbstractIntlMessages } from "next-intl";
import { requireStaff } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import {
  getFeaturedForEditor,
  getFeaturedPickerItems,
} from "@/lib/db/queries/collections";
import { getHomePage } from "@/lib/db/queries/home-page";
import {
  HOME_BUILTIN_PHOTOS,
  homePhotoKeys,
  type HomeLocale,
} from "@/lib/settings/home-page";
import { getContentImageUrl } from "@/lib/utils/images";
import HomePageEditor from "@/components/admin/HomePageEditor";
import type { HomePreviewLabels } from "@/components/admin/HomePagePreview";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

const CATALOGS = { en, ar, ru } as const;

function previewLabels(locale: HomeLocale): HomePreviewLabels {
  const c = CATALOGS[locale];
  return {
    shopNow: c.home.collection_shop_now,
    featuredEyebrow: c.home.featured_eyebrow,
    seeAll: c.home.see_all,
    legalPrefix: c.home.newsletter_legal_prefix,
    legalLink: c.home.newsletter_legal_link,
    legalSuffix: c.home.newsletter_legal_suffix,
    ariaInstagram: c.footer.aria_instagram,
    ariaWhatsapp: c.footer.aria_whatsapp,
    ariaYoutube: c.footer.aria_youtube,
  };
}

function formMessages(locale: HomeLocale): AbstractIntlMessages {
  const c = CATALOGS[locale];
  return {
    newsletter: c.newsletter,
    home: c.home,
    common: c.common,
    shop: c.shop,
    cart: c.cart,
  };
}

export default async function Page() {
  await requireStaff("content:manage");
  const [{ value, saved, legacy, updatedAt }, profile, featured, pickerItems] =
    await Promise.all([
      getHomePage(),
      getSetting("store_profile"),
      getFeaturedForEditor(),
      getFeaturedPickerItems(),
    ]);
  const digits = profile.contactPhone.replace(/\D/g, "");

  const initialUrls: Record<string, string> = {};
  for (const key of homePhotoKeys(value)) {
    const url = getContentImageUrl(key);
    if (url) initialUrls[key] = url;
  }

  return (
    <HomePageEditor
      initial={value}
      initialFeatured={featured}
      pickerItems={pickerItems}
      saved={saved}
      legacy={legacy}
      savedAt={saved ? updatedAt : null}
      initialUrls={initialUrls}
      builtInPhotos={{
        hero: HOME_BUILTIN_PHOTOS.hero,
        tiles: [...HOME_BUILTIN_PHOTOS.tiles],
      }}
      labels={{
        en: previewLabels("en"),
        ar: previewLabels("ar"),
        ru: previewLabels("ru"),
      }}
      socials={{
        instagram: profile.instagramUrl,
        whatsapp: digits ? `https://wa.me/${digits}` : "",
        youtube: profile.youtubeUrl,
      }}
      formMessages={{
        en: formMessages("en"),
        ar: formMessages("ar"),
        ru: formMessages("ru"),
      }}
    />
  );
}
