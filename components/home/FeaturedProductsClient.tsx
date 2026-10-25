"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [scrollIndex, setScrollIndex] = useState(0);
  const [visible, setVisible] = useState(VISIBLE);
  const frameRef = useRef(0);

  const hasSlider = items.length > visible;
  const maxIndex = Math.max(0, items.length - visible);
  const activeIndex = Math.min(scrollIndex, maxIndex);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.children.length < 2) return;
    const first = track.children[0] as HTMLElement;
    const second = track.children[1] as HTMLElement;
    const step = Math.abs(second.offsetLeft - first.offsetLeft);
    if (step === 0) return;
    const count = Math.max(1, Math.round(track.clientWidth / step));
    setVisible(count);
    const index = Math.round(Math.abs(track.scrollLeft) / step);
    setScrollIndex(Math.max(0, Math.min(index, track.children.length - 1)));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [measure]);

  function handleScroll() {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(measure);
  }

  function scrollTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, maxIndex));
    const first = track.children[0] as HTMLElement | undefined;
    const target = track.children[clamped] as HTMLElement | undefined;
    if (!first || !target) return;
    track.scrollTo({ left: target.offsetLeft - first.offsetLeft });
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
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex gap-6 lg:gap-8 overflow-x-auto [scroll-snap-type:x_mandatory] [overscroll-behavior-x:contain] scroll-smooth motion-reduce:scroll-auto -mx-6 px-6 scroll-px-6 lg:mx-0 lg:px-0 lg:scroll-px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <div
              key={item.sku}
              className="flex flex-col flex-shrink-0 [scroll-snap-align:start] w-[62%] sm:w-[40%] lg:w-[calc((100%-96px)/4)]"
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
          <div className="flex items-center justify-center gap-4 mt-6 lg:mt-10">
            <button
              type="button"
              onClick={() => scrollTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="hidden lg:flex w-10 h-10 items-center justify-center transition-opacity disabled:opacity-30 flip-rtl cursor-pointer"
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

            <div className="flex">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  className="flex items-center justify-center"
                  style={{
                    width: "24px",
                    height: "24px",
                    padding: 0,
                    backgroundColor: "transparent",
                    border: "none",
                  }}
                  aria-label={`${i + 1} / ${maxIndex + 1}`}
                  aria-current={activeIndex === i ? "true" : undefined}
                >
                  <span
                    className="transition-all duration-200"
                    style={{
                      display: "block",
                      width: activeIndex === i ? "24px" : "8px",
                      height: "8px",
                      borderRadius: "4px",
                      backgroundColor:
                        activeIndex === i
                          ? "var(--color-accent)"
                          : "var(--primitive-light-gray)",
                    }}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollTo(activeIndex + 1)}
              disabled={activeIndex === maxIndex}
              className="hidden lg:flex w-10 h-10 items-center justify-center transition-opacity disabled:opacity-30 flip-rtl cursor-pointer"
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
