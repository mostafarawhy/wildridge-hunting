import { requireStaff } from "@/lib/auth-staff";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import StoreForm from "@/components/admin/StoreForm";
import { buildStorePreviewLabels } from "@/components/admin/store-preview-labels";

export default async function AdminNewStorePage() {
  await requireStaff("content:manage");

  return (
    <ContentPageFrame
      backHref="/admin/stores"
      backLabel="Back to Store Locations"
      title="New Store"
      purpose="One showroom: its name, address, map pin, hours and contact details."
      sketch="showroom"
    >
      <StoreForm mode="create" labels={buildStorePreviewLabels()} />
    </ContentPageFrame>
  );
}
