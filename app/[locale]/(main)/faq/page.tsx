import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/db/queries/pages";
import { FaqPage } from "@/components/pages/FaqPage";

type Locale = "en" | "ar" | "ru";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("faq", locale as Locale);
}

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { q } = await searchParams;
  const initialQuery =
    typeof q === "string" ? q.trim().slice(0, 80) || undefined : undefined;
  setRequestLocale(locale);
  return <FaqPage locale={locale as Locale} initialQuery={initialQuery} />;
}
