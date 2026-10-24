import { requireStaff } from "@/lib/auth-staff";
import BrandForm from "@/components/admin/BrandForm";

export default async function AdminNewBrandPage() {
  await requireStaff("catalog:write");
  return <BrandForm mode="create" />;
}
