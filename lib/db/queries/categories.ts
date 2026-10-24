import "server-only";
import { db } from "@/lib/db/client";
import { isLiveCategory } from "@/lib/utils/catalog-visibility";
import type { PublishStatus } from "@/app/generated/prisma/client";
import type { CategoryWithChildren } from "@/types/shop";

/**
 * Fetches all visible top-level categories with their visible children.
 * Used by: FiltersSidebar, breadcrumbs, CollectionTiles.
 *
 * Only returns categories where:
 * - isVisible is true
 * - deletedAt is null (not soft-deleted)
 * - parentId is null (top-level only — children are nested inside)
 */
export async function getCategoryTree(): Promise<CategoryWithChildren[]> {
  const categories = await db.category.findMany({
    where: {
      parentId: null,
      isVisible: true,
      deletedAt: null,
    },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      navGroup: true,
      children: {
        where: {
          isVisible: true,
          deletedAt: null,
        },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameAr: true,
          nameRu: true,
        },
      },
    },
  });

  return categories;
}

/**
 * Fetches a single category by slug.
 * Used by: CatalogPage breadcrumb, PDP breadcrumb.
 * Returns null if not found or not visible.
 *
 * @param slug - the category URL slug e.g. "rifles"
 */
export async function getCategoryOptions(): Promise<
  { id: string; nameEn: string; parentId: string | null }[]
> {
  return db.category.findMany({
    where: { deletedAt: null, isVisible: true },
    select: { id: true, nameEn: true, parentId: true },
    orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
  });
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Pick<
  CategoryWithChildren,
  "id" | "slug" | "nameEn" | "nameAr" | "nameRu"
> | null> {
  const category = await db.category.findFirst({
    where: {
      slug,
      isVisible: true,
      deletedAt: null,
    },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
    },
  });

  return category;
}

// ── Admin queries ─────────────────────────────────────────────────────────────

type AdminCategoryChild = {
  id: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  isVisible: boolean;
  navGroup: "RIFLES" | "OPTICS" | "ACCESSORIES" | "AMMO" | null;
  productCount: number;
  publishedCount: number;
  childCount: number;
};

export type AdminCategoryNode = AdminCategoryChild & {
  children: AdminCategoryChild[];
};

export async function getAdminCategoryList(): Promise<AdminCategoryNode[]> {
  const [rows, publishedGroups] = await Promise.all([
    db.category.findMany({
      where: { parentId: null, deletedAt: null },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        nameRu: true,
        slug: true,
        parentId: true,
        displayOrder: true,
        isVisible: true,
        navGroup: true,
        _count: {
          select: {
            products: { where: { deletedAt: null } },
            children: { where: { deletedAt: null } },
          },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            nameRu: true,
            slug: true,
            parentId: true,
            displayOrder: true,
            isVisible: true,
            navGroup: true,
            _count: {
              select: {
                products: { where: { deletedAt: null } },
                children: { where: { deletedAt: null } },
              },
            },
          },
        },
      },
    }),
    db.product.groupBy({
      by: ["categoryId"],
      where: { deletedAt: null, publishStatus: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);

  const publishedById = new Map(
    publishedGroups.map((g) => [g.categoryId, g._count._all]),
  );

  return rows.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    nameAr: c.nameAr,
    nameRu: c.nameRu,
    slug: c.slug,
    parentId: c.parentId,
    displayOrder: c.displayOrder,
    isVisible: c.isVisible,
    navGroup: c.navGroup,
    productCount: c._count.products,
    publishedCount: publishedById.get(c.id) ?? 0,
    childCount: c._count.children,
    children: c.children.map((child) => ({
      id: child.id,
      nameEn: child.nameEn,
      nameAr: child.nameAr,
      nameRu: child.nameRu,
      slug: child.slug,
      parentId: child.parentId,
      displayOrder: child.displayOrder,
      isVisible: child.isVisible,
      navGroup: child.navGroup,
      productCount: child._count.products,
      publishedCount: publishedById.get(child.id) ?? 0,
      childCount: child._count.children,
    })),
  }));
}

export type AdminCategoryDetail = {
  id: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  isVisible: boolean;
  navGroup: "RIFLES" | "OPTICS" | "ACCESSORIES" | "AMMO" | null;
  productCount: number;
  publishedCount: number;
  extraProductCount: number;
  childCount: number;
  parent: { id: string; nameEn: string } | null;
  children: {
    id: string;
    nameEn: string;
    isVisible: boolean;
    productCount: number;
  }[];
};

export async function getAdminCategoryById(
  id: string,
): Promise<AdminCategoryDetail | null> {
  const [row, publishedCount, extraProductCount] = await Promise.all([
    db.category.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        nameRu: true,
        slug: true,
        parentId: true,
        displayOrder: true,
        isVisible: true,
        navGroup: true,
        parent: { select: { id: true, nameEn: true } },
        children: {
          where: { deletedAt: null },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            nameEn: true,
            isVisible: true,
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    }),
    db.product.count({
      where: { categoryId: id, deletedAt: null, publishStatus: "PUBLISHED" },
    }),
    db.productCategory.count({
      where: { categoryId: id, product: { is: { deletedAt: null } } },
    }),
  ]);

  if (!row) return null;

  return {
    id: row.id,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameRu: row.nameRu,
    slug: row.slug,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    navGroup: row.navGroup,
    productCount: row._count.products,
    publishedCount,
    extraProductCount,
    childCount: row.children.length,
    parent: row.parent,
    children: row.children.map((child) => ({
      id: child.id,
      nameEn: child.nameEn,
      isVisible: child.isVisible,
      productCount: child._count.products,
    })),
  };
}

export interface CategoryProductRow {
  id: string;
  sku: string;
  nameEn: string;
  brand: string;
  slugEn: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  publishStatus: PublishStatus;
  storageKey: string | null;
  placement: "main" | "extra";
  addedAt: string | null;
  mainCategory: {
    id: string;
    nameEn: string;
    slug: string;
    parentNameEn: string | null;
    live: boolean;
  };
}

export async function getCategoryProducts(
  categoryId: string,
): Promise<CategoryProductRow[]> {
  const rows = await db.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ categoryId }, { categoryLinks: { some: { categoryId } } }],
    },
    select: {
      id: true,
      sku: true,
      nameEn: true,
      brandRef: { select: { nameEn: true } },
      slugEn: true,
      price: true,
      stockQuantity: true,
      lowStockThreshold: true,
      publishStatus: true,
      categoryId: true,
      images: {
        orderBy: { displayOrder: "asc" },
        take: 1,
        select: { storageKey: true },
      },
      categoryLinks: {
        where: { categoryId },
        select: { createdAt: true },
      },
      category: {
        select: {
          id: true,
          nameEn: true,
          slug: true,
          isVisible: true,
          deletedAt: true,
          parent: {
            select: { nameEn: true, isVisible: true, deletedAt: true },
          },
        },
      },
    },
  });

  const mapped: CategoryProductRow[] = rows.map((p) => {
    const main = p.categoryId === categoryId;
    return {
      id: p.id,
      sku: p.sku,
      nameEn: p.nameEn,
      brand: p.brandRef?.nameEn ?? "",
      slugEn: p.slugEn,
      price: p.price.toNumber(),
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      publishStatus: p.publishStatus,
      storageKey: p.images[0]?.storageKey ?? null,
      placement: main ? "main" : "extra",
      addedAt:
        !main && p.categoryLinks[0]
          ? p.categoryLinks[0].createdAt.toISOString()
          : null,
      mainCategory: {
        id: p.category.id,
        nameEn: p.category.nameEn,
        slug: p.category.slug,
        parentNameEn: p.category.parent?.nameEn ?? null,
        live: isLiveCategory(p.category),
      },
    };
  });

  return mapped.sort((a, b) => {
    if (a.placement !== b.placement) return a.placement === "main" ? -1 : 1;
    return a.nameEn.localeCompare(b.nameEn);
  });
}

export interface CategoryPickerItem {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameRu: string | null;
  brand: string;
  slugEn: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  publishStatus: PublishStatus;
  storageKey: string | null;
  categoryId: string;
  categoryNameEn: string;
  categorySlug: string;
  parentCategoryId: string | null;
  parentCategoryNameEn: string | null;
  mainLive: boolean;
  alsoIn: { id: string; label: string }[];
  here: "main" | "extra" | null;
}

export async function getCategoryPickerItems(
  categoryId: string,
): Promise<CategoryPickerItem[]> {
  const rows = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { nameEn: "asc" },
    select: {
      id: true,
      sku: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      brandRef: { select: { nameEn: true } },
      slugEn: true,
      price: true,
      stockQuantity: true,
      lowStockThreshold: true,
      publishStatus: true,
      categoryId: true,
      images: {
        orderBy: { displayOrder: "asc" },
        take: 1,
        select: { storageKey: true },
      },
      category: {
        select: {
          id: true,
          nameEn: true,
          slug: true,
          parentId: true,
          isVisible: true,
          deletedAt: true,
          parent: {
            select: { nameEn: true, isVisible: true, deletedAt: true },
          },
        },
      },
      categoryLinks: {
        where: { category: { is: { deletedAt: null } } },
        select: {
          categoryId: true,
          category: {
            select: { nameEn: true, parent: { select: { nameEn: true } } },
          },
        },
      },
    },
  });

  return rows.map((p) => {
    const here: "main" | "extra" | null =
      p.categoryId === categoryId
        ? "main"
        : p.categoryLinks.some((l) => l.categoryId === categoryId)
          ? "extra"
          : null;
    return {
      id: p.id,
      sku: p.sku,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      nameRu: p.nameRu,
      brand: p.brandRef?.nameEn ?? "",
      slugEn: p.slugEn,
      price: p.price.toNumber(),
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      publishStatus: p.publishStatus,
      storageKey: p.images[0]?.storageKey ?? null,
      categoryId: p.category.id,
      categoryNameEn: p.category.nameEn,
      categorySlug: p.category.slug,
      parentCategoryId: p.category.parentId,
      parentCategoryNameEn: p.category.parent?.nameEn ?? null,
      mainLive: isLiveCategory(p.category),
      alsoIn: p.categoryLinks
        .filter((l) => l.categoryId !== categoryId)
        .map((l) => ({
          id: l.categoryId,
          label: l.category.parent
            ? `${l.category.parent.nameEn} › ${l.category.nameEn}`
            : l.category.nameEn,
        })),
      here,
    };
  });
}

export async function getCategoryParentOptions(
  excludeId?: string,
): Promise<{ id: string; nameEn: string; isVisible: boolean }[]> {
  return db.category.findMany({
    where: {
      parentId: null,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, nameEn: true, isVisible: true },
    orderBy: { displayOrder: "asc" },
  });
}
