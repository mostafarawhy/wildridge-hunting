"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getImageUrl } from "@/lib/utils/images";
import PDPGallery from "@/components/shop/PDPGallery";
import AddOnSelector from "@/components/shop/AddOnSelector";
import IdRequiredNotice from "@/components/shop/pdp/IdRequiredNotice";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Button from "@/components/ui/Button";
import KeySpecs from "@/components/shop/pdp/KeySpecs";
import ProductBadges from "@/components/shop/pdp/ProductBadges";
import LoyaltyEarnLine from "@/components/shop/pdp/LoyaltyEarnLine";
import {
  computeOrderPointsWithRules,
  effectiveLoyaltyRule,
} from "@/lib/utils/loyalty-points";
import ProductDescription from "@/components/shop/pdp/ProductDescription";
import SpecsTable from "@/components/shop/pdp/SpecsTable";
import { formatAED, sumMoney, multiplyMoney } from "@/lib/utils/currency";
import { useCartStore } from "@/lib/stores/cart-store";
import { addToCartAction } from "@/lib/actions/cart";

import type { ProductListItem, ProductDetail } from "@/types/shop";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { useQuoteStore } from "@/lib/stores/quote-store";
import { brandName } from "@/lib/utils/brand";

interface QuickViewModalProps {
  product: ProductListItem | null;
  detail: ProductDetail | null;
  error: boolean;
  onClose: () => void;
  locale: string;
  isBusinessMode?: boolean;
}

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getWide() {
  return window.matchMedia(WIDE_QUERY).matches;
}

function getWideServer() {
  return false;
}

export default function QuickViewModal({
  product,
  detail,
  error,
  onClose,
  locale,
  isBusinessMode = false,
}: QuickViewModalProps) {
  const t = useTranslations("shop");
  const tCart = useTranslations("cart");
  const overlayRef = useRef<HTMLDivElement>(null);
  const [qty, setQty] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [openedAt] = useState(() => new Date());
  const [cartError, setCartError] = useState<string | null>(null);
  const isWide = useSyncExternalStore(subscribeWide, getWide, getWideServer);

  const setCart = useCartStore((s) => s.setCart);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const addQuoteLine = useQuoteStore((s) => s.addLine);
  const openQuoteDrawer = useQuoteStore((s) => s.openDrawer);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!product) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [product, onClose]);

  if (!product || !mounted) return null;

  const availableStock = product.stockQuantity;
  const inStock = availableStock > 0;
  const isLowStock = inStock && availableStock <= product.lowStockThreshold;
  const onSale =
    product.compareAtPrice !== null &&
    product.compareAtPrice !== undefined &&
    product.compareAtPrice > product.price;

  const loyaltyRule = detail ? effectiveLoyaltyRule(detail.loyalty, openedAt) : null;
  const unitPoints =
    detail && loyaltyRule && !isBusinessMode && detail.loyaltyEarnRate != null
      ? computeOrderPointsWithRules({
          lines: [{ lineTotal: product.price.toFixed(2), quantity: 1, rule: loyaltyRule }],
          discountTotal: "0.00",
          earnRate: detail.loyaltyEarnRate,
        })
      : 0;
  const pointsBoost =
    loyaltyRule?.kind === "BOOSTED" && unitPoints > 0 ? loyaltyRule.multiplier : null;

  const productName =
    locale === "ar"
      ? product.nameAr
      : locale === "ru"
        ? (product.nameRu ?? product.nameEn)
        : product.nameEn;

  const galleryImages =
    detail && detail.images.length > 0
      ? detail.images.map((img) => ({
          src: getImageUrl(img.storageKey),
          alt:
            locale === "ar"
              ? (img.altAr ?? productName)
              : locale === "ru"
                ? (img.altRu ?? productName)
                : (img.altEn ?? productName),
        }))
      : [
          {
            src: getImageUrl(product.primaryImage?.storageKey),
            alt: productName,
          },
        ];

  const description = detail
    ? locale === "ar"
      ? detail.descriptionAr
        ? { text: detail.descriptionAr, fallback: false }
        : detail.descriptionEn
          ? { text: detail.descriptionEn, fallback: true }
          : null
      : locale === "ru"
        ? detail.descriptionRu
          ? { text: detail.descriptionRu, fallback: false }
          : detail.descriptionEn
            ? { text: detail.descriptionEn, fallback: true }
            : null
        : detail.descriptionEn
          ? { text: detail.descriptionEn, fallback: false }
          : null
    : null;

  const addons = detail
    ? detail.addons.map((a) => ({
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
      }))
    : [];

  const addonsBlock =
    addons.length > 0 ? (
      <>
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--color-shop-divider)",
          }}
        />
        <AddOnSelector
          addons={addons}
          locale={locale}
          qty={qty}
          onSelectionChange={setSelectedAddonIds}
          hidePrices={isBusinessMode}
          enforceQuantity={!isBusinessMode}
          compact
        />
      </>
    ) : null;

  const total = multiplyMoney(
    sumMoney([
      product.price,
      sumMoney(
        addons.filter((a) => selectedAddonIds.includes(a.id)).map((a) => a.price),
      ),
    ]),
    qty,
  );

  async function handleAddToCart() {
    if (!product) return;
    setCartError(null);
    setIsPending(true);
    try {
      const result = await addToCartAction({
        productSku: product.sku,
        quantity: qty,
        accessorySkus: selectedAddonIds,
        locale: locale as "en" | "ar" | "ru",
      });
      if (result.success) {
        setCart(result.data);
        onClose();
        openDrawer();
      } else {
        setCartError(tCart(`errors.${result.errorCode}`));
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleAddToQuote() {
    if (!product) return;
    const chosen = addons.filter((a) => selectedAddonIds.includes(a.id));
    addQuoteLine({
      productSku: product.sku,
      slugEn: product.slugEn,
      categorySlug: product.categorySlug,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      nameRu: product.nameRu ?? null,
      brand: brandName(product.brand, locale),
      primaryImageKey: product.primaryImage?.storageKey ?? null,
      quantity: qty,
      selectedAddons: [],
    });
    for (const a of chosen) {
      addQuoteLine({
        productSku: a.id,
        slugEn: a.slugEn,
        categorySlug: a.categorySlug,
        nameEn: a.name,
        nameAr: a.nameAr,
        nameRu: a.nameRu ?? null,
        brand: a.brand,
        primaryImageKey: a.storageKey,
        quantity: qty,
        selectedAddons: [],
      });
    }
    onClose();
    openQuoteDrawer();
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: "var(--z-modal)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col lg:flex-row overflow-hidden"
        style={{
          backgroundColor: "var(--primitive-white)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "90vh",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-4 flex items-center justify-center cursor-pointer z-10 transition-colors"
          style={{
            insetInlineEnd: "1rem",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "var(--color-shop-divider)",
            color: "var(--primitive-black)",
            border: "none",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--color-action-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor =
              "var(--color-shop-divider)")
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M3 3L13 13M13 3L3 13" />
          </svg>
        </button>

        <div
          className="lg:w-[45%] flex-shrink-0 flex flex-col gap-3 p-6 lg:max-h-[90vh] lg:overflow-y-auto"
          style={{
            backgroundColor: "var(--color-shop-bg)",
            borderInlineEnd: "1px solid var(--color-shop-divider)",
          }}
        >
          <PDPGallery
            images={galleryImages}
            productName={productName}
            variant="modal"
          />
          {isWide && addonsBlock}
        </div>

        <div
          className="flex-1 flex flex-col min-h-0"
          style={{ maxHeight: "90vh" }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 p-7">
          {error && (
            <p style={{ color: "var(--color-error)" }}>
              {t("quickview_error")}
            </p>
          )}

          {detail && (
            <>
              <div
                className="flex items-baseline justify-between gap-3"
                style={{ paddingInlineEnd: "2.5rem" }}
              >
                {brandName(product.brand, locale) && (
                  <span
                    className="text-eyebrow tracking-widest uppercase"
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    {brandName(product.brand, locale)}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <h2
                  className="text-heading leading-snug"
                  style={{
                    color: "var(--primitive-black)",
                    fontWeight: "var(--font-bold)",
                  }}
                >
                  {productName}
                </h2>
                <WishlistButton sku={product.sku} size={20} />
              </div>

              <ProductBadges
                isNew={product.isNewArrival}
                onSale={onSale}
                pointsBoost={pointsBoost}
              />

              <div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  {isBusinessMode ? (
                    <span
                      style={{
                        color: "var(--color-accent)",
                        fontWeight: "var(--font-semibold)",
                        fontSize: "var(--text-display-sm)",
                      }}
                    >
                      {t("contact_for_pricing")}
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          color: "var(--primitive-black)",
                          fontWeight: "var(--font-semibold)",
                          fontSize: "var(--text-display-sm)",
                        }}
                      >
                        {formatAED(product.price)}
                      </span>
                      {product.compareAtPrice &&
                        product.compareAtPrice > product.price && (
                          <span
                            style={{
                              color: "var(--color-content-tertiary)",
                              fontSize: "var(--text-body-lg)",
                              textDecoration: "line-through",
                            }}
                          >
                            {formatAED(product.compareAtPrice)}
                          </span>
                        )}
                    </>
                  )}
                </div>
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
                    loyaltyRule?.kind === "BOOSTED" ? detail.loyalty.endsAt : null
                  }
                />
              )}

              <KeySpecs specs={detail.specs} locale={locale} compact />

              {product.requiresIdVerification && (
                <IdRequiredNotice variant="compact" />
              )}

              {description && (
                <ProductDescription
                  heading={t("description_heading")}
                  text={description.text}
                  fallbackLang={description.fallback ? "en" : undefined}
                />
              )}

              {detail.specs.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p
                    className="text-eyebrow tracking-widest uppercase"
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    {t("specs_label")}
                  </p>
                  <SpecsTable specs={detail.specs} locale={locale} />
                </div>
              )}

              {!isWide && addonsBlock}
            </>
          )}
          </div>

          {detail && (
            <div
              className="flex-shrink-0 flex flex-col gap-3 px-7 py-4"
              style={{
                borderTop: "1px solid var(--color-shop-divider)",
                backgroundColor: "var(--primitive-white)",
              }}
            >
                {isBusinessMode ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <span
                        className="text-eyebrow tracking-widest uppercase"
                        style={{ color: "var(--color-content-tertiary)" }}
                      >
                        {t("qty_label")}
                      </span>
                      <QuantitySelector
                        value={qty}
                        onChange={setQty}
                        min={1}
                        mode="input"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        fullWidth
                        size="lg"
                        variant="primary"
                        onClick={handleAddToQuote}
                      >
                        {t("add_to_quote")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {inStock && (
                      <div className="flex items-center gap-4">
                        <QuantitySelector
                          value={qty}
                          onChange={setQty}
                          min={1}
                          max={availableStock}
                        />
                      </div>
                    )}

                    {cartError && (
                      <p
                        className="text-body-sm"
                        style={{ color: "var(--color-error)" }}
                      >
                        {cartError}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <Button
                        fullWidth
                        size="lg"
                        variant="primary"
                        disabled={!inStock || isPending}
                        loading={isPending}
                        onClick={handleAddToCart}
                      >
                        {inStock ? (
                          <>
                            {t("add_to_cart")}
                            <span aria-hidden="true" style={{ marginInline: "0.5em" }}>·</span>
                            <span dir="ltr" className="tabular-nums">
                              {formatAED(total)}
                            </span>
                          </>
                        ) : (
                          t("out_of_stock")
                        )}
                      </Button>
                    </div>
                  </>
                )}
                <Link
                  href={`/shop/${product.categorySlug}/${product.slugEn}`}
                  onClick={onClose}
                  className="self-center text-body-sm underline"
                  style={{ color: "var(--primitive-black)" }}
                >
                  {t("view_details")}
                </Link>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
