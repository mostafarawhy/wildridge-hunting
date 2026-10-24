import type { ProductFilterParams } from "@/types/shop";

export function parseCatalogParams(
  raw: Record<string, string | string[] | undefined>,
  categorySlug?: string,
): ProductFilterParams {
  const requiresId = raw.requiresId === "true";
  const noIdRequired = raw.noIdRequired === "true";
  const newArrivalsOnly = raw.newArrivals === "true";

  const brandsRaw = raw.brand;
  const brands = brandsRaw
    ? Array.isArray(brandsRaw)
      ? brandsRaw
      : [brandsRaw]
    : undefined;

  const actionTypeRaw = raw.actionType;
  const actionTypes = actionTypeRaw
    ? Array.isArray(actionTypeRaw)
      ? actionTypeRaw
      : [actionTypeRaw]
    : undefined;

  const caliberRaw = raw.caliber;
  const caliberMm = caliberRaw
    ? (Array.isArray(caliberRaw) ? caliberRaw : [caliberRaw])
        .map(Number)
        .filter((n) => !isNaN(n))
    : undefined;

  const minPrice = raw.minPrice ? Number(raw.minPrice) : undefined;
  const maxPrice = raw.maxPrice ? Number(raw.maxPrice) : undefined;
  const inStockOnly = raw.inStock === "true";
  const search = typeof raw.search === "string" ? raw.search : undefined;
  const page = raw.page ? Math.max(1, Number(raw.page)) : 1;

  const sortRaw = raw.sort;
  const validSorts = ["newest", "price_asc", "price_desc", "featured"] as const;
  type SortValue = (typeof validSorts)[number];
  const sort = validSorts.includes(sortRaw as SortValue)
    ? (sortRaw as SortValue)
    : "featured";

  const groupsRaw = raw.groups;
  const validGroups = ["rifles", "optics", "accessories"] as const;
  type GroupValue = (typeof validGroups)[number];
  const groups = validGroups.includes(groupsRaw as GroupValue)
    ? (groupsRaw as GroupValue)
    : undefined;

  return {
    requiresId,
    noIdRequired,
    newArrivalsOnly,
    categorySlug,
    groups,
    brands,
    actionTypes,
    caliberMm,
    minPrice,
    maxPrice,
    inStockOnly,
    search,
    sort,
    page,
  };
}
