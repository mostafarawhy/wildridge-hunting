import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublishedPage } from "@/lib/db/queries/pages";
import { parsePageContent, parseFaqContent } from "@/lib/utils/page-blocks";
import { PAGE_CONFIG, PAGE_LOCALES } from "@/lib/utils/page-keys";
import { getSetting } from "@/lib/db/queries/settings";
import { Link } from "@/i18n/navigation";
import { PageHero } from "@/components/pages/PageHero";
import { FaqBrowser } from "@/components/pages/FaqBrowser";
import { FaqSearchProvider, FaqSearchInput } from "@/components/pages/FaqSearch";
import { FaqTiles } from "@/components/pages/FaqTiles";
import { RelatedPages } from "@/components/pages/RelatedPages";

type Locale = (typeof PAGE_LOCALES)[number];

export async function FaqPage({
  locale,
  initialQuery,
}: {
  locale: Locale;
  initialQuery?: string;
}) {
  const page = await getPublishedPage("faq", locale);
  if (!page) notFound();

  const { lead, wordCount } = parsePageContent(page.content);
  const { groups } = parseFaqContent(page.content);
  const config = PAGE_CONFIG.faq;
  const alsoIn = page.authoredLocales.filter((l) => l !== page.resolvedLocale);

  const t = await getTranslations({ locale: page.resolvedLocale, namespace: "pages" });
  const tRaw = await getTranslations({ locale: page.resolvedLocale, namespace: "pages.faq" });
  const profile = await getSetting("store_profile");

  const labels = {
    resultsCount: tRaw.raw("resultsCount") as string,
    searchSummary: tRaw.raw("searchSummary") as string,
    noResultsFor: tRaw.raw("noResultsFor") as string,
    showResults: tRaw.raw("showResults") as string,
    clear: tRaw.raw("clear") as string,
    questionCount: tRaw.raw("questionCount") as string,
    locale: page.resolvedLocale,
  };

  const titledGroups = groups.filter((group) => group.title.trim() !== "");
  const tiles = titledGroups.map((group) => ({
    id: group.id,
    title: group.title,
    countLabel: t("faq.questionCount", { count: group.questions.length }),
  }));

  return (
    <FaqSearchProvider groups={groups} labels={labels} initialQuery={initialQuery}>
      <div>
        <PageHero
          pageKey="faq"
          group={config.group}
          title={page.title}
          lead={lead}
          updatedAt={page.updatedAt}
          wordCount={wordCount}
          resolvedLocale={page.resolvedLocale}
          requestLocale={locale}
          alsoIn={alsoIn}
          fallback={page.fallback}
          centered
          showMeta={false}
        >
          <FaqSearchInput label={t("faq.searchLabel")} placeholder={t("faq.searchPlaceholder")} />
        </PageHero>

        <FaqTiles tiles={tiles} />

        <div
          className="grid grid-cols-1 gap-14 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-[72px] lg:px-24 lg:pb-24 lg:pt-[72px]"
          style={{ background: "var(--color-auth-input-bg)" }}
        >
          <FaqBrowser />

          <aside className="flex flex-col" style={{ gap: "24px" }}>
            <div
              className="flex flex-col"
              style={{
                background: "var(--color-auth-form-bg)",
                border: "1px solid var(--color-shop-divider)",
                padding: "28px",
                gap: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--color-action-primary)",
                }}
              >
                {t("faq.talkEyebrow")}
              </p>
              <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--primitive-black)" }}>
                {t("faq.talkTitle")}
              </p>
              <p style={{ fontSize: "15px", color: "var(--color-content-tertiary)" }}>{t("faq.talkBody")}</p>

              {profile.contactPhone && (
                <a
                  href={`https://wa.me/${profile.contactPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center"
                  style={{
                    height: "48px",
                    background: "var(--color-action-primary)",
                    color: "var(--color-action-primary-fg)",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {t("faq.talkWhatsapp")}
                </a>
              )}

              <Link
                href="/contact"
                className="text-center"
                style={{ fontSize: "13px", color: "var(--primitive-black)", textDecoration: "underline" }}
              >
                {t("faq.talkAll")}
              </Link>
            </div>

            <RelatedPages current="faq" title={t("faq.policies")} />
          </aside>
        </div>
      </div>
    </FaqSearchProvider>
  );
}
