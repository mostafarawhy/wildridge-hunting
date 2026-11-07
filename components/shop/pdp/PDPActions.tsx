"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AddOnSelector from "@/components/shop/AddOnSelector";
import QuantitySelector from "@/components/ui/QuantitySelector";
import Button from "@/components/ui/Button";
import { useCartStore } from "@/lib/stores/cart-store";
import { addToCartAction } from "@/lib/actions/cart";
import { formatAED, multiplyMoney, selectionTotal } from "@/lib/utils/currency";

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

  const chosenAddons = addons.filter((a) => selectedAddonIds.includes(a.id));
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
    for (const a of chosenAddons) {
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

  const total = selectionTotal(
    basePrice,
    chosenAddons.map((a) => a.price),
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
        data-pdp-buybar
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
              className={`truncate ${isBusinessMode ? "text-body-sm" : "text-xs"}`}
              style={{
                color: isBusinessMode
                  ? "var(--primitive-black)"
                  : "var(--color-content-tertiary)",
                fontWeight: isBusinessMode ? "var(--font-medium)" : undefined,
              }}
            >
              {productName}
            </span>
            {!isBusinessMode && (
              <div className="flex items-baseline gap-2">
                <span
                  dir="ltr"
                  className="text-body tabular-nums"
                  style={{
                    color: "var(--primitive-black)",
                    fontWeight: "var(--font-bold)",
                  }}
                >
                  {formatAED(total)}
                </span>
                {(qty > 1 || chosenAddons.length > 0) && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    {[
                      qty > 1 ? `${t("qty_label")} ${qty}` : null,
                      chosenAddons.length > 0
                        ? t("addons_count", { count: chosenAddons.length })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
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
        {inStock && (
          <>
            <div className="flex items-baseline justify-between gap-3 lg:hidden">
              <span
                className="text-eyebrow tracking-widest uppercase"
                style={{ color: "var(--color-content-tertiary)" }}
              >
                {t("total_label")}
              </span>
              <span
                dir="ltr"
                aria-live="polite"
                className="text-body-lg tabular-nums"
                style={{
                  color: "var(--primitive-black)",
                  fontWeight: "var(--font-bold)",
                }}
              >
                {formatAED(total)}
              </span>
            </div>
            {(qty > 1 || chosenAddons.length > 0) && (
              <div className="flex flex-col gap-1 lg:hidden">
                {[
                  { key: "product", name: productName, price: basePrice },
                  ...chosenAddons.map((a) => ({
                    key: a.id,
                    name:
                      locale === "ar"
                        ? a.nameAr
                        : locale === "ru"
                          ? a.nameRu
                          : a.name,
                    price: a.price,
                  })),
                ].map((line) => (
                  <div
                    key={line.key}
                    className="flex justify-between gap-3 text-xs"
                    style={{ color: "var(--color-content-tertiary)" }}
                  >
                    <span className="min-w-0 truncate">
                      {t("breakdown_line", { qty, name: line.name })}
                    </span>
                    <span dir="ltr" className="tabular-nums shrink-0">
                      {formatAED(multiplyMoney(line.price, qty))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div ref={ctaRef} className="flex items-center gap-3">
          <div className="flex-1">
            <Button
              fullWidth
              size="lg"
              variant="primary"
              className="whitespace-nowrap"
              disabled={!inStock || isPending}
              loading={isPending}
              onClick={handleAddToCart}
            >
              {inStock ? (
                <>
                  {t("add_to_cart")}
                  <span
                    aria-hidden="true"
                    className="hidden lg:inline"
                    style={{ marginInline: "0.5em" }}
                  >
                    ·
                  </span>
                  <span dir="ltr" className="hidden lg:inline tabular-nums">
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
