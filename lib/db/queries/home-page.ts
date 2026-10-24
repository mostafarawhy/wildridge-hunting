import "server-only";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { homeBuiltIn, readHomePage } from "@/lib/settings/home-page";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import ru from "@/messages/ru.json";

export const getHomePage = cache(async () => {
  const row = await db.projectConfig.findUnique({
    where: { key: "home_page" },
    select: { value: true, updatedAt: true },
  });
  return {
    ...readHomePage(row?.value, homeBuiltIn({ en, ar, ru })),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
});
