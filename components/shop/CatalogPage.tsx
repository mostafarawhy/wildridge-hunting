import { getTranslations } from "next-intl/server";
import { getSessionCustomerId } from "@/lib/auth-customer";
import { getProducts } from "@/lib/db/queries/products";
import { getCategoryBySlug } from "@/lib/db/queries/categories";
import FiltersSidebar from "@/components/shop/FiltersSidebar";
import SortSelect from "@/components/shop/SortSelect";
import PaginationBar from "@/components/shop/PaginationBar";
import CatalogClient from "./CatalogClient";
import { getIsBusinessMode } from "@/lib/utils/shop-mode";
import { brandName } from "@/lib/utils/brand";
import { parseCatalogParams } from "@/lib/utils/catalog-params";
import SearchInput from "@/components/shop/SearchInput";
import MobileFilterBar from "@/components/shop/MobileFilterBar";
import ShopHero from "@/components/shop/ShopHero";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { shopPhotoUrl } from "@/lib/settings/site-banners";

interface CatalogPageProps {
  locale: string;
  categorySlug?: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function CatalogPage({
  locale,
  categorySlug,
  searchParams,
}: CatalogPageProps) {
  const t = await getTranslations("shop");

  const isBusinessMode = await getIsBusinessMode(await getSessionCustomerId());

  const filterParams = parseCatalogParams(searchParams, categorySlug);

  const [result, category, siteBanners] = await Promise.all([
    getProducts(filterParams),
    categorySlug ? getCategoryBySlug(categorySlug) : Promise.resolve(null),
    getSiteBanners(),
  ]);

  const {
    products,
    totalCount,
    brands,
    actionTypes,
    idOptions,
    calibers,
    minPrice,
    maxPrice,
  } = result;

  const PRODUCTS_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / PRODUCTS_PER_PAGE));

  const GROUP_NAMES: Record<string, string> = {
    rifles: t("shop_all_rifles"),
    optics: t("shop_all_optics"),
    accessories: t("shop_all_accessories"),
  };

  const categoryName = filterParams.groups
    ? GROUP_NAMES[filterParams.groups]
    : category
      ? locale === "ar"
        ? category.nameAr
        : locale === "ru"
          ? (category.nameRu ?? category.nameEn)
          : category.nameEn
      : t("all_products");

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      <ShopHero
        imageSrc={shopPhotoUrl(siteBanners.value)}
        focus={siteBanners.value.focus.shopPhoto}
      >
        <h1
          className="text-heading-desktop font-bold tracking-widest uppercase text-center"
          style={{ color: "var(--color-content-primary)" }}
        >
          {categoryName}
        </h1>
        <div
          style={{
            width: "100px",
            height: "2px",
            backgroundColor: "var(--color-action-primary)",
          }}
        />
      </ShopHero>

      <MobileFilterBar
        brands={brands.map((b) => ({
          value: b.slug,
          label: brandName(b, locale),
        }))}
        actionTypes={actionTypes}
        idOptions={idOptions}
        calibers={calibers.map((c) => ({
          value: String(c.mm),
          label: c.label,
        }))}
        minPrice={minPrice}
        maxPrice={maxPrice}
        totalCount={totalCount}
      />

      <div id="catalog-anchor" style={{ scrollMarginTop: "60px" }} />

      <div className="flex">
        <div
          className="hidden lg:block w-64 flex-shrink-0"
          style={{
            backgroundColor: "var(--color-shop-bg)",
            borderInlineEnd: "1px solid var(--color-shop-divider)",
            minHeight: "100%",
          }}
        >
          <FiltersSidebar
            brands={brands.map((b) => ({
              value: b.slug,
              label: brandName(b, locale),
            }))}
            actionTypes={actionTypes}
            idOptions={idOptions}
            calibers={calibers.map((c) => ({
              value: String(c.mm),
              label: c.label,
            }))}
            minPrice={minPrice}
            maxPrice={maxPrice}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-4 px-6 py-3"
            style={{
              backgroundColor: "var(--primitive-white)",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <SearchInput
              initialValue={filterParams.search ?? ""}
              scopeCategory={categorySlug}
            />

            <p
              className="text-body-sm flex-shrink-0 ms-auto"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {t("results_count", { count: totalCount })}
            </p>

            <div className="hidden lg:block">
              <SortSelect />
            </div>
          </div>

          <CatalogClient
            products={products}
            locale={locale}
            isBusinessMode={isBusinessMode}
          />

          <div style={{ backgroundColor: "var(--color-shop-bg)" }}>
            <PaginationBar totalPages={totalPages} />
          </div>
        </div>
      </div>
    </div>
  );
}
