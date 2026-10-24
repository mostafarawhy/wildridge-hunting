import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminStoreForEdit } from "@/lib/db/queries/stores";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import StoreForm from "@/components/admin/StoreForm";
import { buildStorePreviewLabels } from "@/components/admin/store-preview-labels";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditStorePage({ params }: Props) {
  const { id } = await params;
  await requireStaff("content:manage");

  const store = await getAdminStoreForEdit(id);
  if (!store) notFound();

  return (
    <ContentPageFrame
      backHref="/admin/stores"
      backLabel="Back to Store Locations"
      title={store.nameEn}
      purpose="One showroom: its name, address, map pin, hours and contact details."
      sketch="showroom"
    >
      <StoreForm mode="edit" initial={store} labels={buildStorePreviewLabels()} />
    </ContentPageFrame>
  );
}
