import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPublishedPage, pageMetadata } from "@/lib/db/queries/pages";
import { getAboutFigureCounts, getAboutPage } from "@/lib/db/queries/about-page";
import { getPrimaryStore } from "@/lib/db/queries/stores";
import { parsePageContent } from "@/lib/utils/page-blocks";
import { PAGE_CONFIG } from "@/lib/utils/page-keys";
import { Link } from "@/i18n/navigation";
import { getContentImageUrl, getImageUrl } from "@/lib/utils/images";
import { toAboutView } from "@/lib/utils/about-view";
import { isAboutLocaleComplete } from "@/lib/settings/about-page";
import { PageHero } from "@/components/pages/PageHero";
import { StoreBlock } from "@/components/pages/StoreBlock";
import AboutSectionsView from "@/components/pages/AboutSectionsView";

type Locale = "en" | "ar" | "ru";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

const container = "mx-auto px-6 lg:px-24";
const containerStyle: CSSProperties = { maxWidth: "1280px" };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("about", locale as Locale);
}

export default async function Page({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const page = await getPublishedPage("about", locale);
  if (!page) notFound();

  const { lead } = parsePageContent(page.content);
  const [{ value }, counts] = await Promise.all([getAboutPage(), getAboutFigureCounts()]);

  const bodyLocale: Locale = page.fallback
    ? "en"
    : isAboutLocaleComplete(value, locale)
      ? locale
      : "en";
  const bodyFallback = !page.fallback && bodyLocale !== locale;

  const t = await getTranslations({ locale: bodyLocale, namespace: "pages.about" });
  const tShop = await getTranslations({ locale: bodyLocale, namespace: "shop" });
  const tRequest = await getTranslations({ locale, namespace: "pages" });

  const view = toAboutView(value, bodyLocale, {
    urlOf: (key) => getContentImageUrl(key) ?? getImageUrl(key),
    counts,
  });

  const primary = view.visit ? await getPrimaryStore() : null;
  const alsoIn = page.authoredLocales.filter((l) => l !== page.resolvedLocale);

  return (
    <div>
      <PageHero
        pageKey="about"
        group={PAGE_CONFIG.about.group}
        title={page.title}
        lead={lead}
        updatedAt={page.updatedAt}
        wordCount={0}
        resolvedLocale={page.resolvedLocale}
        requestLocale={locale}
        alsoIn={alsoIn}
        fallback={page.fallback}
        showMeta={false}
      />

      {bodyFallback && (
        <div style={{ background: "var(--color-auth-input-bg)" }}>
          <div className={`${container} pt-10`} style={containerStyle}>
            <p
              lang={locale}
              dir={locale === "ar" ? "rtl" : "ltr"}
              style={{
                borderInlineStart: "3px solid var(--color-status-warning)",
                paddingInlineStart: "0.75rem",
                fontSize: "14px",
                color: "var(--color-auth-label-text)",
              }}
            >
              {tRequest("meta.englishOnly")}
            </p>
          </div>
        </div>
      )}

      <AboutSectionsView
        view={view}
        locale={bodyLocale}
        labels={{
          visitEyebrow: t("visitEyebrow"),
          visitTitle: t("visitTitle"),
          close: tShop("close"),
          previous: t("photoPrevious"),
          next: t("photoNext"),
          photoLabel: t("photoLabel"),
        }}
        visitSlot={
          primary ? <StoreBlock store={primary} locale={bodyLocale} compact /> : undefined
        }
        contactSlot={
          <Link
            href="/contact"
            className="btn-link btn-link--outline btn-link--md"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            {t("contactCta")}
            <ArrowRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />
          </Link>
        }
      />
    </div>
  );
}
