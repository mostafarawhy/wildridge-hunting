"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AddOnSelector from "@/components/shop/AddOnSelector";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Button from "@/components/ui/Button";
import { useCartStore } from "@/lib/stores/cart-store";
import { addToCartAction } from "@/lib/actions/cart";
import { formatAED, sumMoney, multiplyMoney } from "@/lib/utils/currency";

import type { AddOn } from "@/components/shop/AddOnSelector";
import WishlistButton from "@/components/wishlist/WishlistButton";
import { useQuoteStore } from "@/lib/stores/quote-store";

const B2B_NUDGE_THRESHOLD = 15;

interface PDPActionsProps {
  productSku: string;
  addons: AddOn[];
  locale: string;
  basePrice: number;
  inStock: boolean;
  availableStock: number;
  isBusinessMode?: boolean;
  productSlugEn?: string;
  productCategorySlug?: string;
  productNameEn?: string;
  productNameAr?: string;
  productNameRu?: string | null;
  productBrand?: string;
  productPrimaryImageKey?: string | null;
}

export default function PDPActions({
  productSku,
  addons,
  locale,
  basePrice,
  inStock,
  availableStock,
  isBusinessMode = false,
  productSlugEn = "",
  productCategorySlug = "",
  productNameEn = "",
  productNameAr = "",
  productNameRu = null,
  productBrand = "",
  productPrimaryImageKey = null,
}: PDPActionsProps) {
  const t = useTranslations("shop");
  const tCart = useTranslations("cart");
  const [qty, setQty] = useState(1);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [showBar, setShowBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const setCart = useCartStore((s) => s.setCart);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const addQuoteLine = useQuoteStore((s) => s.addLine);
  const openQuoteDrawer = useQuoteStore((s) => s.openDrawer);

  const showB2BNudge = qty >= B2B_NUDGE_THRESHOLD;

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isBusinessMode]);

  async function handleAddToCart() {
    setCartError(null);
    setIsPending(true);
    try {
      const result = await addToCartAction({
        productSku,
        quantity: qty,
        accessorySkus: selectedAddonIds,
        locale: locale as "en" | "ar" | "ru",
      });
      if (result.success) {
        setCart(result.data);
        openDrawer();
      } else {
        setCartError(tCart(`errors.${result.errorCode}`));
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleAddToQuote() {
    const chosen = addons.filter((a) => selectedAddonIds.includes(a.id));
    addQuoteLine({
      productSku,
      slugEn: productSlugEn,
      categorySlug: productCategorySlug,
      nameEn: productNameEn,
      nameAr: productNameAr,
      nameRu: productNameRu,
      brand: productBrand,
      primaryImageKey: productPrimaryImageKey,
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
    openQuoteDrawer();
  }

  const total = multiplyMoney(
    sumMoney([
      basePrice,
      sumMoney(
        addons.filter((a) => selectedAddonIds.includes(a.id)).map((a) => a.price),
      ),
    ]),
    qty,
  );

  const productName =
    locale === "ar"
      ? productNameAr
      : locale === "ru"
        ? (productNameRu ?? productNameEn)
        : productNameEn;

  const bar =
    showBar && (isBusinessMode || inStock) ? (
      <div
        className="fixed bottom-0 inset-x-0 lg:hidden"
        style={{
          backgroundColor: "var(--color-auth-input-bg)",
          borderTop: "1px solid var(--color-shop-divider)",
          padding: "0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))",
          zIndex: "var(--z-sticky)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col flex-1 min-w-0">
            <span
              className="text-body-sm truncate"
              style={{
                color: "var(--primitive-black)",
                fontWeight: "var(--font-medium)",
              }}
            >
              {productName}
            </span>
            {!isBusinessMode && (
              <span
                dir="ltr"
                className="text-xs tabular-nums"
                style={{
                  color: "var(--color-content-tertiary)",
                  alignSelf: "flex-start",
                }}
              >
                {formatAED(total)}
              </span>
            )}
          </div>
          {isBusinessMode ? (
            <Button variant="primary" size="md" onClick={handleAddToQuote}>
              {t("add_to_quote")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              loading={isPending}
              onClick={handleAddToCart}
            >
              {t("add_to_cart")}
            </Button>
          )}
        </div>
      </div>
    ) : null;

  if (isBusinessMode) {
    return (
      <div className="flex flex-col gap-6">
        {bar}
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
        {addons.length > 0 && (
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
              hidePrices
            />
          </>
        )}
        <div
          style={{
            height: "1px",
            backgroundColor: "var(--color-shop-divider)",
          }}
        />
        <div ref={ctaRef} className="flex items-center gap-3">
          <div className="flex-1">
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={handleAddToQuote}
            >
              {t("add_to_quote")}
            </Button>
          </div>
          <WishlistButton sku={productSku} size={22} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {bar}
      {inStock && (
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
            max={availableStock}
          />
        </div>
      )}

      {showB2BNudge && (
        <div
          className="flex items-start gap-2 px-3 py-2"
          style={{
            borderRadius: 0,
            border: "1px solid var(--color-auth-form-border)",
            borderInlineStart: "3px solid var(--color-gold)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="flex-shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" />
            <line x1="8" y1="5" x2="8" y2="8.5" />
            <circle
              cx="8"
              cy="11"
              r="0.6"
              fill="var(--color-gold)"
              stroke="none"
            />
          </svg>
          <p
            className="text-body-sm"
            style={{ color: "var(--primitive-black)" }}
          >
            {t("b2b_nudge_prefix")}{" "}
            <Link
              href="/b2b"
              className="underline transition-opacity hover:opacity-70"
              style={{ color: "var(--color-action-primary)" }}
            >
              {t("b2b_nudge_link")}
            </Link>
            {t("b2b_nudge_suffix")}
          </p>
        </div>
      )}

      {addons.length > 0 && (
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
            enforceQuantity
          />
        </>
      )}

      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-shop-divider)",
        }}
      />

      {cartError && (
        <p className="text-body-sm" style={{ color: "var(--color-error)" }}>
          {cartError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div ref={ctaRef} className="flex items-center gap-3">
          <div className="flex-1">
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
          <WishlistButton sku={productSku} size={22} />
        </div>
      </div>
    </div>
  );
}
