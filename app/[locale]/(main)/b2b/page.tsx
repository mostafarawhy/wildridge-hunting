import { redirect } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getCustomerB2BStatus } from "@/lib/db/queries/customer";
import Button from "@/components/ui/Button";
import { getSetting } from "@/lib/db/queries/settings";

const DOCUMENT_ORDER = [
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "COMPANY_ID",
] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "b2b.landing" });
  return { title: t("hero.headline") };
}

export default async function B2BLandingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("b2b.landing");
  const tRegister = await getTranslations("auth.b2bRegister");
  const b2bContent = await getSetting("b2b_content");
  const requiredDocuments = DOCUMENT_ORDER.filter((type) =>
    b2bContent.requiredTypes.includes(type),
  );
  const recommendedDocuments = DOCUMENT_ORDER.filter((type) =>
    b2bContent.recommendedTypes.includes(type),
  );
  const session = await auth();
  const b2bStatus = session?.user?.id
    ? await getCustomerB2BStatus(session.user.id)
    : null;

  if (b2bStatus?.status === "APPROVED") {
    redirect({ href: "/shop", locale });
  }

  const isLoggedOut = !session?.user?.id;
  const hasApplication = !!b2bStatus;

  const primaryHref = isLoggedOut
    ? `/auth/register?callbackUrl=/${locale}/auth/b2b-register`
    : hasApplication
      ? "/account/b2b"
      : "/auth/b2b-register";

  const primaryLabel = hasApplication
    ? t("panel.ctaViewApplication")
    : t("panel.ctaApply");

  const showSignInLink = isLoggedOut;

  return (
    <main className="lg:min-h-[calc(100dvh-var(--spacing-header))]">
      <div className="lg:grid lg:grid-cols-[45%_55%] lg:min-h-[calc(100dvh-var(--spacing-header))]">
        {/* HERO PANEL */}
        <section className="relative bg-neutral-900 h-[55vh] lg:h-auto overflow-hidden">
          <Image
           src="/images/b2b/hero.jpg"
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.75) 100%)",
            }}
          />
          <div className="relative h-full flex flex-col justify-end gap-6 p-8 lg:p-10 xl:p-14 text-white">
            <div className="flex flex-col gap-3 max-w-sm">
              <p
                className="text-[0.825rem] font-bold tracking-[0.18em] uppercase"
                style={{ color: "var(--primitive-white)" }}
              >
                {t("hero.eyebrow")}
              </p>
              <h1 className="text-[2.25rem] lg:text-[2.75rem] xl:text-[3.25rem] font-bold tracking-tight leading-[1.05]">
                {t("hero.headline")}
              </h1>
              <p className="text-[0.875rem] lg:text-[0.9375rem] leading-relaxed text-white/70">
                {t("hero.subtitle")}
              </p>
            </div>
            <p className="text-[0.625rem] tracking-[0.14em] uppercase text-white/35">
              {t("hero.footer")}
            </p>
          </div>
        </section>

        {/* CONTENT PANEL */}
        <section className="bg-white flex flex-col px-8 py-10 sm:px-12 sm:py-12 lg:px-14 xl:px-20 lg:py-12 xl:py-16">
          <div className="flex flex-col justify-between h-full gap-8">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-1.5">
                <p className="text-[0.625rem] font-black tracking-[0.2em] uppercase text-neutral-500">
                  {t("panel.wordmark")}
                </p>
                <h2 className="text-[1.625rem] lg:text-[1.875rem] xl:text-[2rem] font-bold tracking-tight leading-tight text-neutral-900">
                  {t("panel.title")}
                </h2>
              </div>

              <div className="flex flex-col gap-3">
                {(
                  t.raw("panel.steps.items") as Array<{
                    number: string;
                    text: string;
                  }>
                ).map((s) => (
                  <div key={s.number} className="flex items-start gap-4">
                    <span
                      className="flex items-center justify-center shrink-0 text-[0.625rem] font-bold tabular-nums"
                      style={{
                        color: "var(--color-action-primary)",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        border: "1px solid var(--color-border-action)",
                      }}
                    >
                      {s.number}
                    </span>
                    <span className="text-[0.9375rem] leading-snug text-neutral-600">
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-neutral-100" />

              <div className="grid grid-cols-2 gap-4">
                <div
                  className="flex flex-col gap-2.5 p-4"
                  style={{ border: "1px solid var(--color-shop-divider)" }}
                >
                  <p className="text-[0.5625rem] font-bold tracking-[0.16em] uppercase text-neutral-500">
                    {t("panel.whoCanApply.heading")}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {(t.raw("panel.whoCanApply.items") as string[]).map(
                      (item, i) => (
                        <li
                          key={i}
                          className="text-[0.875rem] leading-snug text-neutral-700"
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
                <div
                  className="flex flex-col gap-2.5 p-4"
                  style={{ border: "1px solid var(--color-shop-divider)" }}
                >
                  <p className="text-[0.5625rem] font-bold tracking-[0.16em] uppercase text-neutral-500">
                    {t("panel.benefits.heading")}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {(t.raw("panel.benefits.items") as string[]).map(
                      (item, i) => (
                        <li
                          key={i}
                          className="text-[0.875rem] leading-snug text-neutral-700"
                        >
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>

              <div
                className="flex flex-col gap-2.5"
                style={{
                  borderInlineStart: "3px solid var(--color-border-action)",
                  paddingInlineStart: "1rem",
                }}
              >
                <p className="text-[0.625rem] font-bold tracking-[0.14em] uppercase text-neutral-500">
                  {t("panel.documentsPopover.title")}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {requiredDocuments.map((type) => (
                    <li
                      key={type}
                      className="text-[0.8125rem] text-neutral-700 leading-snug"
                    >
                      {tRegister(`types.${type}`)}
                    </li>
                  ))}
                  {recommendedDocuments.map((type) => (
                    <li
                      key={type}
                      className="text-[0.8125rem] text-neutral-700 leading-snug flex flex-wrap items-baseline gap-2"
                    >
                      <span>{tRegister(`types.${type}`)}</span>
                      <span className="text-[0.625rem] font-bold tracking-[0.14em] uppercase text-neutral-500">
                        {tRegister("checklist.recommended")}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[0.6875rem] text-neutral-500 leading-relaxed pt-2 border-t border-neutral-100">
                  {t("panel.documentsPopover.note")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link href={primaryHref}>
                <Button variant="primary" size="lg" fullWidth>
                  {primaryLabel}
                </Button>
              </Link>
              {showSignInLink && (
                <Link
                  href="/auth/login?callbackUrl=/shop"
                  className="text-[0.875rem] text-center text-neutral-500 hover:text-neutral-900 transition-colors py-1"
                >
                  {t("panel.signInLink")}
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
