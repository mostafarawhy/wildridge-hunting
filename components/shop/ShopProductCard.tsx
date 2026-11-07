"use client";

import FadeImage from "@/components/ui/FadeImage";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAED } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import type { ProductListItem } from "@/types/shop";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { brandName } from "@/lib/utils/brand";
import { StarOutlineIcon } from "@/components/ui/icons";
import { formatMultiplier } from "@/lib/utils/loyalty-points";

export type { ProductListItem as ShopProductCardProps };

interface ShopProductCardFullProps extends ProductListItem {
  onQuickView?: (product: ProductListItem) => Promise<void> | void;
  isLoadingQuickView?: boolean;
  isBusinessMode?: boolean;
}

export default function ShopProductCard(props: ShopProductCardFullProps) {
  const {
    sku,
    slugEn,
    categorySlug,
    nameEn,
    nameAr,
    nameRu,
    brand,
    price,
    compareAtPrice,
    primaryImage,
    stockQuantity,
    lowStockThreshold,
    requiresIdVerification,
    isNewArrival,
    pointsBoost,
    onQuickView,
    isLoadingQuickView = false,
    isBusinessMode = false,
  } = props;

  const t = useTranslations("shop");
  const locale = useLocale();
  const displayName =
    locale === "ar" ? nameAr : locale === "ru" ? (nameRu ?? nameEn) : nameEn;
  const brandLabel = brandName(brand, locale);
  const imageAlt =
    (locale === "ar"
      ? primaryImage?.altAr
      : locale === "ru"
        ? primaryImage?.altRu
        : primaryImage?.altEn) ?? displayName;
  const pdpHref = `/shop/${categorySlug}/${slugEn}`;
  const availableStock = stockQuantity;
  const inStock = availableStock > 0;
  const isLowStock = inStock && availableStock <= lowStockThreshold;
  const imageUrl = getImageUrl(primaryImage?.storageKey);

  const showBadge =
    !inStock || isLowStock || (isNewArrival && inStock && !isLowStock);

  const badgeLabel = !inStock
    ? t("badge_out_of_stock")
    : isLowStock
      ? t("badge_low_stock")
      : t("badge_new");

  const badgeColor = !inStock
    ? "var(--color-content-tertiary)"
    : isLowStock
      ? "var(--color-status-warning)"
      : "var(--color-accent-text)";

  return (
    <article
      className="group relative flex flex-col"
      style={{
        backgroundColor: "var(--primitive-white)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        className="relative w-full aspect-square sm:aspect-[3/2]"
        style={{
          backgroundColor: "var(--primitive-white)",
        }}
      >
        <Link
          href={pdpHref}
          aria-label={displayName}
          className="block w-full h-full"
        >
          <FadeImage
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-contain p-4"
          />
        </Link>

        {(showBadge || (pointsBoost && !isBusinessMode)) && (
          <div
            className="absolute top-3 flex flex-wrap items-center gap-1.5"
            style={{
              insetInlineStart: "0.75rem",
              insetInlineEnd: requiresIdVerification ? "3.25rem" : "0.75rem",
              backgroundColor: "transparent",
              backdropFilter: "blur(4px)",
            }}
          >
            {showBadge && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: badgeColor,
                }}
              >
                {badgeLabel}
              </span>
            )}
            {pointsBoost && !isBusinessMode && (
              <span
                className="text-eyebrow uppercase tracking-widest inline-flex items-center gap-1"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-accent) 16%, #ffffff)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 40%, #ffffff)",
                  color: "var(--color-accent-dark)",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <StarOutlineIcon size={10} />
                {t("badge_points_boost", {
                  multiplier: formatMultiplier(pointsBoost),
                })}
              </span>
            )}
          </div>
        )}

        {requiresIdVerification && (
          <div
            title={t("requires_id")}
            className="absolute top-3 flex items-center justify-center"
            style={{
              insetInlineEnd: "0.75rem",
              width: "30px",
              height: "30px",
              backgroundColor: "var(--primitive-white)",
              borderRadius: "50%",
              boxShadow:
                "0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px color-mix(in srgb, var(--color-action-primary) 18%, transparent)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-action-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 10h2" />
              <path d="M16 14h2" />
              <path d="M6.17 15a3 3 0 0 1 5.66 0" />
              <circle cx="9" cy="11" r="2" />
              <rect x="2" y="5" width="20" height="14" rx="2" />
            </svg>
          </div>
        )}

        <div
          className="absolute z-10 flex items-center justify-center"
          style={{
            bottom: "8px",
            insetInlineEnd: "8px",
            width: "38px",
            height: "38px",
            backgroundColor: "var(--primitive-white)",
            border: "1px solid var(--color-shop-divider)",
            borderRadius: "50%",
          }}
        >
          <WishlistButton sku={sku} size={18} />
        </div>

        {inStock && onQuickView && (
          <button
            type="button"
            aria-label={t("quick_add")}
            onClick={() => onQuickView(props)}
            disabled={isLoadingQuickView}
            className="card-touch-action absolute z-10 items-center justify-center cursor-pointer active:opacity-80 disabled:opacity-70"
            style={{
              bottom: "8px",
              insetInlineStart: "8px",
              width: "38px",
              height: "38px",
              backgroundColor: "var(--color-action-primary)",
              color: "var(--primitive-white)",
              borderRadius: "50%",
              border: "none",
            }}
          >
            {isLoadingQuickView ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-spin"
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                <path d="M12 6v5M9.5 8.5h5" />
              </svg>
            )}
          </button>
        )}

        <div
          className="card-hover-overlay absolute inset-0 flex items-center justify-center gap-3
             opacity-0 group-hover:opacity-100 transition-opacity duration-200
             pointer-events-none group-hover:pointer-events-auto"
          style={{
            backgroundColor: isLoadingQuickView
              ? "rgba(255,255,255,0.75)"
              : "rgba(255,255,255,0.55)",
            opacity: isLoadingQuickView ? 1 : undefined,
          }}
        >
          {inStock && (
            <button
              type="button"
              title={t("quick_add")}
              onClick={() => onQuickView?.(props)}
              disabled={isLoadingQuickView}
              className="flex items-center justify-center transition-transform duration-150 cursor-pointer hover:scale-110 disabled:opacity-70"
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "var(--primitive-white)",
                borderRadius: "50%",
                boxShadow: "var(--shadow-md)",
                border: "none",
              }}
            >
              {isLoadingQuickView ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-action-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="animate-spin"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-action-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              )}
            </button>
          )}

          <Link
            href={pdpHref}
            title={t("view_product")}
            className="flex items-center justify-center transition-transform duration-150 hover:scale-110"
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: "var(--primitive-white)",
              borderRadius: "50%",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-action-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 15 6 6" />
              <path d="m15 9 6-6" />
              <path d="M21 16v5h-5" />
              <path d="M21 8V3h-5" />
              <path d="M3 16v5h5" />
              <path d="m3 21 6-6" />
              <path d="M3 8V3h5" />
              <path d="M9 9 3 3" />
            </svg>
          </Link>
        </div>
      </div>

      <Link href={pdpHref} className="flex flex-col gap-1 px-3 pt-3 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
        <p
          className="text-body leading-snug line-clamp-2"
          style={{
            color: "var(--primitive-black)",
            fontWeight: "var(--font-medium)",
          }}
        >
          {displayName}
        </p>

        {brandLabel && (
          <p
            className="text-body-sm"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {brandLabel}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1">
          {isBusinessMode ? (
            <span
              style={{
                color: "var(--color-accent-text)",
                fontWeight: "var(--font-medium)",
                fontSize: "var(--text-body)",
              }}
            >
              {t("contact_for_pricing")}
            </span>
          ) : (
            <>
              <span
                style={{
                  color: !inStock
                    ? "var(--color-content-tertiary)"
                    : compareAtPrice && compareAtPrice > price
                      ? "var(--color-action-primary)"
                      : "var(--primitive-black)",
                  fontWeight: "var(--font-medium)",
                  fontSize: "var(--text-body)",
                }}
              >
                {formatAED(price)}
              </span>
              {compareAtPrice && compareAtPrice > price && (
                <span
                  style={{
                    color: "var(--color-content-tertiary)",
                    fontSize: "var(--text-body-sm)",
                    textDecoration: "line-through",
                  }}
                >
                  {formatAED(compareAtPrice)}
                </span>
              )}
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
