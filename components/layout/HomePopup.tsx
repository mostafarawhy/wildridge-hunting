import { getLocale } from "next-intl/server";
import { getActivePopup, getHomePopupStyle } from "@/lib/db/queries/banners";
import HomePopupClient from "./HomePopupClient";

export default async function HomePopup() {
  const locale = await getLocale();
  const data = await getActivePopup(locale);
  if (!data) return null;
  const style = await getHomePopupStyle();
  return <HomePopupClient popup={data} style={style} />;
}
