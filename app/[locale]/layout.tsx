import { BRAND, BRAND_COLORS } from "@/lib/config/brand";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import DemoBanner from "@/components/layout/DemoBanner";
import { Suspense } from "react";
import NavigationProgress from "@/components/loading/NavigationProgress";
import MotionProvider from "@/components/ui/MotionProvider";

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.navbar,
  viewportFit: "cover",
};

const LOCALES = ["en", "ar", "ru"] as const;
type Locale = (typeof LOCALES)[number];

const DIR_MAP: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  ru: "ltr",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!LOCALES.includes(locale as Locale)) {
    notFound();
  }

  const safeLocale = locale as Locale;
  const dir = DIR_MAP[safeLocale];
  const allMessages = await getMessages();
  const tDemo = await getTranslations({ locale: safeLocale, namespace: "demo" });
  const messages = Object.fromEntries(
    Object.entries(allMessages).filter(([namespace]) => namespace !== "email"),
  );

  return (
    <html
      lang={safeLocale}
      dir={dir}
      data-surface="storefront"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <NextIntlClientProvider locale={safeLocale} messages={messages}>
          <MotionProvider>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <DemoBanner message={tDemo("banner")} />
            {children}
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
