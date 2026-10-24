import { Suspense } from "react";
import CatalogPage from "@/components/shop/CatalogPage";
import CatalogSkeleton from "@/components/loading/CatalogSkeleton";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { shopPhotoUrl } from "@/lib/settings/site-banners";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedParams = await searchParams;
  const { value } = await getSiteBanners();
  return (
    <Suspense fallback={<CatalogSkeleton
          heroSrc={shopPhotoUrl(value)}
          heroFocus={value.focus.shopPhoto}
        />}>
      <CatalogPage locale={locale} searchParams={resolvedParams} />
    </Suspense>
  );
}
