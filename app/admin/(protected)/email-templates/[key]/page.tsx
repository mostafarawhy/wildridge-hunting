import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { listEmailTemplateOverridesAction } from "@/lib/actions/email-template";
import { getSetting } from "@/lib/db/queries/settings";
import { EMAIL_DEFAULTS } from "@/lib/email/defaults";
import { emailChromeContext } from "@/lib/email/i18n";
import { AdminPageHeader } from "@/components/admin";
import EmailTemplateEditor from "@/components/admin/EmailTemplateEditor";

interface Props {
  params: Promise<{ key: string }>;
}

export default async function AdminEmailTemplateDetailPage({ params }: Props) {
  const { key } = await params;
  await requireStaff("content:manage");

  if (!Object.prototype.hasOwnProperty.call(EMAIL_DEFAULTS, key)) notFound();

  const overrides = await listEmailTemplateOverridesAction();
  const rowsForKey = overrides.filter((o) => o.templateKey === key);
  const storeProfile = await getSetting("store_profile");

  const initialOverrides = {
    en: rowsForKey.find((o) => o.locale === "en") ?? null,
    ar: rowsForKey.find((o) => o.locale === "ar") ?? null,
    ru: rowsForKey.find((o) => o.locale === "ru") ?? null,
  };

  const sendingEnabled = !rowsForKey.some((r) => r.enabled === false);

  const chromeContexts = {
    en: emailChromeContext("en"),
    ar: emailChromeContext("ar"),
    ru: emailChromeContext("ru"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/email-templates"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            textDecoration: "none",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Email Templates
        </Link>

        <AdminPageHeader title={EMAIL_DEFAULTS[key].label} subtitle={key} />
      </div>

      <EmailTemplateEditor
        templateKey={key}
        defaultSubject={EMAIL_DEFAULTS[key].subject}
        defaultBody={EMAIL_DEFAULTS[key].body}
        initialOverrides={initialOverrides}
        sendingEnabled={sendingEnabled}
        defaultCtaLabel={EMAIL_DEFAULTS[key].ctaLabel ?? undefined}
        storeProfile={storeProfile}
        chromeContexts={chromeContexts}
      />
    </div>
  );
}
