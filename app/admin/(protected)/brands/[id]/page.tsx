import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminBrandById,
  getBrandProducts,
} from "@/lib/db/queries/brands";
import BrandForm from "@/components/admin/BrandForm";
import BrandProductsList from "@/components/admin/BrandProductsList";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditBrandPage({ params }: Props) {
  const { id } = await params;
  await requireStaff("catalog:write");

  const [initial, rows] = await Promise.all([
    getAdminBrandById(id),
    getBrandProducts(id),
  ]);
  if (!initial) notFound();

  return (
    <BrandForm
      mode="edit"
      initial={initial}
      slots={{
        products: <BrandProductsList brandName={initial.nameEn} rows={rows} />,
      }}
    />
  );
}
