import { cache } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { getSessionCustomerId } from "@/lib/auth-customer";
import {
  getMoreInCategory,
  getProductBySlug,
} from "@/lib/db/queries/products";
import { getFreeShippingOffer } from "@/lib/db/queries/shipping";
import { getSetting } from "@/lib/db/queries/settings";
import {
  computeOrderPointsWithRules,
  effectiveLoyaltyRule,
} from "@/lib/utils/loyalty-points";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import { getIsBusinessMode } from "@/lib/utils/shop-mode";
import { brandName } from "@/lib/utils/brand";
import PDPGallery from "@/components/shop/PDPGallery";
import BackButton from "@/components/shop/BackButton";

import {
  ProductBadges,
  ProductPrice,
  TrustSignals,
} from "@/components/shop/pdp";
import ProductDetails from "@/components/shop/pdp/ProductDetails";
import IdRequiredNotice from "@/components/shop/pdp/IdRequiredNotice";
import LoyaltyEarnLine from "@/components/shop/pdp/LoyaltyEarnLine";
import KeySpecs from "@/components/shop/pdp/KeySpecs";
import PDPActions from "@/components/shop/pdp/PDPActions";
import MoreInCategory from "@/components/shop/pdp/MoreInCategory";

interface Props {
  params: Promise<{ locale: string; category: string; slug: string }>;
}

const loadProduct = cache(getProductBySlug);

const META_DESCRIPTION_MAX = 155;

function toMetaDescription(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= META_DESCRIPTION_MAX) return collapsed;
  const cut = collapsed.slice(0, META_DESCRIPTION_MAX);
  if (collapsed[META_DESCRIPTION_MAX] === " ") return cut.trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return {};

  const name =
    locale === "ar"
      ? product.nameAr
      : locale === "ru"
        ? (product.nameRu ?? product.nameEn)
        : product.nameEn;

  const metaTitle =
    locale === "ar"
      ? product.metaTitleAr
      : locale === "ru"
        ? product.metaTitleRu
        : product.metaTitleEn;

  const metaDescription =
    locale === "ar"
      ? product.metaDescriptionAr
      : locale === "ru"
        ? product.metaDescriptionRu
        : product.metaDescriptionEn;

  const localizedDescription =
    locale === "ar"
      ? product.descriptionAr
      : locale === "ru"
        ? product.descriptionRu
        : product.descriptionEn;

  const descriptionSource =
    metaDescription || localizedDescription || product.descriptionEn;
  const description = descriptionSource
    ? toMetaDescription(descriptionSource)
    : "";

  const title = metaTitle || name;
  const imageKey = product.images[0]?.storageKey;

  return {
    title,
    ...(description ? { description } : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      ...(imageKey ? { images: [getImageUrl(imageKey)] } : {}),
    },
  };
}

const TRUST_SIGNALS = [
  {
    key: "trust_dealer",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    key: "trust_shipping",
    icon: "M2 7h12v9H2zM14 10h4l3 3v3h-7M6 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  },
  {
    key: "trust_authentic",
    icon: "M12 3l2.4 1.6 2.9-.2 1 2.7 2.4 1.7-.8 2.8.8 2.8-2.4 1.7-1 2.7-2.9-.2L12 21l-2.4-1.6-2.9.2-1-2.7-2.4-1.7.8-2.8-.8-2.8 2.4-1.7 1-2.7 2.9.2zM9 12l2 2 4-4",
  },
] as const;

export default async function ProductDetailPage({ params }: Props) {
  const { locale, category, slug } = await params;
  const t = await getTranslations("shop");

  const isBusinessMode = await getIsBusinessMode(await getSessionCustomerId());

  const product = await loadProduct(slug);
  if (!product) notFound();
  if (category !== product.categorySlug) {
    redirect({
      href: `/shop/${product.categorySlug}/${product.slugEn}`,
      locale: locale as "en" | "ar" | "ru",
    });
  }

  const [freeShipping, moreInCategory, loyaltyProgram] = await Promise.all([
    getFreeShippingOffer(),
    getMoreInCategory(product.categorySlug, product.sku),
    getSetting("loyalty_program"),
  ]);

  const loyaltyRule = effectiveLoyaltyRule(product.loyalty, new Date());
  const unitPoints =
    loyaltyProgram.enabled && !isBusinessMode
      ? computeOrderPointsWithRules({
          lines: [
            {
              lineTotal: product.price.toFixed(2),
              quantity: 1,
              rule: loyaltyRule,
            },
          ],
          discountTotal: "0.00",
          earnRate: loyaltyProgram.earnRate,
        })
      : 0;
  const pointsBoost =
    loyaltyRule.kind === "BOOSTED" && unitPoints > 0
      ? loyaltyRule.multiplier
      : null;
  const trustSignals = TRUST_SIGNALS.flatMap(
    (signal): { key: string; icon: string; label: string }[] => {
      if (signal.key === "trust_shipping") {
        return freeShipping
          ? [
              {
                key: signal.key,
                icon: signal.icon,
                label: t("trust_shipping", {
                  amount: formatAED(
                    freeShipping.thresholdAed,
                    locale as "en" | "ar" | "ru",
                  ),
                }),
              },
            ]
          : [];
      }
      return [{ key: signal.key, icon: signal.icon, label: t(signal.key) }];
    },
  );

  const availableStock = product.stockQuantity;
  const inStock = availableStock > 0;
  const isLowStock = inStock && availableStock <= product.lowStockThreshold;

  const categoryName =
    locale === "ar"
      ? product.categoryNameAr
      : locale === "ru"
        ? (product.categoryNameRu ?? product.categoryNameEn)
        : product.categoryNameEn;

  const productName =
    locale === "ar"
      ? product.nameAr
      : locale === "ru"
        ? (product.nameRu ?? product.nameEn)
        : product.nameEn;

  const galleryImages =
    product.images.length > 0
      ? product.images.map((img) => ({
          src: getImageUrl(img.storageKey),
          alt:
            locale === "ar"
              ? (img.altAr ?? productName)
              : locale === "ru"
                ? (img.altRu ?? productName)
                : (img.altEn ?? productName),
        }))
      : [{ src: getImageUrl(null), alt: productName }];

  const specs = product.specs.map((s) => ({
    labelEn: s.labelEn,
    labelAr: s.labelAr,
    labelRu: s.labelRu ?? s.labelEn,
    valueEn: s.valueEn,
    valueAr: s.valueAr,
    valueRu: s.valueRu ?? s.valueEn,
  }));

  const addons = product.addons.map((a) => ({
    id: a.sku,
    slugEn: a.slugEn,
    categorySlug: a.categorySlug,
    brand: brandName(a.brand, locale),
    name: a.nameEn,
    nameAr: a.nameAr,
    nameRu: a.nameRu ?? a.nameEn,
    descriptionEn: a.descriptionEn,
    descriptionAr: a.descriptionAr,
    descriptionRu: a.descriptionRu,
    price: a.price,
    compareAtPrice: a.compareAtPrice,
    stockQuantity: a.stockQuantity,
    lowStockThreshold: a.lowStockThreshold,
    storageKey: a.storageKey,
  }));

  const description =
    locale === "ar"
      ? product.descriptionAr
        ? { text: product.descriptionAr, fallback: false }
        : product.descriptionEn
          ? { text: product.descriptionEn, fallback: true }
          : null
      : locale === "ru"
        ? product.descriptionRu
          ? { text: product.descriptionRu, fallback: false }
          : product.descriptionEn
            ? { text: product.descriptionEn, fallback: true }
            : null
        : product.descriptionEn
          ? { text: product.descriptionEn, fallback: false }
          : null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-shop-bg)" }}
    >
      <div
        className="px-6 lg:px-10 py-3"
        style={{ borderBottom: "1px solid var(--color-shop-divider)" }}
      >
        <nav className="flex items-center gap-2 text-body-sm flex-wrap">
          <BackButton />
          <Link
            href="/shop"
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("all_products")}
          </Link>
          <span style={{ color: "var(--color-content-tertiary)" }}>/</span>
          <Link
            href={`/shop/${product.categorySlug}`}
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {categoryName}
          </Link>
          <span style={{ color: "var(--color-content-tertiary)" }}>/</span>
          <span style={{ color: "var(--primitive-black)" }}>{productName}</span>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div
          className="lg:w-[55%] flex-shrink-0"
          style={{
            backgroundColor: "var(--color-shop-bg)",
            borderInlineEnd: "1px solid var(--color-shop-divider)",
          }}
        >
          <div className="sticky top-0 pt-2">
            <PDPGallery images={galleryImages} productName={productName} />
          </div>
        </div>

        <div
          className="flex-1 flex flex-col gap-5 px-6 lg:px-10 py-8"
          style={{ backgroundColor: "var(--color-auth-input-bg)" }}
        >
          {brandName(product.brand, locale) && (
            <p
              className="text-eyebrow tracking-widest uppercase"
              style={{ color: "var(--color-content-tertiary)" }}
            >
              {brandName(product.brand, locale)}
            </p>
          )}

          <h1
            className="text-heading-desktop font-bold tracking-tight"
            style={{ color: "var(--primitive-black)" }}
          >
            {productName}
          </h1>

          <ProductBadges
            isNew={product.isNewArrival}
            onSale={
              product.compareAtPrice !== null &&
              product.compareAtPrice > product.price
            }
            pointsBoost={pointsBoost}
          />

          <div>
            {isBusinessMode ? (
              <p
                className="text-body-lg"
                style={{
                  color: "var(--color-accent)",
                  fontWeight: "var(--font-semibold)",
                }}
              >
                {t("contact_for_pricing")}
              </p>
            ) : (
              <ProductPrice
                price={product.price}
                compareAtPrice={product.compareAtPrice ?? undefined}
              />
            )}
            <div className="flex items-center justify-between gap-3 mt-1">
              {!isBusinessMode && (
                <span
                  className="text-body-sm"
                  style={{ color: "var(--color-content-tertiary)" }}
                >
                  {t("vat_included")}
                </span>
              )}
              <span
                className="text-body-sm flex items-center gap-2 ms-auto"
                style={{
                  color: !inStock
                    ? "var(--color-content-tertiary)"
                    : isLowStock
                      ? "var(--color-status-warning)"
                      : "var(--color-status-success-text)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    backgroundColor: "currentColor",
                  }}
                />
                {!inStock
                  ? t("stock_status.out_of_stock")
                  : isLowStock
                    ? t("stock_status.low_stock")
                    : t("stock_status.in_stock")}
              </span>
            </div>
          </div>

          {unitPoints > 0 && (
            <LoyaltyEarnLine
              points={unitPoints}
              locale={locale}
              boostMultiplier={pointsBoost}
              boostEndsAt={
                loyaltyRule.kind === "BOOSTED" ? product.loyalty.endsAt : null
              }
            />
          )}

          <KeySpecs specs={specs} locale={locale} />

          {product.requiresIdVerification && <IdRequiredNotice />}

          <div
            style={{
              height: "1px",
              backgroundColor: "var(--color-shop-divider)",
            }}
          />

          <PDPActions
            productSku={product.sku}
            addons={addons}
            locale={locale}
            basePrice={product.price}
            inStock={inStock}
            availableStock={availableStock}
            isBusinessMode={isBusinessMode}
            productSlugEn={product.slugEn}
            productCategorySlug={product.categorySlug}
            productNameEn={product.nameEn}
            productNameAr={product.nameAr}
            productNameRu={product.nameRu ?? null}
            productBrand={brandName(product.brand, locale)}
            productPrimaryImageKey={product.images[0]?.storageKey ?? null}
          />

          <TrustSignals signals={trustSignals} />

          <p
            className="text-body-sm"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("help_prompt")}{" "}
            <Link
              href="/contact"
              className="underline"
              style={{ color: "var(--primitive-black)" }}
            >
              {t("help_link")}
            </Link>
          </p>

          <ProductDetails
            description={description}
            specs={specs}
            locale={locale}
          />
        </div>
      </div>

      <MoreInCategory
        products={moreInCategory}
        categoryName={categoryName}
        isBusinessMode={isBusinessMode}
      />
    </div>
  );
}
