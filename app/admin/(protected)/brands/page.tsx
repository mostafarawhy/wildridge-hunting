import { requireStaff } from "@/lib/auth-staff";
import { getAdminBrandList } from "@/lib/db/queries/brands";
import { BrandsManager } from "@/components/admin";

export default async function AdminBrandsPage() {
  await requireStaff("catalog:write");
  const list = await getAdminBrandList();
  return <BrandsManager initial={list} />;
}
