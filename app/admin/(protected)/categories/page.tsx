import { requireStaff } from "@/lib/auth-staff";
import { getAdminCategoryList } from "@/lib/db/queries/categories";
import { CategoriesManager } from "@/components/admin";

export default async function AdminCategoriesPage() {
  await requireStaff("catalog:write");
  const list = await getAdminCategoryList();
  return <CategoriesManager initial={list} />;
}
