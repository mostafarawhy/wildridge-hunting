import { requireStaff } from "@/lib/auth-staff";
import { listEmailTemplateOverridesAction } from "@/lib/actions/email-template";
import { EMAIL_DEFAULTS, hasOverrideContent } from "@/lib/email/defaults";
import { AdminPageHeader } from "@/components/admin";
import EmailTemplatesTable from "@/components/admin/EmailTemplatesTable";

export default async function AdminEmailTemplatesPage() {
  await requireStaff("content:manage");

  const overrides = await listEmailTemplateOverridesAction();

  const rows = Object.keys(EMAIL_DEFAULTS).map((key) => {
    const rowsForKey = overrides.filter((o) => o.templateKey === key);
    const enOverride = rowsForKey.find((o) => o.locale === "en");
    const hasOverride = {
      en: rowsForKey.some((o) => o.locale === "en" && hasOverrideContent(o)),
      ar: rowsForKey.some((o) => o.locale === "ar" && hasOverrideContent(o)),
      ru: rowsForKey.some((o) => o.locale === "ru" && hasOverrideContent(o)),
    };
    return {
      key,
      label: EMAIL_DEFAULTS[key].label,
      category: EMAIL_DEFAULTS[key].category,
      subject: EMAIL_DEFAULTS[key].subject,
      hasOverride,
      sending: enOverride?.enabled ?? true,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="Email Templates"
        subtitle="Manage per-locale overrides for transactional emails"
      />
      <EmailTemplatesTable rows={rows} />
    </>
  );
}
