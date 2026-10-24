import { Fragment } from "react";
import Image from "next/image";
import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PAGE_CONFIG, type PageGroup, type PageKey } from "@/lib/utils/page-keys";
import type { Inline } from "@/lib/utils/page-blocks";
import { PageInline } from "@/components/pages/PageInline";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { pageHeroUrl } from "@/lib/settings/site-banners";
import { focalPosition } from "@/lib/utils/focal-point";

type Locale = "en" | "ar" | "ru";

function mix(token: string, percent: number): string {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

const accent = "var(--color-accent)";
const white = "var(--primitive-white)";
const warning = "var(--color-status-warning)";
const crumbMuted = mix("--primitive-white", 70);
const leadColor = mix("--primitive-white", 85);
const fallbackColor = mix("--primitive-white", 85);
const flatOverlay = mix("--primitive-black", 62);

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={crumbMuted}
      strokeWidth="1.6"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

export async function PageHero({
  pageKey,
  group,
  title,
  lead,
  updatedAt,
  wordCount,
  resolvedLocale,
  requestLocale,
  alsoIn,
  fallback,
  centered = false,
  showMeta = true,
  children,
}: {
  pageKey: PageKey;
  group: PageGroup;
  title: string;
  lead: Inline[] | null;
  updatedAt: Date;
  wordCount: number;
  resolvedLocale: Locale;
  requestLocale: Locale;
  alsoIn: Locale[];
  fallback: boolean;
  centered?: boolean;
  showMeta?: boolean;
  children?: React.ReactNode;
}) {
  const t = await getTranslations({ locale: resolvedLocale, namespace: "pages" });
  const tRequest = await getTranslations({ locale: requestLocale, namespace: "pages" });
  const tFooterRequest = await getTranslations({ locale: requestLocale, namespace: "footer" });
  const format = await getFormatter({ locale: resolvedLocale });
  const { value: siteBanners } = await getSiteBanners();
  const imageSrc = pageHeroUrl(siteBanners, pageKey);
  const bannerFocus =
    pageKey === "stores" ? siteBanners.focus.storesHero : siteBanners.focus.pagesHero;

  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const lastUpdated = format.dateTime(updatedAt, {
    dateStyle: "long",
    timeZone: "Asia/Dubai",
  });

  const resolvedDir = resolvedLocale === "ar" ? "rtl" : "ltr";
  const requestDir = requestLocale === "ar" ? "rtl" : "ltr";

  const gradientAngle = requestDir === "rtl" ? "270deg" : "90deg";
  const gradientOverlay = `linear-gradient(${gradientAngle}, ${mix("--primitive-black", 85)} 0%, ${mix("--primitive-black", 55)} 50%, ${mix("--primitive-black", 20)} 100%)`;

  return (
    <div
      className="relative overflow-hidden px-6 pt-9 pb-14 lg:px-24"
      style={{
        background: "var(--primitive-black)",
        minHeight: "450px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: focalPosition(bannerFocus) }}
      />
      <div
        className="absolute inset-0"
        style={{ background: centered ? flatOverlay : gradientOverlay }}
      />

      <nav
        className="relative flex flex-wrap items-center gap-2"
        style={{ fontSize: "13px", color: crumbMuted }}
        lang={requestLocale}
        dir={requestDir}
      >
        <Link href="/" style={{ color: crumbMuted }}>
          {tRequest("breadcrumb.home")}
        </Link>
        <span>/</span>
        <span>{tRequest(`breadcrumb.${group}`)}</span>
        <span>/</span>
        <span style={{ color: white }}>
          {tFooterRequest(PAGE_CONFIG[pageKey].footerLeaf)}
        </span>
      </nav>

      <div
        className={`relative max-w-[760px] mt-10 flex flex-col gap-[18px] ${centered ? "mx-auto text-center items-center" : ""}`}
      >
        {fallback && (
          <p
            lang={requestLocale}
            dir={requestDir}
            style={{
              borderInlineStart: `3px solid ${warning}`,
              paddingInlineStart: "0.75rem",
              fontSize: "14px",
              color: fallbackColor,
            }}
          >
            {tRequest("meta.englishOnly")}
          </p>
        )}

        <div
          lang={resolvedLocale}
          dir={resolvedDir}
          className={`flex flex-col gap-[18px] w-full ${centered ? "items-center" : ""}`}
        >
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {t(`eyebrow.${group}`)}
          </p>

          <h1
            className="text-[40px] lg:text-[60px]"
            style={{
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: white,
            }}
          >
            {title}
          </h1>

          {lead && (
            <p
              className="text-[17px] lg:text-[19px]"
              style={{ lineHeight: 1.6, color: leadColor }}
            >
              <PageInline inlines={lead} linkMode="locale" />
            </p>
          )}

          {showMeta && (
            <div
              className={`flex flex-wrap items-center gap-2 ${centered ? "justify-center" : ""}`}
              style={{ fontSize: "14px", color: crumbMuted }}
            >
              <ClockIcon />
              <span>{t("meta.lastUpdated", { date: lastUpdated })}</span>
              <span>·</span>
              <span>{t("meta.readTime", { minutes: readTime })}</span>
              {alsoIn.length > 0 && (
                <>
                  <span>·</span>
                  <span>{t("meta.alsoIn")}</span>
                  {alsoIn.map((locale, i) => (
                    <Fragment key={locale}>
                      {i > 0 && <span>·</span>}
                      <Link
                        href={`/${pageKey}`}
                        locale={locale}
                        style={{ color: white, textDecoration: "underline" }}
                      >
                        {t(`languages.${locale}`)}
                      </Link>
                    </Fragment>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
