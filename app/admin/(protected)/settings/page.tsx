import { BRAND } from "@/lib/config/brand";
import { requireStaff } from "@/lib/auth-staff";
import { getSetting } from "@/lib/db/queries/settings";
import { env } from "@/lib/env";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import DemoViewOnlyNote from "@/components/admin/DemoViewOnlyNote";
import EmailIdentityForm from "@/components/admin/EmailIdentityForm";
import EmailRecipientsForm from "@/components/admin/EmailRecipientsForm";
import LegalTaxForm from "@/components/admin/LegalTaxForm";
import DeliveryConfigForm from "@/components/admin/DeliveryConfigForm";

export default async function Page() {
  await requireStaff("settings:manage");
  const identity = await getSetting("email_identity");
  const recipients = await getSetting("email_recipients");
  const tax = await getSetting("tax_config");
  const legal = await getSetting("legal_details");
  const delivery = await getSetting("delivery_config");

  return (
    <div>
      <AdminPageHeader
        title="General Settings"
        subtitle="Tax, legal details, delivery follow-up, and how store emails are sent"
      />
      <DemoViewOnlyNote permission="settings:manage" />
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <LegalTaxForm initialTax={tax} initialLegal={legal} />
        <DeliveryConfigForm initial={delivery} />
        <EmailIdentityForm
          initial={identity}
          sendingAddress={env.RESEND_FROM_EMAIL ?? BRAND.noReplyEmail}
        />
        <EmailRecipientsForm initial={recipients} />
      </div>
    </div>
  );
}
