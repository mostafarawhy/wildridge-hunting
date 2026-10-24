import "server-only";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { readSiteBanners } from "@/lib/settings/site-banners";

export const getSiteBanners = cache(async () => {
  const row = await db.projectConfig.findUnique({
    where: { key: "site_banners" },
    select: { value: true, updatedAt: true },
  });
  return {
    ...readSiteBanners(row?.value),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
});
