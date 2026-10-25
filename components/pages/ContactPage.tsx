import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublishedPage, listPublishedPageKeys } from "@/lib/db/queries/pages";
import { parsePageContent, parseFaqContent } from "@/lib/utils/page-blocks";
import { PAGE_CONFIG, PAGE_LOCALES } from "@/lib/utils/page-keys";
import { getSetting } from "@/lib/db/queries/settings";
import { getPrimaryStore } from "@/lib/db/queries/stores";
import { localized, directionsUrl } from "@/lib/utils/stores";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/pages/PageHero";
import { PageBlocks } from "@/components/pages/PageBlocks";
import { StoreBlock } from "@/components/pages/StoreBlock";
import { WhatsAppIcon, PhoneIcon, MailIcon, MapPinIcon } from "@/components/ui/icons";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";

type Locale = (typeof PAGE_LOCALES)[number];

const ink = "var(--primitive-black)";
const muted = "var(--color-content-tertiary)";
const hairline = "var(--color-shop-divider)";
const red = "var(--color-action-primary)";
const warmBand = "var(--color-auth-form-bg)";

function ChevronIcon({ color = ink }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      className="rtl:-scale-x-100"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6">
      <rect x="3" y="7" width="18" height="12" rx="1.5" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6">
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}

function MailButtonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 6.5l9 6.5 9-6.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="1.6">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ContactCard({
  icon,
  title,
  body,
  value,
  ctaLabel,
  href,
  target,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  value: string;
  ctaLabel: string;
  href: string;
  target?: string;
  badge?: string;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--color-auth-input-bg)",
        border: `1px solid ${hairline}`,
        padding: "28px",
        gap: "14px",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: "48px",
          height: "48px",
          background: warmBand,
          color: ink,
        }}
      >
        {icon}
      </span>
      <div className="flex items-center gap-2">
        <p style={{ fontSize: "19px", fontWeight: 700, color: ink }}>{title}</p>
        {badge && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-positive)",
              background: "var(--color-positive-soft-bg)",
              padding: "2px 8px",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: "15px", color: muted }}>{body}</p>
      <p style={{ fontSize: "15px", fontWeight: 600, color: ink }}>
        <span dir="ltr">{value}</span>
      </p>
      <a
        href={href}
        target={target}
        rel={target ? "noopener noreferrer" : undefined}
        className="flex items-center gap-2"
        style={{
          fontSize: "14px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: red,
        }}
      >
        {ctaLabel}
        <ChevronIcon color={red} />
      </a>
    </div>
  );
}

function HelpCard({
  icon,
  title,
  body,
  emailHref,
  emailCta,
  linkHref,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  emailHref: string | null;
  emailCta: string;
  linkHref: string | { pathname: string; query: Record<string, string> };
  linkLabel: string;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--color-auth-input-bg)",
        border: `1px solid ${hairline}`,
        padding: "32px",
        gap: "16px",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{ width: "48px", height: "48px", background: warmBand }}
      >
        {icon}
      </span>
      <p style={{ fontSize: "20px", fontWeight: 700, color: ink }}>{title}</p>
      <p style={{ fontSize: "15px", color: muted, lineHeight: 1.6 }}>{body}</p>
      <div style={{ flex: 1 }} />
      {emailHref && (
        <a
          href={emailHref}
          className="flex w-full items-center justify-center gap-2 transition-colors hover:bg-[var(--color-auth-form-bg)]"
          style={{
            height: "52px",
            border: `1px solid ${ink}`,
            color: ink,
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          <MailButtonIcon />
          {emailCta}
        </a>
      )}
      <Link
        href={linkHref}
        className="flex items-center gap-2"
        style={{
          fontSize: "14px",
          color: ink,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        {linkLabel}
        <ChevronIcon />
      </Link>
    </div>
  );
}

export async function ContactPage({ locale }: { locale: Locale }) {
  const page = await getPublishedPage("contact", locale);
  if (!page) notFound();

  const { lead, blocks, wordCount } = parsePageContent(page.content);
  const config = PAGE_CONFIG.contact;
  const alsoIn = page.authoredLocales.filter((l) => l !== page.resolvedLocale);

  const t = await getTranslations({ locale: page.resolvedLocale, namespace: "pages" });
  const profile = await getSetting("store_profile");
  const dir = page.resolvedLocale === "ar" ? "rtl" : "ltr";

  const primary = await getPrimaryStore();
  const storesPublished = (await listPublishedPageKeys()).includes("stores");

  const session = await auth();
  const signedIn = !!(session?.user?.id && session.user.principal === "customer");
  const name = signedIn ? (session?.user.name ?? "") : "";
  const email = signedIn ? (session?.user.email ?? "") : "";

  const faqPage = await getPublishedPage("faq", locale);
  const quickQuestions = faqPage
    ? parseFaqContent(faqPage.content)
        .groups.flatMap((g) => g.questions)
        .slice(0, 3)
    : [];

  function mailHref(key: "general" | "order" | "account"): string | null {
    if (!profile.contactEmail) return null;
    const subject = t(`contact.help.${key}.subject`);
    const template = t(`contact.help.${key}.template`, { name, email });
    return `mailto:${profile.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(template.replace(/\n/g, "\r\n"))}`;
  }

  const hasChannelCard = !!profile.contactPhone || !!profile.contactEmail || !!primary;

  return (
    <div>
      <PageHero
        pageKey="contact"
        group={config.group}
        title={page.title}
        lead={lead}
        updatedAt={page.updatedAt}
        wordCount={wordCount}
        resolvedLocale={page.resolvedLocale}
        requestLocale={locale}
        alsoIn={alsoIn}
        fallback={page.fallback}
        showMeta={false}
      />

      <div
        className="flex flex-col px-6 py-12 lg:px-24 lg:py-20"
        style={{ background: "var(--color-auth-input-bg)", gap: "64px" }}
      >
        <div>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: red,
            }}
          >
            {t("contact.help.eyebrow")}
          </p>
          <h2
            className="text-[32px] lg:text-[36px]"
            style={{ fontWeight: 700, color: ink, marginTop: "8px" }}
          >
            {t("contact.help.title")}
          </h2>
          <p style={{ fontSize: "16px", color: muted, maxWidth: "640px", marginTop: "12px" }}>
            {t("contact.help.body")}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ marginTop: "32px" }}>
            <HelpCard
              icon={<ChatBubbleIcon />}
              title={t("contact.help.general.title")}
              body={t("contact.help.general.body")}
              emailHref={mailHref("general")}
              emailCta={t("contact.help.general.cta")}
              linkHref="/faq"
              linkLabel={t("contact.help.general.link")}
            />
            <HelpCard
              icon={<PackageIcon />}
              title={t("contact.help.order.title")}
              body={t("contact.help.order.body")}
              emailHref={mailHref("order")}
              emailCta={t("contact.help.order.cta")}
              linkHref={
                signedIn
                  ? "/account/orders"
                  : { pathname: "/auth/login", query: { callbackUrl: "/account/orders" } }
              }
              linkLabel={signedIn ? t("contact.help.order.link") : t("contact.help.order.signIn")}
            />
            <HelpCard
              icon={<UserIcon />}
              title={t("contact.help.account.title")}
              body={t("contact.help.account.body")}
              emailHref={mailHref("account")}
              emailCta={t("contact.help.account.cta")}
              linkHref={
                signedIn
                  ? "/account"
                  : { pathname: "/auth/login", query: { callbackUrl: "/account" } }
              }
              linkLabel={signedIn ? t("contact.help.account.link") : t("contact.help.account.signIn")}
            />
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: "20px" }}>
            <LockIcon />
            <span style={{ fontSize: "13px", color: muted }}>{t("contact.help.note")}</span>
          </div>
        </div>

        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: "var(--color-auth-input-bg)", border: `1px solid ${hairline}`, padding: "28px" }}
        >
          <div>
            <p style={{ fontSize: "19px", fontWeight: 700, color: ink }}>
              {t("contact.accountRequest.title")}
            </p>
            <p style={{ fontSize: "15px", color: muted, marginTop: "4px" }}>
              {t("contact.accountRequest.body")}
            </p>
          </div>
          <Link
            href="/account/support"
            className="flex items-center justify-center transition-colors text-[color:var(--color-action-primary)] hover:bg-[var(--color-action-primary)] hover:text-white"
            style={{
              height: "48px",
              paddingInline: "24px",
              border: `1px solid ${red}`,
              fontSize: "13px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {t("contact.accountRequest.cta")}
          </Link>
        </div>

        {hasChannelCard && (
          <div>
            <h2 style={{ fontSize: "26px", fontWeight: 700, color: ink }}>
              {t("contact.help.channelsTitle")}
            </h2>
            <div
              className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4"
              style={{ marginTop: "24px" }}
            >
              {profile.contactPhone && (
                <ContactCard
                  icon={<WhatsAppIcon size={20} />}
                  title={t("contact.whatsappTitle")}
                  body={t("contact.whatsappBody")}
                  value={profile.contactPhone}
                  ctaLabel={t("contact.whatsappCta")}
                  href={`https://wa.me/${profile.contactPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  badge={t("contact.fastest")}
                />
              )}
              {profile.contactPhone && (
                <ContactCard
                  icon={<PhoneIcon size={20} />}
                  title={t("contact.callTitle")}
                  body={t("contact.callBody")}
                  value={profile.contactPhone}
                  ctaLabel={t("contact.callCta")}
                  href={`tel:${profile.contactPhone}`}
                />
              )}
              {profile.contactEmail && (
                <ContactCard
                  icon={<MailIcon size={20} />}
                  title={t("contact.emailTitle")}
                  body={t("contact.emailBody")}
                  value={profile.contactEmail}
                  ctaLabel={t("contact.emailCta")}
                  href={`mailto:${profile.contactEmail}`}
                />
              )}
              {primary && (
                <ContactCard
                  icon={<MapPinIcon size={20} />}
                  title={t("contact.visitTitle")}
                  body={t("contact.visitBody")}
                  value={localized(primary, "address", page.resolvedLocale) ?? primary.addressEn}
                  ctaLabel={t("contact.visitCta")}
                  href={directionsUrl(primary.latitude, primary.longitude)}
                  target="_blank"
                />
              )}
            </div>
          </div>
        )}

        {primary && (
          <div>
            <StoreBlock store={primary} locale={page.resolvedLocale} />
            {storesPublished && (
              <Link
                href="/stores"
                style={{
                  display: "inline-block",
                  fontSize: "14px",
                  color: ink,
                  textDecoration: "underline",
                  marginTop: "16px",
                }}
              >
                {t("stores.allStores")}
              </Link>
            )}
          </div>
        )}

        <article lang={page.resolvedLocale} dir={dir} style={{ maxWidth: "760px" }}>
          <PageBlocks blocks={blocks} numbered={false} size="default" linkMode="locale" />
        </article>

        {quickQuestions.length > 0 && (
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex flex-col" style={{ width: "320px", flexShrink: 0, gap: "8px" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: red }}>
                {t("contact.quickEyebrow")}
              </p>
              <h2 style={{ fontSize: "26px", fontWeight: 700, color: ink }}>{t("contact.quickTitle")}</h2>
              <Link href="/faq" style={{ fontSize: "14px", color: ink, textDecoration: "underline" }}>
                {t("contact.quickCta")}
              </Link>
            </div>
            <div className="flex-1">
              {quickQuestions.map((q, i) => (
                <Link
                  key={q.id}
                  href={`/faq#${q.id}`}
                  className="flex items-center justify-between"
                  style={{
                    padding: "20px 0",
                    borderBottom: i === quickQuestions.length - 1 ? "none" : `1px solid ${hairline}`,
                    fontSize: "18px",
                    fontWeight: 600,
                    color: ink,
                  }}
                >
                  {q.question}
                  <ChevronIcon />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div
          className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between lg:py-9 lg:px-10"
          style={{ background: warmBand, border: `1px solid ${hairline}` }}
        >
          <div className="flex flex-col">
            <span
              className="flex items-center justify-center"
              style={{
                width: "56px",
                height: "56px",
                background: "var(--color-auth-input-bg)",
                border: `1px solid ${hairline}`,
              }}
            >
              <BriefcaseIcon />
            </span>
            <p style={{ fontSize: "22px", fontWeight: 700, color: ink, marginTop: "16px" }}>
              {t("contact.b2bTitle")}
            </p>
            <p style={{ fontSize: "15px", color: muted, marginTop: "6px" }}>{t("contact.b2bBody")}</p>
          </div>
          <LocaleButtonLink href="/b2b" variant="primary" size="lg">
            {t("contact.b2bCta")}
          </LocaleButtonLink>
        </div>
      </div>
    </div>
  );
}
