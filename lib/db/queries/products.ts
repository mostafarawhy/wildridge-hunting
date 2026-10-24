import "server-only";
import { db } from "@/lib/db/client";
import { toISOString } from "@/lib/utils/date";
import { LIVE_CATEGORY_WHERE } from "@/lib/utils/catalog-visibility";
import { BRAND_LABEL_SELECT, toBrandLabel } from "@/lib/utils/brand";
import { getSetting } from "@/lib/db/queries/settings";
import {
  effectiveLoyaltyRule,
  type LoyaltyEarnRuleValue,
} from "@/lib/utils/loyalty-points";
import type {
  Prisma,
  PublishStatus,
  ActionType,
  SerialTracking,
  StockMovementType,
} from "@/app/generated/prisma/client";
import type {
  ProductListItem,
  ProductDetail,
  ProductFilterParams,
  ProductsQueryResult,
  ProductImageItem,
  SearchSuggestions,
} from "@/types/shop";

const PRODUCTS_PER_PAGE = 20;

const BASE_WHERE = {
  publishStatus: "PUBLISHED" as const,
  deletedAt: null,
} as const;

export const STOREFRONT_WHERE = {
  ...BASE_WHERE,
  category: { is: LIVE_CATEGORY_WHERE },
};

const GROUP_SLUG_MAP = {
  rifles: ["air-rifles", "pcp-rifles", "co2-pistols"],
  optics: ["optics"],
  accessories: ["accessories"],
} as const;

export const ACTION_TYPE_URL_VALUES: Record<string, ActionType> = {
  Spring: "Spring",
  PCP: "PCP",
  CO2: "CO2",
  "Gas-Ram": "Gas_Ram",
  "Multi-Pump": "Multi_Pump",
};

export const POINTS_BOOST_SELECT = {
  loyaltyRule: true,
  loyaltyMultiplier: true,
  loyaltyPointsEarn: true,
  loyaltyRuleStartsAt: true,
  loyaltyRuleEndsAt: true,
} as const;

export function toPointsBoost(
  p: {
    loyaltyRule: LoyaltyEarnRuleValue;
    loyaltyMultiplier: { toNumber(): number } | null;
    loyaltyPointsEarn: number;
    loyaltyRuleStartsAt: Date | null;
    loyaltyRuleEndsAt: Date | null;
  },
  programEnabled: boolean,
  now: Date,
): number | null {
  if (!programEnabled) return null;
  const rule = effectiveLoyaltyRule(
    {
      rule: p.loyaltyRule,
      multiplier: p.loyaltyMultiplier?.toNumber() ?? null,
      fixedPoints: p.loyaltyPointsEarn,
      startsAt: p.loyaltyRuleStartsAt?.toISOString() ?? null,
      endsAt: p.loyaltyRuleEndsAt?.toISOString() ?? null,
    },
    now,
  );
  return rule.kind === "BOOSTED" ? rule.multiplier : null;
}

function mapImage(img: {
  storageKey: string | null;
  altTextEn: string | null;
  altTextAr: string | null;
  altTextRu: string | null;
}): ProductImageItem {
  return {
    storageKey: img.storageKey,
    altEn: img.altTextEn,
    altAr: img.altTextAr,
    altRu: img.altTextRu,
  };
}

function formatCaliber(mm: number): string {
  const map: Record<number, string> = {
    4.5: "4.5mm (.177)",
    5.5: "5.5mm (.22)",
    6.35: "6.35mm (.25)",
    8: "8mm",
    9: "9mm",
  };
  return map[mm] ?? `${mm}mm`;
}

async function resolveCategoryIds(slug: string): Promise<string[]> {
  const category = await db.category.findFirst({
    where: {
      slug,
      deletedAt: null,
      isVisible: true,
      OR: [
        { parentId: null },
        { parent: { is: { isVisible: true, deletedAt: null } } },
      ],
    },
    select: {
      id: true,
      children: {
        where: { deletedAt: null, isVisible: true },
        select: { id: true },
      },
    },
  });

  if (!category) return [];
  return [category.id, ...category.children.map((c) => c.id)];
}

async function resolveGroupIds(
  group: keyof typeof GROUP_SLUG_MAP,
): Promise<string[]> {
  const slugs = GROUP_SLUG_MAP[group];

  const categories = await db.category.findMany({
    where: {
      slug: { in: [...slugs] },
      deletedAt: null,
      isVisible: true,
    },
    select: {
      id: true,
      children: {
        where: { deletedAt: null, isVisible: true },
        select: { id: true },
      },
    },
  });

  const ids: string[] = [];
  for (const cat of categories) {
    ids.push(cat.id);
    ids.push(...cat.children.map((c) => c.id));
  }
  return ids;
}

export function buildSearchWhere(q: string): Prisma.ProductWhereInput {
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { nameEn: contains },
      { nameAr: contains },
      { nameRu: contains },
      {
        brandRef: {
          is: {
            deletedAt: null,
            isVisible: true,
            OR: [
              { nameEn: contains },
              { nameAr: contains },
              { nameRu: contains },
            ],
          },
        },
      },
      { sku: contains },
      { category: { nameEn: contains } },
      { category: { nameAr: contains } },
      { category: { nameRu: contains } },
    ],
  };
}

async function composeCatalogWhere(params: ProductFilterParams) {
  const {
    categorySlug,
    groups,
    brands: brandFilters,
    actionTypes,
    caliberMm,
    minPrice,
    maxPrice,
    inStockOnly,
    requiresId,
    noIdRequired,
    newArrivalsOnly,
    search,
  } = params;

  let categoryIds: string[] | null = null;

  if (groups) {
    categoryIds = await resolveGroupIds(groups);
  } else if (categorySlug) {
    categoryIds = await resolveCategoryIds(categorySlug);
  }

  const and: Prisma.ProductWhereInput[] = [];

  if (categoryIds !== null) {
    and.push({
      OR: [
        { categoryId: { in: categoryIds } },
        { categoryLinks: { some: { categoryId: { in: categoryIds } } } },
      ],
    });
  }

  const trimmedSearch = search?.trim() ?? "";
  if (trimmedSearch.length > 0) {
    and.push(buildSearchWhere(trimmedSearch));
  }

  let brandIds: string[] = [];
  if (brandFilters && brandFilters.length > 0) {
    const requested = await db.brand.findMany({
      where: { slug: { in: brandFilters }, deletedAt: null, isVisible: true },
      select: { id: true },
    });
    brandIds = requested.map((b) => b.id);
  }

  const actionTypeFilter = (actionTypes ?? []).flatMap((v) =>
    Object.prototype.hasOwnProperty.call(ACTION_TYPE_URL_VALUES, v)
      ? [ACTION_TYPE_URL_VALUES[v]]
      : [],
  );

  const buildWhere = (
    omit?: "brand" | "actionType" | "caliber" | "id",
  ): Prisma.ProductWhereInput => ({
    ...STOREFRONT_WHERE,

    ...(and.length > 0 ? { AND: and } : {}),

    ...(omit !== "actionType" && actionTypeFilter.length > 0
      ? { actionType: { in: actionTypeFilter } }
      : {}),

    ...(omit !== "caliber" && caliberMm && caliberMm.length > 0
      ? { caliberMm: { in: caliberMm } }
      : {}),

    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    ...(newArrivalsOnly ? { isNewArrival: true } : {}),

    ...(inStockOnly ? { stockQuantity: { gt: 0 } } : {}),

    ...(omit !== "id" && requiresId ? { requiresIdVerification: true } : {}),
    ...(omit !== "id" && noIdRequired ? { requiresIdVerification: false } : {}),

    ...(omit !== "brand" && brandIds.length > 0
      ? { brandId: { in: brandIds } }
      : {}),
  });

  return { buildWhere, brandIds, actionTypeFilter };
}

export async function buildCatalogWhere(
  params: ProductFilterParams,
): Promise<Prisma.ProductWhereInput> {
  const { buildWhere } = await composeCatalogWhere(params);
  return buildWhere();
}

export async function getProducts(
  params: ProductFilterParams = {},
): Promise<ProductsQueryResult> {
  const { caliberMm, sort = "featured", page = 1 } = params;

  const { buildWhere, brandIds, actionTypeFilter } =
    await composeCatalogWhere(params);

  const where = buildWhere();

  const orderBy = {
    newest: { createdAt: "desc" as const },
    price_asc: { price: "asc" as const },
    price_desc: { price: "desc" as const },
    featured: [
      { isFeatured: "desc" as const },
      { sortOrder: { sort: "asc" as const, nulls: "last" as const } },
      { createdAt: "desc" as const },
    ],
  }[sort];

  const [
    rawProducts,
    totalCount,
    loyaltyProgram,
    brandAgg,
    caliberAgg,
    priceAgg,
    actionTypeAgg,
    idAgg,
  ] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * PRODUCTS_PER_PAGE,
      take: PRODUCTS_PER_PAGE,
      select: {
        ...POINTS_BOOST_SELECT,
        id: true,
        sku: true,
        slugEn: true,
        nameEn: true,
        nameAr: true,
        nameRu: true,
        brandRef: { select: BRAND_LABEL_SELECT },
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        reservedQuantity: true,
        lowStockThreshold: true,
        requiresIdVerification: true,
        isNewArrival: true,
        category: {
          select: { slug: true },
        },
        images: {
          where: { displayOrder: 1 },
          take: 1,
          select: {
            storageKey: true,
            altTextEn: true,
            altTextAr: true,
            altTextRu: true,
          },
        },
      },
    }),
    db.product.count({ where }),
    getSetting("loyalty_program"),
    db.brand.findMany({
      where: {
        deletedAt: null,
        isVisible: true,
        OR: [
          { products: { some: buildWhere("brand") } },
          { id: { in: brandIds } },
        ],
      },
      orderBy: { nameEn: "asc" },
      select: { slug: true, nameEn: true, nameAr: true, nameRu: true },
    }),
    db.product.findMany({
      where: { ...buildWhere("caliber"), caliberMm: { not: null } },
      select: { caliberMm: true },
      distinct: ["caliberMm"],
      orderBy: { caliberMm: "asc" },
    }),
    db.product.aggregate({
      where: STOREFRONT_WHERE,
      _min: { price: true },
      _max: { price: true },
    }),
    db.product.groupBy({
      by: ["actionType"],
      where: buildWhere("actionType"),
    }),
    db.product.groupBy({
      by: ["requiresIdVerification"],
      where: buildWhere("id"),
    }),
  ]);

  const boostNow = new Date();

  const presentActionTypes = new Set<ActionType>(
    actionTypeAgg.map((r) => r.actionType),
  );
  const actionTypeOptions = Object.entries(ACTION_TYPE_URL_VALUES)
    .filter(
      ([, member]) =>
        presentActionTypes.has(member) || actionTypeFilter.includes(member),
    )
    .map(([urlValue]) => urlValue);

  const caliberValues = new Set<number>();
  for (const c of caliberAgg) {
    if (c.caliberMm !== null) caliberValues.add(c.caliberMm.toNumber());
  }
  for (const mm of caliberMm ?? []) caliberValues.add(mm);

  const products: ProductListItem[] = rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    slugEn: p.slugEn,
    categorySlug: p.category.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    nameRu: p.nameRu,
    brand: toBrandLabel(p.brandRef),
    price: p.price.toNumber(),
    compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
    primaryImage: p.images[0] ? mapImage(p.images[0]) : null,
    stockQuantity: p.stockQuantity,
    reservedQuantity: p.reservedQuantity,
    lowStockThreshold: p.lowStockThreshold,
    requiresIdVerification: p.requiresIdVerification,
    isNewArrival: p.isNewArrival,
    pointsBoost: toPointsBoost(p, loyaltyProgram.enabled, boostNow),
  }));

  return {
    products,
    totalCount,
    brands: brandAgg,
    actionTypes: actionTypeOptions,
    idOptions: {
      required: idAgg.some((r) => r.requiresIdVerification === true),
      none: idAgg.some((r) => r.requiresIdVerification === false),
    },
    calibers: [...caliberValues]
      .sort((x, y) => x - y)
      .map((mm) => ({ mm, label: formatCaliber(mm) })),
    minPrice: priceAgg._min.price?.toNumber() ?? 0,
    maxPrice: priceAgg._max.price?.toNumber() ?? 99999,
  };
}

export async function getSearchSuggestions(
  params: ProductFilterParams,
): Promise<SearchSuggestions> {
  const q = (params.search ?? "").trim().slice(0, 60);
  if (q.length < 2) {
    return {
      products: [],
      brands: [],
      categories: [],
      total: 0,
      businessMode: false,
    };
  }

  const where = await buildCatalogWhere({ ...params, search: q, page: 1 });
  const contains = { contains: q, mode: "insensitive" as const };
  const nameMatch = [
    { nameEn: contains },
    { nameAr: contains },
    { nameRu: contains },
  ];

  const [rawProducts, total, brands, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [
        { isFeatured: "desc" },
        { sortOrder: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 20,
      select: {
        slugEn: true,
        category: { select: { slug: true } },
        nameEn: true,
        nameAr: true,
        nameRu: true,
        brandRef: { select: BRAND_LABEL_SELECT },
        price: true,
        compareAtPrice: true,
        images: {
          where: { displayOrder: 1 },
          take: 1,
          select: {
            storageKey: true,
            altTextEn: true,
            altTextAr: true,
            altTextRu: true,
          },
        },
      },
    }),
    db.product.count({ where }),
    db.brand.findMany({
      where: {
        deletedAt: null,
        isVisible: true,
        OR: nameMatch,
        products: { some: STOREFRONT_WHERE },
      },
      orderBy: { nameEn: "asc" },
      take: 2,
      select: { slug: true, nameEn: true, nameAr: true, nameRu: true },
    }),
    db.category.findMany({
      where: { AND: [LIVE_CATEGORY_WHERE, { OR: nameMatch }] },
      orderBy: { displayOrder: "asc" },
      take: 2,
      select: { slug: true, nameEn: true, nameAr: true, nameRu: true },
    }),
  ]);

  const lowered = q.toLowerCase();
  const startsWithQuery = (p: (typeof rawProducts)[number]) =>
    [p.nameEn, p.nameAr, p.nameRu].some((n) =>
      n?.toLowerCase().startsWith(lowered),
    );
  const ranked = [
    ...rawProducts.filter(startsWithQuery),
    ...rawProducts.filter((p) => !startsWithQuery(p)),
  ].slice(0, 5);

  return {
    products: ranked.map((p) => ({
      slugEn: p.slugEn,
      categorySlug: p.category.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      nameRu: p.nameRu,
      brand: toBrandLabel(p.brandRef),
      price: p.price.toNumber(),
      compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
      primaryImage: p.images[0] ? mapImage(p.images[0]) : null,
    })),
    brands,
    categories: categories.map((c) => ({
      slug: c.slug,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      nameRu: c.nameRu,
    })),
    total,
    businessMode: false,
  };
}

// ─── Admin images ────────────────────────────────────────────────────────────

export interface AdminProductImageItem {
  id: string;
  storageKey: string | null;
  filename: string;
  displayOrder: number;
  altTextEn: string | null;
  altTextAr: string | null;
  altTextRu: string | null;
}

export async function getAdminProductImages(
  productSku: string,
): Promise<AdminProductImageItem[]> {
  return db.productImage.findMany({
    where: { productSku },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      storageKey: true,
      filename: true,
      displayOrder: true,
      altTextEn: true,
      altTextAr: true,
      altTextRu: true,
    },
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminProductListItemProjection {
  id: string;
  sku: string;
  nameEn: string;
  brand: string;
  slugEn: string;
  categoryNameEn: string;
  categorySlug: string;
  requiresIdVerification: boolean;
  serialTracking: SerialTracking;
  supportsAddons: boolean;
  accessoryCount: number;
  price: number;
  compareAtPrice: number | null;
  primaryImageKey: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  publishStatus: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

export type AdminProductSort =
  | "newest"
  | "updated"
  | "price_asc"
  | "price_desc"
  | "stock_asc"
  | "name";

export const VALID_ADMIN_SORTS: AdminProductSort[] = [
  "newest",
  "updated",
  "price_asc",
  "price_desc",
  "stock_asc",
  "name",
];

export const ADMIN_PRODUCTS_PER_PAGE = 25;

const SORT_MAP: Record<AdminProductSort, object> = {
  newest: { createdAt: "desc" as const },
  updated: { updatedAt: "desc" as const },
  price_asc: { price: "asc" as const },
  price_desc: { price: "desc" as const },
  stock_asc: { stockQuantity: "asc" as const },
  name: { nameEn: "asc" as const },
};

export type AdminProductStockFilter = "in" | "low" | "out";

export interface AdminProductFilters {
  search?: string;
  categoryIds?: string[];
  brand?: string;
  stock?: AdminProductStockFilter;
  minPrice?: number;
  maxPrice?: number;
  requiresId?: boolean;
  hasAccessories?: boolean;
  b2b?: boolean;
  isNew?: boolean;
  featured?: boolean;
  noImage?: boolean;
}

function buildAdminProductWhere(opts: AdminProductFilters) {
  const term = opts.search?.trim();
  const stockFilter =
    opts.stock === "out"
      ? { stockQuantity: 0 }
      : opts.stock === "low"
        ? {
            stockQuantity: {
              gt: 0,
              lte: db.product.fields.lowStockThreshold,
            },
          }
        : opts.stock === "in"
          ? { stockQuantity: { gt: db.product.fields.lowStockThreshold } }
          : {};
  const hasPrice = opts.minPrice !== undefined || opts.maxPrice !== undefined;

  return {
    deletedAt: null,
    ...(opts.categoryIds && opts.categoryIds.length > 0
      ? { categoryId: { in: opts.categoryIds } }
      : {}),
    ...(opts.brand ? { brandRef: { is: { slug: opts.brand } } } : {}),
    ...stockFilter,
    ...(hasPrice
      ? {
          price: {
            ...(opts.minPrice !== undefined ? { gte: opts.minPrice } : {}),
            ...(opts.maxPrice !== undefined ? { lte: opts.maxPrice } : {}),
          },
        }
      : {}),
    ...(opts.requiresId ? { requiresIdVerification: true } : {}),
    ...(opts.hasAccessories ? { accessoryLinks: { some: {} } } : {}),
    ...(opts.b2b ? { b2bAvailable: true } : {}),
    ...(opts.isNew ? { isNewArrival: true } : {}),
    ...(opts.featured ? { isFeatured: true } : {}),
    ...(opts.noImage ? { images: { none: {} } } : {}),
    ...(term
      ? {
          OR: [
            { nameEn: { contains: term, mode: "insensitive" as const } },
            { nameAr: { contains: term, mode: "insensitive" as const } },
            { nameRu: { contains: term, mode: "insensitive" as const } },
            { sku: { contains: term, mode: "insensitive" as const } },
            {
              brandRef: {
                is: {
                  OR: [
                    { nameEn: { contains: term, mode: "insensitive" as const } },
                    { nameAr: { contains: term, mode: "insensitive" as const } },
                    { nameRu: { contains: term, mode: "insensitive" as const } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function getAdminProductStatusCounts(
  filters: AdminProductFilters,
): Promise<Record<PublishStatus | "ALL", number>> {
  const groups = await db.product.groupBy({
    by: ["publishStatus"],
    where: buildAdminProductWhere(filters),
    _count: { _all: true },
  });

  const counts: Record<PublishStatus | "ALL", number> = {
    ALL: 0,
    PUBLISHED: 0,
    DRAFT: 0,
    ARCHIVED: 0,
  };
  for (const g of groups) {
    counts[g.publishStatus] = g._count._all;
    counts.ALL += g._count._all;
  }
  return counts;
}

export async function getAdminProducts(
  opts?: AdminProductFilters & {
    status?: PublishStatus;
    sort?: AdminProductSort;
    page?: number;
  },
): Promise<{ items: AdminProductListItemProjection[]; totalCount: number }> {
  const page = opts?.page ?? 1;

  const where = {
    ...buildAdminProductWhere(opts ?? {}),
    ...(opts?.status ? { publishStatus: opts.status } : {}),
  };

  const orderBy = SORT_MAP[opts?.sort ?? "newest"];

  const [rows, totalCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * ADMIN_PRODUCTS_PER_PAGE,
      take: ADMIN_PRODUCTS_PER_PAGE,
      select: {
        id: true,
        sku: true,
        nameEn: true,
        slugEn: true,
        brandRef: { select: { nameEn: true } },
        price: true,
        compareAtPrice: true,
        stockQuantity: true,
        lowStockThreshold: true,
        publishStatus: true,
        requiresIdVerification: true,
        serialTracking: true,
        supportsAddons: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { nameEn: true, slug: true } },
        _count: { select: { accessoryLinks: true } },
        images: {
          where: { displayOrder: 1 },
          take: 1,
          select: { storageKey: true },
        },
      },
    }),
    db.product.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      nameEn: row.nameEn,
      slugEn: row.slugEn,
      brand: row.brandRef?.nameEn ?? "",
      categoryNameEn: row.category.nameEn,
      categorySlug: row.category.slug,
      requiresIdVerification: row.requiresIdVerification,
      serialTracking: row.serialTracking,
      supportsAddons: row.supportsAddons,
      accessoryCount: row._count.accessoryLinks,
      price: Number(row.price),
      compareAtPrice: row.compareAtPrice != null ? Number(row.compareAtPrice) : null,
      primaryImageKey: row.images[0]?.storageKey ?? null,
      stockQuantity: row.stockQuantity,
      lowStockThreshold: row.lowStockThreshold,
      publishStatus: row.publishStatus,
      createdAt: toISOString(row.createdAt),
      updatedAt: toISOString(row.updatedAt),
    })),
    totalCount,
  };
}

// ─── Admin edit ──────────────────────────────────────────────────────────────

export interface AdminProductEditProjection {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  slugEn: string;
  brandId: string | null;
  actionType: ActionType;
  caliberMm: number | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  descriptionRu: string | null;
  categoryId: string;
  tags: string[];
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  weightGrams: number | null;
  requiresIdVerification: boolean;
  serialTracking: SerialTracking;
  supportsAddons: boolean;
  b2bAvailable: boolean;
  minOrderQty: number;
  maxOrderQty: number | null;
  isNewArrival: boolean;
  isFeatured: boolean;
  sortOrder: number | null;
  loyaltyPointsEarn: number;
  loyaltyRule: LoyaltyEarnRuleValue;
  loyaltyMultiplier: number | null;
  loyaltyRuleStartsAt: string | null;
  loyaltyRuleEndsAt: string | null;
  publishStatus: PublishStatus;
  metaTitleEn: string | null;
  metaTitleAr: string | null;
  metaTitleRu: string | null;
  metaDescriptionEn: string | null;
  metaDescriptionAr: string | null;
  metaDescriptionRu: string | null;
  internalNotes: string | null;
  extraCategoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getAdminProductForEdit(
  id: string,
): Promise<AdminProductEditProjection | null> {
  const row = await db.product.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      sku: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      slugEn: true,
      brandId: true,
      actionType: true,
      caliberMm: true,
      descriptionEn: true,
      descriptionAr: true,
      descriptionRu: true,
      categoryId: true,
      tags: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      weightGrams: true,
      requiresIdVerification: true,
      serialTracking: true,
      supportsAddons: true,
      b2bAvailable: true,
      minOrderQty: true,
      maxOrderQty: true,
      isNewArrival: true,
      isFeatured: true,
      sortOrder: true,
      loyaltyPointsEarn: true,
      loyaltyRule: true,
      loyaltyMultiplier: true,
      loyaltyRuleStartsAt: true,
      loyaltyRuleEndsAt: true,
      publishStatus: true,
      metaTitleEn: true,
      metaTitleAr: true,
      metaTitleRu: true,
      metaDescriptionEn: true,
      metaDescriptionAr: true,
      metaDescriptionRu: true,
      internalNotes: true,
      categoryLinks: { select: { categoryId: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    sku: row.sku,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameRu: row.nameRu,
    slugEn: row.slugEn,
    brandId: row.brandId,
    actionType: row.actionType,
    caliberMm: row.caliberMm != null ? Number(row.caliberMm) : null,
    descriptionEn: row.descriptionEn,
    descriptionAr: row.descriptionAr,
    descriptionRu: row.descriptionRu,
    categoryId: row.categoryId,
    tags: row.tags,
    price: Number(row.price),
    compareAtPrice:
      row.compareAtPrice != null ? Number(row.compareAtPrice) : null,
    stockQuantity: row.stockQuantity,
    reservedQuantity: row.reservedQuantity,
    lowStockThreshold: row.lowStockThreshold,
    weightGrams: row.weightGrams,
    requiresIdVerification: row.requiresIdVerification,
    serialTracking: row.serialTracking,
    supportsAddons: row.supportsAddons,
    b2bAvailable: row.b2bAvailable,
    minOrderQty: row.minOrderQty,
    maxOrderQty: row.maxOrderQty,
    isNewArrival: row.isNewArrival,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
    loyaltyPointsEarn: row.loyaltyPointsEarn,
    loyaltyRule: row.loyaltyRule,
    loyaltyMultiplier: row.loyaltyMultiplier?.toNumber() ?? null,
    loyaltyRuleStartsAt: row.loyaltyRuleStartsAt
      ? toISOString(row.loyaltyRuleStartsAt)
      : null,
    loyaltyRuleEndsAt: row.loyaltyRuleEndsAt
      ? toISOString(row.loyaltyRuleEndsAt)
      : null,
    publishStatus: row.publishStatus,
    metaTitleEn: row.metaTitleEn,
    metaTitleAr: row.metaTitleAr,
    metaTitleRu: row.metaTitleRu,
    metaDescriptionEn: row.metaDescriptionEn,
    metaDescriptionAr: row.metaDescriptionAr,
    metaDescriptionRu: row.metaDescriptionRu,
    internalNotes: row.internalNotes,
    extraCategoryIds: row.categoryLinks.map((l) => l.categoryId).sort(),
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
  };
}

// ─── Stock movements ─────────────────────────────────────────────────────────

export interface ProductStockMovementItem {
  id: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  type: StockMovementType;
  reason: string | null;
  reference: string | null;
  staffName: string | null;
  createdAt: string;
}

export async function getProductStockMovements(
  productSku: string,
  limit = 20,
): Promise<ProductStockMovementItem[]> {
  const rows = await db.stockMovement.findMany({
    where: { productSku },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      delta: true,
      quantityBefore: true,
      quantityAfter: true,
      type: true,
      reason: true,
      reference: true,
      createdAt: true,
      staff: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    delta: row.delta,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    type: row.type,
    reason: row.reason,
    reference: row.reference,
    staffName: row.staff?.name ?? null,
    createdAt: toISOString(row.createdAt),
  }));
}

export interface ProductAccessoryItem {
  linkId: string;
  productId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  categoryNameEn: string;
  price: number;
  stockQuantity: number;
  publishStatus: PublishStatus;
  storageKey: string | null;
  displayOrder: number;
}

export async function getProductAccessories(
  productSku: string,
): Promise<ProductAccessoryItem[]> {
  const rows = await db.productAccessory.findMany({
    where: { productSku },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      displayOrder: true,
      accessory: {
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          price: true,
          stockQuantity: true,
          publishStatus: true,
          category: { select: { nameEn: true } },
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    linkId: row.id,
    productId: row.accessory.id,
    sku: row.accessory.sku,
    nameEn: row.accessory.nameEn,
    nameAr: row.accessory.nameAr,
    categoryNameEn: row.accessory.category.nameEn,
    price: Number(row.accessory.price),
    stockQuantity: row.accessory.stockQuantity,
    publishStatus: row.accessory.publishStatus,
    storageKey: row.accessory.images[0]?.storageKey ?? null,
    displayOrder: row.displayOrder,
  }));
}

export interface LinkableAccessory {
  id: string;
  sku: string;
  nameEn: string;
  brand: string;
  categoryId: string;
  categoryNameEn: string;
  parentCategoryId: string | null;
  parentCategoryNameEn: string | null;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  publishStatus: PublishStatus;
  storageKey: string | null;
  linked: boolean;
}

export async function getLinkableAccessories(
  productSku: string,
): Promise<LinkableAccessory[]> {
  const rifleCategories = await db.category.findMany({
    where: {
      OR: [{ navGroup: "RIFLES" }, { parent: { is: { navGroup: "RIFLES" } } }],
    },
    select: { id: true },
  });
  const rifleCategoryIds = rifleCategories.map((c) => c.id);
  const rows = await db.product.findMany({
    where: {
      deletedAt: null,
      sku: { not: productSku },
      categoryId: { notIn: rifleCategoryIds },
    },
    orderBy: [{ category: { nameEn: "asc" } }, { nameEn: "asc" }],
    select: {
      id: true,
      sku: true,
      nameEn: true,
      brandRef: { select: { nameEn: true } },
      price: true,
      stockQuantity: true,
      lowStockThreshold: true,
      publishStatus: true,
      categoryId: true,
      category: {
        select: {
          nameEn: true,
          parent: { select: { id: true, nameEn: true } },
        },
      },
      images: {
        orderBy: { displayOrder: "asc" },
        take: 1,
        select: { storageKey: true },
      },
      accessoryOf: {
        where: { productSku },
        take: 1,
        select: { id: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    nameEn: row.nameEn,
    brand: row.brandRef?.nameEn ?? "",
    categoryId: row.categoryId,
    categoryNameEn: row.category.nameEn,
    parentCategoryId: row.category.parent?.id ?? null,
    parentCategoryNameEn: row.category.parent?.nameEn ?? null,
    price: Number(row.price),
    stockQuantity: row.stockQuantity,
    lowStockThreshold: row.lowStockThreshold,
    publishStatus: row.publishStatus,
    storageKey: row.images[0]?.storageKey ?? null,
    linked: row.accessoryOf.length > 0,
  }));
}

// ─── Storefront ──────────────────────────────────────────────────────────────

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const raw = await db.product.findFirst({
    where: { ...STOREFRONT_WHERE, slugEn: slug },
    select: {
      id: true,
      sku: true,
      slugEn: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      brandRef: { select: BRAND_LABEL_SELECT },
      descriptionEn: true,
      descriptionAr: true,
      descriptionRu: true,
      metaTitleEn: true,
      metaTitleAr: true,
      metaTitleRu: true,
      metaDescriptionEn: true,
      metaDescriptionAr: true,
      metaDescriptionRu: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      requiresIdVerification: true,
      isNewArrival: true,
      isFeatured: true,
      loyaltyRule: true,
      loyaltyMultiplier: true,
      loyaltyPointsEarn: true,
      loyaltyRuleStartsAt: true,
      loyaltyRuleEndsAt: true,
      category: {
        select: {
          slug: true,
          nameEn: true,
          nameAr: true,
          nameRu: true,
        },
      },
      images: {
        orderBy: { displayOrder: "asc" },
        select: {
          storageKey: true,
          altTextEn: true,
          altTextAr: true,
          altTextRu: true,
        },
      },
      specs: {
        orderBy: { displayOrder: "asc" },
        select: {
          labelEn: true,
          labelAr: true,
          labelRu: true,
          valueEn: true,
          valueAr: true,
          valueRu: true,
          displayOrder: true,
        },
      },
      accessoryLinks: {
        where: {
          accessory: {
            is: {
              publishStatus: "PUBLISHED",
              deletedAt: null,
              category: { is: LIVE_CATEGORY_WHERE },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
        select: {
          displayOrder: true,
          accessory: {
            select: {
              sku: true,
              slugEn: true,
              brandRef: { select: BRAND_LABEL_SELECT },
              nameEn: true,
              nameAr: true,
              nameRu: true,
              descriptionEn: true,
              descriptionAr: true,
              descriptionRu: true,
              price: true,
              compareAtPrice: true,
              stockQuantity: true,
              lowStockThreshold: true,
              category: { select: { slug: true } },
              images: { orderBy: { displayOrder: "asc" }, take: 1, select: { storageKey: true } },
            },
          },
        },
      },
    },
  });

  if (!raw) return null;

  return {
    id: raw.id,
    sku: raw.sku,
    slugEn: raw.slugEn,
    categorySlug: raw.category.slug,
    categoryNameEn: raw.category.nameEn,
    categoryNameAr: raw.category.nameAr,
    categoryNameRu: raw.category.nameRu,
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    nameRu: raw.nameRu,
    brand: toBrandLabel(raw.brandRef),
    descriptionEn: raw.descriptionEn,
    descriptionAr: raw.descriptionAr,
    descriptionRu: raw.descriptionRu,
    metaTitleEn: raw.metaTitleEn,
    metaTitleAr: raw.metaTitleAr,
    metaTitleRu: raw.metaTitleRu,
    metaDescriptionEn: raw.metaDescriptionEn,
    metaDescriptionAr: raw.metaDescriptionAr,
    metaDescriptionRu: raw.metaDescriptionRu,
    price: raw.price.toNumber(),
    compareAtPrice: raw.compareAtPrice?.toNumber() ?? null,
    images: raw.images.map(mapImage),
    specs: raw.specs.map((s) => ({
      labelEn: s.labelEn,
      labelAr: s.labelAr,
      labelRu: s.labelRu,
      valueEn: s.valueEn,
      valueAr: s.valueAr,
      valueRu: s.valueRu,
      displayOrder: s.displayOrder,
    })),
    addons: raw.accessoryLinks.map((link) => ({
      sku: link.accessory.sku,
      slugEn: link.accessory.slugEn,
      categorySlug: link.accessory.category.slug,
      brand: toBrandLabel(link.accessory.brandRef),
      nameEn: link.accessory.nameEn,
      nameAr: link.accessory.nameAr,
      nameRu: link.accessory.nameRu,
      descriptionEn: link.accessory.descriptionEn,
      descriptionAr: link.accessory.descriptionAr,
      descriptionRu: link.accessory.descriptionRu,
      price: link.accessory.price.toNumber(),
      compareAtPrice: link.accessory.compareAtPrice?.toNumber() ?? null,
      stockQuantity: link.accessory.stockQuantity,
      lowStockThreshold: link.accessory.lowStockThreshold,
      storageKey: link.accessory.images[0]?.storageKey ?? null,
      displayOrder: link.displayOrder,
    })),
    stockQuantity: raw.stockQuantity,
    reservedQuantity: raw.reservedQuantity,
    lowStockThreshold: raw.lowStockThreshold,
    requiresIdVerification: raw.requiresIdVerification,
    isNewArrival: raw.isNewArrival,
    isFeatured: raw.isFeatured,
    loyalty: {
      rule: raw.loyaltyRule,
      multiplier: raw.loyaltyMultiplier?.toNumber() ?? null,
      fixedPoints: raw.loyaltyPointsEarn,
      startsAt: raw.loyaltyRuleStartsAt?.toISOString() ?? null,
      endsAt: raw.loyaltyRuleEndsAt?.toISOString() ?? null,
    },
  };
}

export async function getMoreInCategory(
  categorySlug: string,
  excludeSku: string,
): Promise<ProductListItem[]> {
  const [rawProducts, loyaltyProgram] = await Promise.all([
    db.product.findMany({
    where: {
      AND: [
        STOREFRONT_WHERE,
        { category: { is: { slug: categorySlug } } },
        { sku: { not: excludeSku } },
      ],
    },
    orderBy: [
      { isFeatured: "desc" as const },
      { sortOrder: { sort: "asc" as const, nulls: "last" as const } },
      { createdAt: "desc" as const },
    ],
    take: 4,
    select: {
      ...POINTS_BOOST_SELECT,
      id: true,
      sku: true,
      slugEn: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      brandRef: { select: BRAND_LABEL_SELECT },
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      requiresIdVerification: true,
      isNewArrival: true,
      category: {
        select: { slug: true },
      },
      images: {
        where: { displayOrder: 1 },
        take: 1,
        select: {
          storageKey: true,
          altTextEn: true,
          altTextAr: true,
          altTextRu: true,
        },
      },
    },
    }),
    getSetting("loyalty_program"),
  ]);

  const boostNow = new Date();

  return rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    slugEn: p.slugEn,
    categorySlug: p.category.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    nameRu: p.nameRu,
    brand: toBrandLabel(p.brandRef),
    price: p.price.toNumber(),
    compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
    primaryImage: p.images[0] ? mapImage(p.images[0]) : null,
    stockQuantity: p.stockQuantity,
    reservedQuantity: p.reservedQuantity,
    lowStockThreshold: p.lowStockThreshold,
    requiresIdVerification: p.requiresIdVerification,
    isNewArrival: p.isNewArrival,
    pointsBoost: toPointsBoost(p, loyaltyProgram.enabled, boostNow),
  }));
}
