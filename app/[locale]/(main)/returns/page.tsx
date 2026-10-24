import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/db/queries/pages";
import { PolicyPage } from "@/components/pages/PolicyPage";

type Locale = "en" | "ar" | "ru";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("returns", locale as Locale);
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PolicyPage pageKey="returns" locale={locale as Locale} />;
}
