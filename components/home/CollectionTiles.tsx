import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getHomePage } from "@/lib/db/queries/home-page";
import { resolveTiles, tilePhotoUrl } from "@/lib/settings/home-page";
import CollectionTilesView from "./CollectionTilesView";

export default async function CollectionTiles() {
  const [t, locale, { value }] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    getHomePage(),
  ]);
  const { texts } = resolveTiles(value, locale);

  return (
    <CollectionTilesView
      tiles={texts.map((text, index) => ({
        eyebrow: text.eyebrow,
        title: text.title,
        href: value.tiles[index].href,
        photoUrl: tilePhotoUrl(value, index),
      }))}
      shopNowLabel={t("collection_shop_now")}
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
