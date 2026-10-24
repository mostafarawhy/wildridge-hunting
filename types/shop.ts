import type { ProductLoyaltyRule } from "@/lib/utils/loyalty-points";

/**
 * Projection types for the shop data layer.
 * These are NOT raw Prisma types — they are shaped for the UI.
 * Query functions in lib/db/queries/ map DB results to these types.
 */

export interface ProductImageItem {
  storageKey: string | null;
  altEn: string | null;
  altAr: string | null;
  altRu: string | null;
}

export interface CategoryWithChildren {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  navGroup: "RIFLES" | "OPTICS" | "ACCESSORIES" | "AMMO" | null;
  children: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string;
    nameRu: string | null;
  }[];
}

export type BrandLabel = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
};

export interface ProductListItem {
  id: string;
  sku: string;
  slugEn: string;
  categorySlug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: BrandLabel | null;
  price: number;
  compareAtPrice: number | null;
  primaryImage: ProductImageItem | null;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  requiresIdVerification: boolean;
  isNewArrival: boolean;
  pointsBoost?: number | null;
}

export interface SpecRow {
  labelEn: string;
  labelAr: string;
  labelRu: string | null;
  valueEn: string;
  valueAr: string;
  valueRu: string | null;
  displayOrder: number;
}

export interface ProductAddon {
  sku: string;
  slugEn: string;
  categorySlug: string;
  brand: BrandLabel | null;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  storageKey: string | null;
  displayOrder: number;
}

export interface ProductDetail {
  id: string;
  sku: string;
  slugEn: string;
  categorySlug: string;
  categoryNameEn: string;
  categoryNameAr: string;
  categoryNameRu: string | null;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: BrandLabel | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  metaTitleEn: string | null;
  metaTitleAr: string | null;
  metaTitleRu: string | null;
  metaDescriptionEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionRu: string | null;
  price: number;
  compareAtPrice: number | null;
  images: ProductImageItem[];
  specs: SpecRow[];
  addons: ProductAddon[];
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  requiresIdVerification: boolean;
  isNewArrival: boolean;
  isFeatured: boolean;
  loyalty: ProductLoyaltyRule;
  loyaltyEarnRate?: number | null;
}

export interface ProductsQueryResult {
  products: ProductListItem[];
  totalCount: number;
  brands: BrandLabel[];
  actionTypes: string[];
  idOptions: { required: boolean; none: boolean };
  calibers: CaliberOption[];
  minPrice: number;
  maxPrice: number;
}

export interface CaliberOption {
  mm: number;
  label: string; // examble. ".308 WIN", "6.5 Creedmoor"
}

export interface ProductFilterParams {
  categorySlug?: string;
  groups?: "rifles" | "optics" | "accessories";
  brands?: string[];
  actionTypes?: string[];
  caliberMm?: number[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  requiresId?: boolean;
  noIdRequired?: boolean;
  newArrivalsOnly?: boolean;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "featured";
  page?: number;
}

export interface FeaturedProductItem {
  sku: string;
  slugEn: string;
  categorySlug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: BrandLabel | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string;
  primaryImage: ProductImageItem | null;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  requiresIdVerification: boolean;
  isNewArrival: boolean;
  pointsBoost?: number | null;
}

export interface FeaturedCollectionResult {
  key: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  items: FeaturedProductItem[];
}

export interface SearchSuggestionProduct {
  slugEn: string;
  categorySlug: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: BrandLabel | null;
  price: number | null;
  compareAtPrice: number | null;
  primaryImage: ProductImageItem | null;
}

export interface SearchSuggestionTaxon {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
}

export interface SearchSuggestions {
  products: SearchSuggestionProduct[];
  brands: SearchSuggestionTaxon[];
  categories: SearchSuggestionTaxon[];
  total: number;
  businessMode: boolean;
}
