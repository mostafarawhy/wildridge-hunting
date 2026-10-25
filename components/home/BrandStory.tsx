import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getHomePage } from "@/lib/db/queries/home-page";
import { resolveStory, storyPhotoUrl, storyVideoUrl } from "@/lib/settings/home-page";
import BrandStoryView from "./BrandStoryView";

export default async function BrandStory() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const { value } = await getHomePage();
  const { text } = resolveStory(value, locale);

  return (
    <BrandStoryView
      eyebrow={text.eyebrow}
      heading={text.heading}
      body={text.body}
      buttonLabel={text.buttonLabel}
      buttonHref={value.story.buttonHref}
      photoUrl={storyPhotoUrl(value)}
      videoUrl={storyVideoUrl(value)}
      pauseLabel={t("video_pause")}
      playLabel={t("video_play")}
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
