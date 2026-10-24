import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSetting } from "@/lib/db/queries/settings";
import { WhatsAppIcon, PhoneIcon, MailIcon } from "@/components/ui/icons";

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";
const warmBand = "var(--color-auth-form-bg)";

function Row({
  icon,
  label,
  value,
  href,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  hint?: string;
}) {
  return (
    <a href={href} className="flex items-center gap-3" style={{ color: ink }}>
      <span
        className="flex items-center justify-center"
        style={{ width: "40px", height: "40px", background: warmBand, color: ink, flexShrink: 0 }}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="flex items-center gap-2">
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{label}</span>
          {hint && <span style={{ fontSize: "11px", color: muted }}>{hint}</span>}
        </span>
        <span style={{ fontSize: "13px", color: muted }}>
          <span dir="ltr">{value}</span>
        </span>
      </span>
    </a>
  );
}

export async function CareCard() {
  const t = await getTranslations("pages.care");
  const profile = await getSetting("store_profile");

  if (!profile.contactPhone && !profile.contactEmail) return null;

  return (
    <div
      className="flex flex-col"
      style={{ border: `1px solid ${hairline}`, padding: "24px", gap: "18px" }}
    >
      <div>
        <p style={{ fontSize: "12px", color: muted }}>{t("eyebrow")}</p>
        <p style={{ fontSize: "18px", fontWeight: 700, color: ink }}>{t("title")}</p>
      </div>

      {profile.contactPhone && (
        <Row
          icon={<WhatsAppIcon />}
          label={t("whatsapp")}
          value={profile.contactPhone}
          href={`https://wa.me/${profile.contactPhone.replace(/\D/g, "")}`}
          hint={t("whatsappHint")}
        />
      )}
      {profile.contactPhone && (
        <Row
          icon={<PhoneIcon />}
          label={t("call")}
          value={profile.contactPhone}
          href={`tel:${profile.contactPhone}`}
        />
      )}
      {profile.contactEmail && (
        <Row
          icon={<MailIcon />}
          label={t("email")}
          value={profile.contactEmail}
          href={`mailto:${profile.contactEmail}`}
        />
      )}

      <Link href="/contact" style={{ fontSize: "13px", color: ink, textDecoration: "underline" }}>
        {t("all")}
      </Link>
    </div>
  );
}
