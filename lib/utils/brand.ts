import type { BrandLabel } from "@/types/shop";

export const BRAND_LABEL_SELECT = {
  slug: true,
  nameEn: true,
  nameAr: true,
  nameRu: true,
  isVisible: true,
  deletedAt: true,
} as const;

interface BrandRef {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  isVisible: boolean;
  deletedAt: Date | null;
}

export function toBrandLabel(ref: BrandRef | null | undefined): BrandLabel | null {
  if (!ref || ref.deletedAt !== null || !ref.isVisible) return null;
  return {
    slug: ref.slug,
    nameEn: ref.nameEn,
    nameAr: ref.nameAr,
    nameRu: ref.nameRu,
  };
}

export function brandName(brand: BrandLabel | null, locale: string): string {
  if (!brand) return "";
  if (locale === "ar") return brand.nameAr || brand.nameEn;
  if (locale === "ru") return brand.nameRu || brand.nameEn;
  return brand.nameEn;
}
