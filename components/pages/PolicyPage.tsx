import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { getPublishedPage } from "@/lib/db/queries/pages";
import { parsePageContent } from "@/lib/utils/page-blocks";
import { PAGE_CONFIG, PAGE_LOCALES, type PageKey } from "@/lib/utils/page-keys";
import { PageHero } from "@/components/pages/PageHero";
import { PageBlocks } from "@/components/pages/PageBlocks";
import { TocNav } from "@/components/pages/TocNav";
import { MobileToc } from "@/components/pages/MobileToc";
import { CareCard } from "@/components/pages/CareCard";
import { RelatedPages } from "@/components/pages/RelatedPages";
import { HelpBand } from "@/components/pages/HelpBand";
import { STICKY_TOP, ANCHOR_OFFSET } from "@/components/pages/offsets";

type Locale = (typeof PAGE_LOCALES)[number];

export async function PolicyPage({
  pageKey,
  locale,
}: {
  pageKey: PageKey;
  locale: Locale;
}) {
  const page = await getPublishedPage(pageKey, locale);
  if (!page) notFound();

  const { lead, blocks, sections, wordCount } = parsePageContent(page.content);
  const config = PAGE_CONFIG[pageKey];
  const alsoIn = page.authoredLocales.filter((l) => l !== page.resolvedLocale);

  const t = await getTranslations({ locale: page.resolvedLocale, namespace: "pages" });
  const format = await getFormatter({ locale: page.resolvedLocale });
  const lastUpdated = format.dateTime(page.updatedAt, {
    dateStyle: "long",
    timeZone: "Asia/Dubai",
  });

  const tocLabels = {
    title: t("toc.title"),
    sections: t("toc.sections", { count: sections.length }),
    backToTop: t("toc.backToTop"),
  };

  const dir = page.resolvedLocale === "ar" ? "rtl" : "ltr";

  return (
    <div id="top" style={{ scrollMarginTop: ANCHOR_OFFSET }}>
      <PageHero
        pageKey={pageKey}
        group={config.group}
        title={page.title}
        lead={lead}
        updatedAt={page.updatedAt}
        wordCount={wordCount}
        resolvedLocale={page.resolvedLocale}
        requestLocale={locale}
        alsoIn={alsoIn}
        fallback={page.fallback}
      />

      <div
        className="flex flex-col gap-8 px-6 py-10 lg:px-24 lg:py-24"
        style={{ background: "var(--color-auth-input-bg)" }}
      >
        <div className="contents lg:grid lg:grid-cols-[232px_minmax(0,1fr)_300px] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:self-start" style={{ top: STICKY_TOP }}>
            {sections.length >= 2 && (
              <>
                <TocNav sections={sections} labels={tocLabels} />
                <MobileToc
                  sections={sections}
                  labels={{ title: tocLabels.title, sections: tocLabels.sections }}
                />
              </>
            )}
          </div>

          <article lang={page.resolvedLocale} dir={dir}>
            <PageBlocks blocks={blocks} numbered={config.numbered} size="default" linkMode="locale" />
            <div
              style={{
                borderTop: "1px solid var(--color-shop-divider)",
                paddingTop: "24px",
                fontSize: "14px",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("meta.lastUpdated", { date: lastUpdated })}
            </div>
          </article>

          <aside className="flex flex-col" style={{ gap: "20px" }}>
            <CareCard />
            <RelatedPages current={pageKey} />
          </aside>
        </div>
      </div>

      <HelpBand />
    </div>
  );
}
