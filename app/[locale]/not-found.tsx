import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export { default } from "./(main)/not-found";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errorPage.notFound");
  return { title: t("title") };
}
