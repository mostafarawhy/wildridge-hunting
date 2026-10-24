import { Suspense } from "react";
import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import CatalogPage from "@/components/shop/CatalogPage";
import CatalogSkeleton from "@/components/loading/CatalogSkeleton";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { shopPhotoUrl } from "@/lib/settings/site-banners";

interface Props {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const found = await getCategoryBySlug(category);
  if (!found) return {};

  const title =
    locale === "ar"
      ? found.nameAr
      : locale === "ru"
        ? (found.nameRu ?? found.nameEn)
        : found.nameEn;

  return { title };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params;
  const resolvedSearch = await searchParams;
  const { value } = await getSiteBanners();

  return (
    <Suspense fallback={<CatalogSkeleton
          heroSrc={shopPhotoUrl(value)}
          heroFocus={value.focus.shopPhoto}
        />}>
      <CatalogPage
        locale={locale}
        categorySlug={category}
        searchParams={resolvedSearch}
      />
    </Suspense>
  );
}
