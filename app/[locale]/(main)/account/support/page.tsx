import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/db/queries/settings";
import {
  getSupportFormData,
  getCustomerSupportRequests,
} from "@/lib/db/queries/support";
import { SUPPORT_TOPICS } from "@/lib/validations/support";
import { WhatsAppIcon, PhoneIcon, MailIcon } from "@/components/ui/icons";
import SupportRequestForm from "@/components/account/SupportRequestForm";
import SupportRequestList from "@/components/account/SupportRequestList";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; quote?: string; topic?: string }>;
}

const channelTile: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "1rem",
  border: "1px solid var(--color-shop-divider)",
  backgroundColor: "var(--color-auth-input-bg)",
  textDecoration: "none",
  flex: "1 1 220px",
  minWidth: "220px",
};

const channelIconBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.5rem",
  height: "2.5rem",
  flexShrink: 0,
  backgroundColor: "var(--color-auth-form-bg)",
  color: "var(--color-action-primary)",
};

const channelLabel: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-semibold)",
  color: "var(--color-content-inverse)",
};

const channelHint: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  color: "var(--color-content-tertiary)",
};

const channelValue: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
};

const linkStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-inverse)",
  textDecoration: "underline",
};

export default async function AccountSupportPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const safeLocale = locale as "en" | "ar" | "ru";
  const { order, quote, topic } = await searchParams;

  const session = await auth();
  if (!session?.user?.id || session.user.principal !== "customer") {
    return redirect({ href: "/auth/login", locale: safeLocale });
  }

  const [t, profile, formData, requests] = await Promise.all([
    getTranslations("account.support"),
    getSetting("store_profile"),
    getSupportFormData(session.user.id, { orderId: order, quoteId: quote }),
    getCustomerSupportRequests(session.user.id),
  ]);

  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  const hasChannels = !!profile.contactPhone || !!profile.contactEmail;

  const mailHref = profile.contactEmail
    ? `mailto:${profile.contactEmail}?subject=${encodeURIComponent(
        t("email.subject", { name }),
      )}&body=${encodeURIComponent(
        t("email.body", { name, email }).replace(/\n/g, "\r\n"),
      )}`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <p
          style={{
            fontSize: "var(--text-eyebrow)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-content-tertiary)",
            marginBottom: "0.25rem",
          }}
        >
          {t("eyebrow")}
        </p>
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          {t("intro")}
        </p>
      </div>

      {hasChannels && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {profile.contactPhone && (
            <a
              href={`https://wa.me/${profile.contactPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={channelTile}
            >
              <span style={channelIconBox}>
                <WhatsAppIcon size={20} />
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.125rem",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <span style={channelLabel}>{t("channels.whatsapp")}</span>
                  <span style={channelHint}>{t("channels.whatsappHint")}</span>
                </span>
                <span style={channelValue}>
                  <span dir="ltr">{profile.contactPhone}</span>
                </span>
              </span>
            </a>
          )}

          {profile.contactPhone && (
            <a href={`tel:${profile.contactPhone}`} style={channelTile}>
              <span style={channelIconBox}>
                <PhoneIcon size={20} />
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.125rem",
                }}
              >
                <span style={channelLabel}>{t("channels.call")}</span>
                <span style={channelValue}>
                  <span dir="ltr">{profile.contactPhone}</span>
                </span>
              </span>
            </a>
          )}

          {mailHref && (
            <a href={mailHref} style={channelTile}>
              <span style={channelIconBox}>
                <MailIcon size={20} />
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.125rem",
                }}
              >
                <span style={channelLabel}>{t("channels.email")}</span>
                <span style={channelHint}>{t("channels.emailHint")}</span>
              </span>
            </a>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
        <Link href="/faq" style={linkStyle}>
          {t("links.faq")}
        </Link>
        <Link href="/contact" style={linkStyle}>
          {t("links.contact")}
        </Link>
      </div>

      <SupportRequestForm
        orders={formData.orders}
        quotes={formData.quotes}
        canQuote={formData.canQuote}
        hasBusinessAccount={formData.hasBusinessAccount}
        prefillOrderId={
          order && formData.orders.some((o) => o.id === order)
            ? order
            : undefined
        }
        prefillQuoteId={
          quote && formData.quotes.some((q) => q.id === quote)
            ? quote
            : undefined
        }
        prefillTopic={SUPPORT_TOPICS.find((value) => value === topic)}
      />

      <SupportRequestList requests={requests} locale={safeLocale} />
    </div>
  );
}
