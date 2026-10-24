import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { getFeaturedCollection } from "@/lib/db/queries/collections";
import { getIsBusinessMode } from "@/lib/utils/shop-mode";
import {
  FEATURED_COLLECTION_KEY,
  resolveFeaturedHeading,
} from "@/lib/utils/featured-collection";
import FeaturedSectionView from "./FeaturedSectionView";

interface FeaturedProductsProps {
  locale: string;
}

export default async function FeaturedProducts({
  locale,
}: FeaturedProductsProps) {
  const t = await getTranslations("home");
  const isBusinessMode = await getIsBusinessMode(await getSessionCustomerId());
  const collection = await getFeaturedCollection(FEATURED_COLLECTION_KEY);

  if (!collection || collection.items.length === 0) return null;

  return (
    <FeaturedSectionView
      eyebrow={t("featured_eyebrow")}
      heading={resolveFeaturedHeading(collection, locale)}
      seeAllLabel={t("see_all")}
      items={collection.items}
      locale={locale}
      isBusinessMode={isBusinessMode}
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
