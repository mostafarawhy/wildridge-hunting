import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminCategoryById,
  getCategoryParentOptions,
  getCategoryProducts,
  getCategoryPickerItems,
} from "@/lib/db/queries/categories";
import CategoryForm from "@/components/admin/CategoryForm";
import CategoryProductsManager from "@/components/admin/CategoryProductsManager";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditCategoryPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("catalog:write");

  const [initial, parentOptions, rows, pickerItems] = await Promise.all([
    getAdminCategoryById(id),
    getCategoryParentOptions(id),
    getCategoryProducts(id),
    getCategoryPickerItems(id),
  ]);
  if (!initial) notFound();

  const parentVisible = initial.parentId
    ? (parentOptions.find((p) => p.id === initial.parentId)?.isVisible ?? false)
    : true;
  const live = initial.isVisible && parentVisible;
  const pathLabel = initial.parent
    ? `${initial.parent.nameEn} › ${initial.nameEn}`
    : initial.nameEn;
  const subcategoryProductCount = initial.children.reduce(
    (sum, c) => sum + c.productCount,
    0,
  );

  return (
    <CategoryForm
      mode="edit"
      initial={initial}
      parentOptions={parentOptions}
      slots={{
        products: (
          <CategoryProductsManager
            categoryId={initial.id}
            categoryName={initial.nameEn}
            slug={initial.slug}
            live={live}
            pathLabel={pathLabel}
            subcategoryProductCount={subcategoryProductCount}
            rows={rows}
            pickerItems={pickerItems}
          />
        ),
      }}
    />
  );
}
