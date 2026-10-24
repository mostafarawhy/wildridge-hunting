"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import ShopProductCard from "@/components/shop/ShopProductCard";
import QuickViewModal from "@/components/shop/QuickViewModal";
import { useWishlistStore } from "@/lib/stores/wishlist-store";
import type { ProductDetail, ProductListItem } from "@/types/shop";

interface WishlistManagerProps {
  items: ProductListItem[];
  locale: "en" | "ar" | "ru";
}

export default function WishlistManager({
  items,
  locale,
}: WishlistManagerProps) {
  const t = useTranslations("account.wishlist");
  const router = useRouter();
  const [localItems, setLocalItems] = useState<ProductListItem[]>(items);
  const skus = useWishlistStore((s) => s.skus);
  const prevSkusRef = useRef(skus);

  const [quickViewProduct, setQuickViewProduct] =
    useState<ProductListItem | null>(null);
  const [quickViewDetail, setQuickViewDetail] = useState<ProductDetail | null>(
    null,
  );
  const [quickViewError, setQuickViewError] = useState(false);
  const [loadingCardSku, setLoadingCardSku] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevSkusRef.current;
    prevSkusRef.current = skus;

    const removedSkus = [...prev].filter((sku) => !skus.has(sku));
    if (removedSkus.length > 0) {
      setLocalItems((curr) => curr.filter((item) => skus.has(item.sku)));
      router.refresh();
    }
  }, [skus, router]);

  async function handleQuickView(product: ProductListItem) {
    setLoadingCardSku(product.sku);
    try {
      const res = await fetch(
        `/api/products/${product.slugEn}?category=${encodeURIComponent(product.categorySlug)}`,
      );
      if (!res.ok) throw new Error();
      const data: ProductDetail = await res.json();
      setQuickViewDetail(data);
      setQuickViewError(false);
      setQuickViewProduct(product);
    } catch {
      setQuickViewDetail(null);
      setQuickViewError(true);
      setQuickViewProduct(product);
    } finally {
      setLoadingCardSku(null);
    }
  }

  function handleClose() {
    setQuickViewProduct(null);
    setQuickViewDetail(null);
    setQuickViewError(false);
  }

  if (localItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ color: "var(--color-content-tertiary)", opacity: 0.6 }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <p
          className="text-body"
          style={{ color: "var(--color-content-tertiary)" }}
        >
          {t("empty")}
        </p>
        <Link
          href="/shop"
          className="text-label tracking-widest uppercase transition-opacity hover:opacity-70"
          style={{
            color: "var(--color-action-primary-fg)",
            backgroundColor: "var(--color-action-primary)",
            padding: "0.625rem 1.5rem",
          }}
        >
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {localItems.map((item) => (
          <ShopProductCard
            key={item.sku}
            {...item}
            onQuickView={handleQuickView}
            isLoadingQuickView={loadingCardSku === item.sku}
          />
        ))}
      </div>
      <QuickViewModal
        key={quickViewProduct?.slugEn ?? "closed"}
        product={quickViewProduct}
        detail={quickViewDetail}
        error={quickViewError}
        onClose={handleClose}
        locale={locale}
      />
    </>
  );
}
