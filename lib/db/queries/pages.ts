import "server-only";
import type { Metadata } from "next";
import { db } from "@/lib/db/client";
import type { Page } from "@/app/generated/prisma/client";
import { PAGE_KEYS, PAGE_LOCALES, type PageKey } from "@/lib/utils/page-keys";

type Locale = (typeof PAGE_LOCALES)[number];

export type PublishedPage = {
  key: PageKey;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  resolvedLocale: Locale;
  fallback: boolean;
  updatedAt: Date;
  authoredLocales: Locale[];
};

function titleOf(row: Page, locale: Locale): string {
  if (locale === "en") return row.titleEn;
  if (locale === "ar") return row.titleAr;
  return row.titleRu ?? "";
}

function contentOf(row: Page, locale: Locale): string | null {
  if (locale === "en") return row.contentEn;
  if (locale === "ar") return row.contentAr;
  return row.contentRu;
}

function metaTitleOf(row: Page, locale: Locale): string | null {
  if (locale === "en") return row.metaTitleEn;
  if (locale === "ar") return row.metaTitleAr;
  return row.metaTitleRu;
}

function metaDescriptionOf(row: Page, locale: Locale): string | null {
  if (locale === "en") return row.metaDescriptionEn;
  if (locale === "ar") return row.metaDescriptionAr;
  return row.metaDescriptionRu;
}

function isAuthored(row: Page, locale: Locale): boolean {
  return titleOf(row, locale).trim().length > 0 && !!contentOf(row, locale)?.trim().length;
}

export async function getPublishedPage(
  key: PageKey,
  locale: Locale,
): Promise<PublishedPage | null> {
  const row = await db.page.findUnique({ where: { key } });
  if (!row || !row.isActive) return null;

  const authoredLocales = PAGE_LOCALES.filter((l) => isAuthored(row, l));
  if (!authoredLocales.includes("en")) return null;

  const requestedAuthored = authoredLocales.includes(locale);
  const resolvedLocale: Locale = requestedAuthored ? locale : "en";

  return {
    key,
    title: titleOf(row, resolvedLocale),
    content: contentOf(row, resolvedLocale) ?? "",
    metaTitle: metaTitleOf(row, resolvedLocale),
    metaDescription: metaDescriptionOf(row, resolvedLocale),
    resolvedLocale,
    fallback: !requestedAuthored,
    updatedAt: row.updatedAt,
    authoredLocales,
  };
}

export async function pageMetadata(key: PageKey, locale: Locale): Promise<Metadata> {
  const page = await getPublishedPage(key, locale);
  if (!page) return {};

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export async function listPublishedPageKeys(): Promise<PageKey[]> {
  const rows = await db.page.findMany({
    where: { key: { in: [...PAGE_KEYS] }, isActive: true },
  });
  const published = new Set(
    rows.filter((row) => isAuthored(row, "en")).map((row) => row.key as PageKey),
  );
  return PAGE_KEYS.filter((key) => published.has(key));
}
