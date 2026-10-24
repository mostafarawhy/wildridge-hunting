import { requireStaff } from "@/lib/auth-staff";
import { getAdminCategoryList } from "@/lib/db/queries/categories";
import { getBrandOptions } from "@/lib/db/queries/brands";
import ProductForm from "@/components/admin/ProductForm";
import { getSetting } from "@/lib/db/queries/settings";

export default async function AdminNewProductPage() {
  await requireStaff("catalog:write");

  const [categoryList, brandOptions, loyaltyProgram] = await Promise.all([
    getAdminCategoryList(),
    getBrandOptions(),
    getSetting("loyalty_program"),
  ]);

  const categoryTree = categoryList.map((c) => ({
    id: c.id,
    slug: c.slug,
    nameEn: c.nameEn,
    isVisible: c.isVisible,
    children: c.children.map((ch) => ({
      id: ch.id,
      slug: ch.slug,
      nameEn: ch.nameEn,
      isVisible: ch.isVisible,
    })),
  }));

  return (
    <ProductForm
      mode="create"
      categoryTree={categoryTree}
      brandOptions={brandOptions}
      loyaltyProgram={{
        enabled: loyaltyProgram.enabled,
        earnRate: loyaltyProgram.earnRate,
      }}
    />
  );
}
