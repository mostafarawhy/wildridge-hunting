import { requireStaff } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import ContentPageFrame from "@/components/admin/ContentPageFrame";
import StoreProfileForm from "@/components/admin/StoreProfileForm";

export default async function Page() {
  await requireStaff("content:manage");
  const profile = await getSetting("store_profile");

  return (
    <ContentPageFrame
      backHref="/admin/pages"
      backLabel="Back to Store Pages"
      title="Store Profile"
      purpose="Your business identity. The address and social links show in the site footer, the store details in every email, and the email and phone feed the Contact page and the WhatsApp link."
      sketch="footer"
    >
      <StoreProfileForm initial={profile} />
    </ContentPageFrame>
  );
}
