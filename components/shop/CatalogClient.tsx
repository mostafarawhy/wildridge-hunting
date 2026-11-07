"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductGrid from "@/components/shop/ProductGrid";
import type { ProductDetail, ProductListItem } from "@/types/shop";
import QuickViewModal from "./QuickViewModal";

interface CatalogClientProps {
  products: ProductListItem[];
  locale: string;
  isBusinessMode?: boolean;
}

const MODAL_PARAMS = ["auth", "callbackUrl", "cart"];

export default function CatalogClient({
  products,
  locale,
  isBusinessMode = false,
}: CatalogClientProps) {
  const searchParams = useSearchParams();
  const prevSearchParams = useRef<string | null>(null);

  const [quickViewProduct, setQuickViewProduct] =
    useState<ProductListItem | null>(null);
  const [quickViewDetail, setQuickViewDetail] = useState<ProductDetail | null>(
    null,
  );
  const [quickViewError, setQuickViewError] = useState(false);
  const [loadingCardSku, setLoadingCardSku] = useState<string | null>(null);

  useEffect(() => {
    const strip = (qs: string) => {
      const p = new URLSearchParams(qs);
      MODAL_PARAMS.forEach((k) => p.delete(k));
      return p.toString();
    };

    const current = strip(searchParams.toString());

    if (prevSearchParams.current === null) {
      prevSearchParams.current = current;
      return;
    }

    if (prevSearchParams.current !== current) {
      prevSearchParams.current = current;
      const anchor = document.getElementById("catalog-anchor");
      if (anchor) {
        const top = anchor.getBoundingClientRect().top + window.scrollY - 75;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
  }, [searchParams]);

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

  return (
    <>
      <ProductGrid
        products={products}
        onQuickView={handleQuickView}
        loadingCardSku={loadingCardSku}
        isBusinessMode={isBusinessMode}
      />
      <QuickViewModal
        key={quickViewProduct?.slugEn ?? "closed"}
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
