import { getLocale, getTranslations } from "next-intl/server";
import { getHomePage } from "@/lib/db/queries/home-page";
import { desertPhotoUrl, desertVideoUrl, resolveDesert } from "@/lib/settings/home-page";
import DesertBannerView from "./DesertBannerView";

export default async function DesertExperienceBanner() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const { value } = await getHomePage();
  const { text } = resolveDesert(value, locale);

  return (
    <DesertBannerView
      heading={text.heading}
      photoUrl={desertPhotoUrl(value)}
      videoUrl={desertVideoUrl(value)}
      pauseLabel={t("video_pause")}
      playLabel={t("video_play")}
    />
  );
}
