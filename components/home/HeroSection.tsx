import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getHomePage } from "@/lib/db/queries/home-page";
import { heroPhotoUrl, resolveHero } from "@/lib/settings/home-page";
import HeroView from "./HeroView";

export default async function HeroSection() {
  const locale = await getLocale();
  const { value } = await getHomePage();
  const { text } = resolveHero(value, locale);

  return (
    <HeroView
      photoUrl={heroPhotoUrl(value)}
      photoAlt={text.photoAlt}
      eyebrow={text.eyebrow}
      heading={text.heading}
      primaryLabel={text.primaryLabel}
      primaryHref={value.hero.primaryHref}
      secondaryLabel={text.secondaryLabel}
      secondaryHref={value.hero.secondaryHref}
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
