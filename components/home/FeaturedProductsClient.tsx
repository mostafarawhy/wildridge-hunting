"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import QuickViewModal from "@/components/shop/QuickViewModal";
import ShopProductCard from "@/components/shop/ShopProductCard";
import type {
  FeaturedProductItem,
  ProductDetail,
  ProductListItem,
} from "@/types/shop";

const VISIBLE = 4;

function toListItem(item: FeaturedProductItem): ProductListItem {
  return {
    id: item.sku,
    sku: item.sku,
    slugEn: item.slugEn,
    categorySlug: item.categorySlug,
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    nameRu: item.nameRu,
    brand: item.brand,
    price: item.price,
    compareAtPrice: item.compareAtPrice,
    primaryImage: item.primaryImage,
    stockQuantity: item.stockQuantity,
    reservedQuantity: item.reservedQuantity,
    lowStockThreshold: item.lowStockThreshold,
    requiresIdVerification: item.requiresIdVerification,
    isNewArrival: item.isNewArrival,
    pointsBoost: item.pointsBoost ?? null,
  };
}

interface FeaturedProductsClientProps {
  items: FeaturedProductItem[];
  locale: string;
  isBusinessMode?: boolean;
}

export default function FeaturedProductsClient({
  items,
  locale,
  isBusinessMode = false,
}: FeaturedProductsClientProps) {
  const tShop = useTranslations("shop");
  const trackRef = useRef<HTMLDivElement>(null);

  const [quickViewProduct, setQuickViewProduct] =
    useState<ProductListItem | null>(null);
  const [quickViewDetail, setQuickViewDetail] = useState<ProductDetail | null>(
    null,
  );
  const [quickViewError, setQuickViewError] = useState(false);
  const [loadingCardSku, setLoadingCardSku] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const hasSlider = items.length > VISIBLE;
  const maxIndex = Math.max(0, items.length - VISIBLE);

  function scrollTo(index: number) {
    const clamped = Math.max(0, Math.min(index, maxIndex));
    setActiveIndex(clamped);
    if (trackRef.current) {
      const cardWidth = trackRef.current.scrollWidth / items.length;
      trackRef.current.style.transform = `translateX(${
        document.dir === "rtl" ? "" : "-"
      }${clamped * cardWidth}px)`;
    }
  }

  async function handleQuickView(item: ProductListItem) {
    setLoadingCardSku(item.sku);
    try {
      const res = await fetch(
        `/api/products/${item.slugEn}?category=${encodeURIComponent(item.categorySlug)}`,
      );
      if (!res.ok) throw new Error();
      const data: ProductDetail = await res.json();
      setQuickViewDetail(data);
      setQuickViewError(false);
      setQuickViewProduct(item);
    } catch {
      setQuickViewDetail(null);
      setQuickViewError(true);
      setQuickViewProduct(item);
    } finally {
      setLoadingCardSku(null);
    }
  }

  function handleClose() {
    setQuickViewProduct(null);
    setQuickViewDetail(null);
    setQuickViewError(false);
  }

  return (
    <>
      <div className="relative overflow-hidden">
        <div
          ref={trackRef}
          className="flex gap-6 lg:gap-8 transition-transform duration-500 ease-out"
          style={{ willChange: "transform" }}
        >
          {items.map((item) => (
            <div
              key={item.sku}
              className="flex flex-col flex-shrink-0"
              style={{
                width: `calc((100% - ${(VISIBLE - 1) * 32}px) / ${VISIBLE})`,
              }}
            >
              <ShopProductCard
                {...toListItem(item)}
                onQuickView={handleQuickView}
                isLoadingQuickView={loadingCardSku === item.sku}
                isBusinessMode={isBusinessMode}
              />
            </div>
          ))}
        </div>

        {hasSlider && (
          <div className="flex items-center justify-center gap-4 mt-10 ">
            <button
              type="button"
              onClick={() => scrollTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="w-10 h-10 flex items-center justify-center transition-opacity disabled:opacity-30 flip-rtl cursor-pointer"
              style={{
                border: "1px solid var(--color-content-inverse)",
                borderRadius: "50%",
                color: "var(--color-content-inverse)",
                backgroundColor: "transparent",
              }}
              aria-label={tShop("pagination_prev")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3L5 8L10 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="flex gap-2">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  className="transition-all duration-200"
                  style={{
                    width: activeIndex === i ? "24px" : "8px",
                    height: "8px",
                    borderRadius: "4px",
                    backgroundColor:
                      activeIndex === i
                        ? "var(--color-accent)"
                        : "var(--primitive-light-gray)",
                    border: "none",
                  }}
                  aria-label={`${i + 1} / ${maxIndex + 1}`}
                  aria-current={activeIndex === i ? "true" : undefined}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollTo(activeIndex + 1)}
              disabled={activeIndex === maxIndex}
              className="w-10 h-10 flex items-center justify-center transition-opacity disabled:opacity-30 flip-rtl cursor-pointer"
              style={{
                border: "1px solid var(--color-content-inverse)",
                borderRadius: "50%",
                color: "var(--color-content-inverse)",
                backgroundColor: "transparent",
              }}
              aria-label={tShop("pagination_next")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3L11 8L6 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      <QuickViewModal
        key={quickViewProduct?.sku ?? "closed"}
        product={quickViewProduct}
        detail={quickViewDetail}
        error={quickViewError}
        onClose={handleClose}
        locale={locale}
        isBusinessMode={isBusinessMode}
      />
    </>
  );
}
