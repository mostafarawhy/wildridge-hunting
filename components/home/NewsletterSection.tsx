import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/db/queries/settings";
import { getHomePage } from "@/lib/db/queries/home-page";
import {
  HOME_BUILTIN_MEDIA,
  newsletterPhotoUrl,
  resolveNewsletter,
} from "@/lib/settings/home-page";
import NewsletterForm from "@/components/home/NewsletterForm";
import NewsletterBandView from "./NewsletterBandView";

export default async function NewsletterSection() {
  const [t, tFooter, profile, locale, { value }] = await Promise.all([
    getTranslations("home"),
    getTranslations("footer"),
    getSetting("store_profile"),
    getLocale(),
    getHomePage(),
  ]);
  const { text } = resolveNewsletter(value, locale);

  const digits = profile.contactPhone.replace(/\D/g, "");
  const socials = [
    {
      key: "instagram" as const,
      href: profile.instagramUrl,
      ariaLabel: tFooter("aria_instagram"),
    },
    {
      key: "whatsapp" as const,
      href: digits ? `https://wa.me/${digits}` : "",
      ariaLabel: tFooter("aria_whatsapp"),
    },
    {
      key: "youtube" as const,
      href: profile.youtubeUrl,
      ariaLabel: tFooter("aria_youtube"),
    },
  ].filter((social) => social.href);

  return (
    <NewsletterBandView
      heading={text.heading}
      body={text.body}
      photoUrl={newsletterPhotoUrl(value) ?? HOME_BUILTIN_MEDIA.newsletter}
      socials={socials}
      form={<NewsletterForm source="HOME" />}
      legalPrefix={t("newsletter_legal_prefix")}
      legalLinkLabel={t("newsletter_legal_link")}
      legalSuffix={t("newsletter_legal_suffix")}
      link={(p) => (
        <Link
          href={p.href}
          className={p.className}
          style={p.style}
          aria-label={p.ariaLabel}
        >
          {p.children}
        </Link>
      )}
    />
  );
}
