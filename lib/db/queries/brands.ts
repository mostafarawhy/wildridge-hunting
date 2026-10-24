import "server-only";
import { db } from "@/lib/db/client";
import type { PublishStatus } from "@/app/generated/prisma/client";

export interface AdminBrandRow {
  id: string;
  nameEn: string;
  nameAr: string | null;
  nameRu: string | null;
  slug: string;
  isVisible: boolean;
  productCount: number;
}

export async function getAdminBrandList(): Promise<AdminBrandRow[]> {
  const rows = await db.brand.findMany({
    where: { deletedAt: null },
    orderBy: { nameEn: "asc" },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      slug: true,
      isVisible: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameRu: row.nameRu,
    slug: row.slug,
    isVisible: row.isVisible,
    productCount: row._count.products,
  }));
}

export type AdminBrandDetail = AdminBrandRow;

export async function getAdminBrandById(
  id: string,
): Promise<AdminBrandDetail | null> {
  const row = await db.brand.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      nameRu: true,
      slug: true,
      isVisible: true,
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameRu: row.nameRu,
    slug: row.slug,
    isVisible: row.isVisible,
    productCount: row._count.products,
  };
}

export interface BrandProductRow {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  publishStatus: PublishStatus;
  mainCategory: { nameEn: string };
}

export async function getBrandProducts(
  brandId: string,
): Promise<BrandProductRow[]> {
  const rows = await db.product.findMany({
    where: { brandId, deletedAt: null },
    orderBy: { nameEn: "asc" },
    select: {
      id: true,
      sku: true,
      nameEn: true,
      nameAr: true,
      publishStatus: true,
      category: { select: { nameEn: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    publishStatus: p.publishStatus,
    mainCategory: { nameEn: p.category.nameEn },
  }));
}

export interface BrandOption {
  id: string;
  nameEn: string;
  slug: string;
  isVisible: boolean;
}

export async function getBrandOptions(): Promise<BrandOption[]> {
  return db.brand.findMany({
    where: { deletedAt: null },
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, slug: true, isVisible: true },
  });
}
