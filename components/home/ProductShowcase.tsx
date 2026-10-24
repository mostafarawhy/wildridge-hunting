import { Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getHomePage } from "@/lib/db/queries/home-page";
import {
  HOME_BUILTIN_MEDIA,
  resolveShowcase,
  showcasePhotoUrl,
} from "@/lib/settings/home-page";
import ShowcaseView from "./ShowcaseView";

export default async function ProductShowcase() {
  const locale = await getLocale();
  const { value } = await getHomePage();
  const { text } = resolveShowcase(value, locale);

  return (
    <ShowcaseView
      eyebrow={text.eyebrow}
      heading={text.heading}
      body={text.body}
      primaryLabel={text.primaryLabel}
      primaryHref={value.showcase.primaryHref}
      secondaryLabel={text.secondaryLabel}
      secondaryHref={value.showcase.secondaryHref}
      photoUrl={showcasePhotoUrl(value) ?? HOME_BUILTIN_MEDIA.showcase}
      photoAlt={text.photoAlt}
      flip={locale === "ar" && value.showcase.photo === null}
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
