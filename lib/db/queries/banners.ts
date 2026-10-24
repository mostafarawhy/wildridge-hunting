import "server-only";
import { db } from "@/lib/db/client";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import {
  parseHomePopupStyle,
  resolvePopupCopy,
  type HomePopupStyle,
} from "@/lib/utils/home-popup";

export const POPUP_BANNER_ID = "BNR-HOME-POPUP";
export const HOME_POPUP_STYLE_KEY = "home_popup_style";

export interface ActivePopup {
  id: string;
  version: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  imageUrl: string;
  fallback: boolean;
}

export async function getPopupBanner() {
  return db.banner.findUnique({ where: { bannerId: POPUP_BANNER_ID } });
}

export async function getHomePopupStyle(): Promise<HomePopupStyle> {
  const row = await db.projectConfig.findUnique({
    where: { key: HOME_POPUP_STYLE_KEY },
    select: { value: true },
  });
  return parseHomePopupStyle(row?.value);
}

export async function getActivePopup(
  locale: string,
): Promise<ActivePopup | null> {
  const row = await getPopupBanner();
  if (!row || !row.isActive || !row.storageKey) return null;

  const now = new Date();
  if (row.startsAt && row.startsAt > now) return null;
  if (row.endsAt && row.endsAt < now) return null;

  const { title, subtitle, cta, fallback } = resolvePopupCopy(row, locale);

  return {
    id: row.bannerId,
    version: row.updatedAt.toISOString(),
    title: title ?? "",
    body: subtitle ?? "",
    cta: cta ?? "",
    href: row.linkUrl ?? "",
    imageUrl: getContentImageUrl(row.storageKey) ?? getImageUrl(row.storageKey),
    fallback,
  };
}
