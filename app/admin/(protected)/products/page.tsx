import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { can } from "@/lib/utils/staff-permissions";
import {
  getAdminProducts,
  getAdminProductStatusCounts,
  ADMIN_PRODUCTS_PER_PAGE,
  VALID_ADMIN_SORTS,
} from "@/lib/db/queries/products";
import { getAdminCategoryList } from "@/lib/db/queries/categories";
import { getBrandOptions } from "@/lib/db/queries/brands";
import type { PublishStatus } from "@/app/generated/prisma/client";
import type {
  AdminProductFilters,
  AdminProductSort,
  AdminProductStockFilter,
} from "@/lib/db/queries/products";
import {
  AdminPageHeader,
  ProductFilterBar,
  ProductsTable,
} from "@/components/admin";
import AdminPaginationBar from "@/components/admin/AdminPaginationBar";

const VALID_STATUSES: PublishStatus[] = ["PUBLISHED", "DRAFT", "ARCHIVED"];
const VALID_STOCK: AdminProductStockFilter[] = ["in", "low", "out"];

function isPublishStatus(value: string): value is PublishStatus {
  return (VALID_STATUSES as string[]).includes(value);
}

function isStockFilter(value: string): value is AdminProductStockFilter {
  return (VALID_STOCK as string[]).includes(value);
}

function parsePrice(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999) return undefined;
  return n;
}

function parseFlag(value: string | undefined): boolean {
  return value === "1";
}

interface Props {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    brand?: string;
    stock?: string;
    min?: string;
    max?: string;
    id?: string;
    accessories?: string;
    b2b?: string;
    new?: string;
    featured?: string;
    noimage?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  const { staffRole } = await requireStaff("catalog:write");

  const sp = await searchParams;

  const status =
    sp.status && isPublishStatus(sp.status) ? sp.status : undefined;

  const sort: AdminProductSort = VALID_ADMIN_SORTS.includes(
    sp.sort as AdminProductSort,
  )
    ? (sp.sort as AdminProductSort)
    : "newest";

  const search = sp.q?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [categoryTree, brandOptions] = await Promise.all([
    getAdminCategoryList(),
    getBrandOptions(),
  ]);

  let categoryId: string | undefined;
  let categoryIds: string[] | undefined;
  for (const parent of categoryTree) {
    if (sp.category === parent.id) {
      categoryId = parent.id;
      categoryIds = [parent.id, ...parent.children.map((c) => c.id)];
      break;
    }
    const child = parent.children.find((c) => c.id === sp.category);
    if (child) {
      categoryId = child.id;
      categoryIds = [child.id];
      break;
    }
  }

  const brand =
    sp.brand && brandOptions.some((b) => b.slug === sp.brand)
      ? sp.brand
      : undefined;
  const stock = sp.stock && isStockFilter(sp.stock) ? sp.stock : undefined;
  const minPrice = parsePrice(sp.min);
  const maxPrice = parsePrice(sp.max);
  const requiresId = parseFlag(sp.id);
  const hasAccessories = parseFlag(sp.accessories);
  const b2b = parseFlag(sp.b2b);
  const isNew = parseFlag(sp.new);
  const featured = parseFlag(sp.featured);
  const noImage = parseFlag(sp.noimage);

  const filters: AdminProductFilters = {
    search,
    categoryIds,
    brand,
    stock,
    minPrice,
    maxPrice,
    requiresId,
    hasAccessories,
    b2b,
    isNew,
    featured,
    noImage,
  };

  const [{ items, totalCount }, counts] = await Promise.all([
    getAdminProducts({ ...filters, status, sort, page }),
    getAdminProductStatusCounts(filters),
  ]);

  const totalPages = Math.ceil(totalCount / ADMIN_PRODUCTS_PER_PAGE);
  const from = totalCount === 0 ? 0 : (page - 1) * ADMIN_PRODUCTS_PER_PAGE + 1;
  const to = Math.min(page * ADMIN_PRODUCTS_PER_PAGE, totalCount);

  const filterCategories = categoryTree.map((c) => ({
    id: c.id,
    nameEn: c.nameEn,
    isVisible: c.isVisible,
    children: c.children.map((ch) => ({
      id: ch.id,
      nameEn: ch.nameEn,
      isVisible: ch.isVisible,
    })),
  }));

  return (
    <>
      <AdminPageHeader
        title="Products"
        subtitle="Manage the product catalog"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {can(staffRole, "catalog:import") && (
              <Link
                href="/admin/import"
                style={{
                  fontSize: "var(--text-body)",
                  color: "#0b0b0b",
                  textDecoration: "underline",
                }}
              >
                Import catalog
              </Link>
            )}
            <Link
              href="/admin/products/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "2.5rem",
                paddingInline: "1.25rem",
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "0",
              }}
            >
              + New product
            </Link>
          </div>
        }
      />
      <ProductFilterBar
        values={{
          status: status ?? "ALL",
          sort,
          q: search ?? "",
          category: categoryId ?? "",
          brand: brand ?? "",
          stock: stock ?? "",
          min: minPrice !== undefined ? String(minPrice) : "",
          max: maxPrice !== undefined ? String(maxPrice) : "",
          requiresId,
          accessories: hasAccessories,
          b2b,
          isNew,
          featured,
          noImage,
        }}
        counts={counts}
        brands={brandOptions.map((b) => ({ value: b.slug, label: b.nameEn }))}
        categories={filterCategories}
      />
      <ProductsTable rows={items} />
      {totalCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: 0,
            }}
          >
            Showing {from}–{to} of {totalCount}
          </p>
          <AdminPaginationBar totalPages={totalPages} />
        </div>
      )}
    </>
  );
}
