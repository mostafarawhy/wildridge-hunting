import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublishedPage } from "@/lib/db/queries/pages";
import { parsePageContent } from "@/lib/utils/page-blocks";
import { PAGE_CONFIG, PAGE_LOCALES } from "@/lib/utils/page-keys";
import { getActiveStores } from "@/lib/db/queries/stores";
import { PageHero } from "@/components/pages/PageHero";
import { PageBlocks } from "@/components/pages/PageBlocks";
import { StoreBlock } from "@/components/pages/StoreBlock";
import { HelpBand } from "@/components/pages/HelpBand";

type Locale = (typeof PAGE_LOCALES)[number];

const muted = "var(--color-content-tertiary)";

export async function StoreLocatorPage({ locale }: { locale: Locale }) {
  const page = await getPublishedPage("stores", locale);
  if (!page) notFound();

  const { lead, blocks, wordCount } = parsePageContent(page.content);
  const config = PAGE_CONFIG.stores;
  const alsoIn = page.authoredLocales.filter((l) => l !== page.resolvedLocale);

  const t = await getTranslations({ locale: page.resolvedLocale, namespace: "pages" });
  const dir = page.resolvedLocale === "ar" ? "rtl" : "ltr";

  const stores = await getActiveStores();

  return (
    <div>
      <PageHero
        pageKey="stores"
        group={config.group}
        title={page.title}
        lead={lead}
        updatedAt={page.updatedAt}
        wordCount={wordCount}
        resolvedLocale={page.resolvedLocale}
        requestLocale={locale}
        alsoIn={alsoIn}
        fallback={page.fallback}
        showMeta={false}
      />

      <div
        className="flex flex-col px-6 py-12 lg:px-24 lg:py-20"
        style={{ background: "var(--color-auth-input-bg)", gap: "64px" }}
      >
        <article lang={page.resolvedLocale} dir={dir} style={{ maxWidth: "760px" }}>
          <PageBlocks blocks={blocks} numbered={false} size="default" linkMode="locale" />
        </article>

        {stores.length > 0 ? (
          <div className="flex flex-col" style={{ gap: "24px" }}>
            {stores.map((store) => (
              <StoreBlock key={store.id} store={store} locale={page.resolvedLocale} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "16px", color: muted }}>{t("stores.empty")}</p>
        )}
      </div>

      <HelpBand />
    </div>
  );
}
