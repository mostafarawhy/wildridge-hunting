import Image from "next/image";
import { getLocale } from "next-intl/server";
import LoadingRegion from "@/components/loading/LoadingRegion";
import Skeleton from "@/components/ui/Skeleton";
import { HelpBand } from "@/components/pages/HelpBand";
import { STICKY_TOP } from "@/components/pages/offsets";
import { getSiteBanners } from "@/lib/db/queries/site-banners";
import { pagesHeroUrl, storesHeroUrl } from "@/lib/settings/site-banners";
import { focalPosition, type FocalPoint } from "@/lib/utils/focal-point";

type Variant = "policy" | "faq" | "contact" | "editorial" | "stores";

const ink = "var(--primitive-black)";
const hairline = "var(--color-shop-divider)";
const red = "var(--color-action-primary)";
const warmBand = "var(--color-auth-form-bg)";
const stone = "var(--color-auth-form-bg)";
const paper = "var(--color-auth-input-bg)";
const inputBorder = "var(--color-auth-input-border)";

const container = "mx-auto px-6 lg:px-24";
const containerStyle = { maxWidth: "1280px" };
const twoColumn = "grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16";

const HERO: Record<Variant, { centered: boolean; showMeta: boolean; search: boolean }> = {
  policy: { centered: false, showMeta: true, search: false },
  faq: { centered: true, showMeta: false, search: true },
  contact: { centered: false, showMeta: false, search: false },
  editorial: { centered: false, showMeta: true, search: false },
  stores: { centered: false, showMeta: false, search: false },
};

function mix(token: string, percent: number): string {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

const crumbMuted = mix("--primitive-white", 70);
const flatOverlay = mix("--primitive-black", 62);

function HeroSkeleton({
  variant,
  locale,
  imageSrc,
  focus,
}: {
  variant: Variant;
  locale: string;
  imageSrc: string;
  focus?: FocalPoint;
}) {
  const { centered, showMeta, search } = HERO[variant];
  const gradientAngle = locale === "ar" ? "270deg" : "90deg";
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
        fetchPriority="high"
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: focalPosition(focus ?? { x: 50, y: 50 }) }}
      />
      <div
        className="absolute inset-0"
        style={{ background: centered ? flatOverlay : gradientOverlay }}
      />

      <div
        className="relative flex flex-wrap items-center gap-2"
        style={{ fontSize: "13px", color: crumbMuted }}
      >
        <Skeleton.Text tone="dark" width="3rem" />
        <Skeleton.Text tone="dark" width="5rem" />
        <Skeleton.Text tone="dark" width="6rem" />
      </div>

      <div
        className={`relative max-w-[760px] mt-10 flex flex-col gap-[18px] ${centered ? "mx-auto text-center items-center" : ""}`}
      >
        <div className={`flex flex-col gap-[18px] w-full ${centered ? "items-center" : ""}`}>
          <Skeleton.Text tone="dark" width="6rem" />

          <div className={`flex flex-col gap-3 w-full ${centered ? "items-center" : ""}`}>
            {centered ? (
              <Skeleton.Block tone="dark" height="3rem" width="50%" />
            ) : (
              <>
                <Skeleton.Block tone="dark" height="3rem" width="60%" />
                <Skeleton.Block tone="dark" height="3rem" width="40%" />
              </>
            )}
          </div>

          <div className={`flex flex-col gap-2 w-full ${centered ? "items-center" : ""}`}>
            <Skeleton.Text tone="dark" width="70%" />
            <Skeleton.Text tone="dark" width="55%" />
          </div>

          {showMeta && <Skeleton.Text tone="dark" width="45%" />}
        </div>

        {search && (
          <div className="w-full" style={{ maxWidth: "680px", marginTop: "36px" }}>
            <div
              className="flex items-center gap-3"
              style={{
                height: "60px",
                background: "var(--color-auth-input-bg)",
                border: `1px solid ${inputBorder}`,
                padding: "0 20px",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedPagesSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton.Text width="40%" className="mb-2" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between"
          style={{
            padding: "10px 0",
            borderBottom: i === 3 ? "none" : "1px solid #f0ece7",
          }}
        >
          <Skeleton.Text width="55%" />
        </div>
      ))}
    </div>
  );
}

function StoreBlockSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      style={{ border: `1px solid ${hairline}` }}
    >
      <div
        className="flex flex-col"
        style={{ padding: compact ? "32px" : "48px", gap: "16px" }}
      >
        <Skeleton.Text width="30%" />
        <Skeleton.Block height="2rem" width="60%" />
        <Skeleton.Text width="75%" />
        <Skeleton.Text width="50%" />
        <div>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "24px",
                padding: "10px 0",
                borderBottom: i === 1 ? "none" : `1px solid ${hairline}`,
              }}
            >
              <Skeleton.Text width="35%" />
              <Skeleton.Text width="25%" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton.Block
        height="100%"
        className={compact ? "min-h-[280px]" : "min-h-[460px]"}
      />
    </div>
  );
}

function PolicyBody() {
  return (
    <>
      <div
        className="flex flex-col gap-8 px-6 py-10 lg:px-24 lg:py-24"
        style={{ background: "var(--color-auth-input-bg)" }}
      >
        <div className="contents lg:grid lg:grid-cols-[232px_minmax(0,1fr)_300px] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:self-start" style={{ top: STICKY_TOP }}>
            <div className="hidden lg:flex flex-col">
              <Skeleton.Text width="50%" className="mb-3" />
              <ul style={{ borderInlineStart: `1px solid ${hairline}` }}>
                {["80%", "65%", "90%", "70%", "75%"].map((width, i) => (
                  <li
                    key={i}
                    style={{ paddingInlineStart: "16px", paddingBlock: "6px" }}
                  >
                    <Skeleton.Text width={width} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <article>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3 mb-10">
                <Skeleton.Block height="1.5rem" width="45%" className="mb-2" />
                <Skeleton.Text width="100%" />
                <Skeleton.Text width="96%" />
                <Skeleton.Text width="90%" />
                <Skeleton.Text width="70%" />
              </div>
            ))}
          </article>

          <aside className="flex flex-col" style={{ gap: "20px" }}>
            <div
              className="flex flex-col"
              style={{ border: `1px solid ${hairline}`, padding: "24px", gap: "18px" }}
            >
              <div className="flex flex-col gap-2">
                <Skeleton.Text width="35%" />
                <Skeleton.Block height="1.25rem" width="70%" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton.Block height="40px" width="40px" className="flex-shrink-0" />
                  <div className="flex flex-col gap-2 flex-1">
                    <Skeleton.Text width="45%" />
                    <Skeleton.Text width="70%" />
                  </div>
                </div>
              ))}
              <Skeleton.Text width="40%" />
            </div>

            <RelatedPagesSkeleton />
          </aside>
        </div>
      </div>

      <HelpBand />
    </>
  );
}

function FaqBody() {
  return (
    <>
      <section
        className="px-6 pt-10 lg:px-24 lg:pt-16"
        style={{ background: "var(--color-auth-input-bg)" }}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${hairline}`,
                borderInlineStart: i === 0 ? `3px solid ${red}` : `1px solid ${hairline}`,
                padding: "28px",
              }}
            >
              <Skeleton.Text width="60%" />
              <Skeleton.Text width="30%" className="mt-3" />
            </div>
          ))}
        </div>
      </section>

      <div
        className="grid grid-cols-1 gap-14 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-[72px] lg:px-24 lg:pb-24 lg:pt-[72px]"
        style={{ background: "var(--color-auth-input-bg)" }}
      >
        <div className="flex flex-col">
          <div style={{ marginTop: "56px" }}>
            <div
              className="flex items-center justify-between"
              style={{
                borderBottom: `2px solid ${ink}`,
                paddingBottom: "16px",
              }}
            >
              <Skeleton.Block height="1.75rem" width="40%" />
            </div>

            {["70%", "60%", "75%", "55%", "65%"].map((width, i) => (
              <div
                key={i}
                className="flex items-center justify-between"
                style={{
                  borderBottom: `1px solid ${hairline}`,
                  padding: "24px 0",
                }}
              >
                <Skeleton.Text width={width} />
                <Skeleton.Block height="0.75rem" width="0.75rem" className="flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

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
            <Skeleton.Text width="40%" />
            <Skeleton.Block height="1.5rem" width="70%" />
            <Skeleton.Text width="100%" />
            <Skeleton.Text width="80%" />
            <Skeleton.Block height="48px" />
          </div>

          <RelatedPagesSkeleton />
        </aside>
      </div>
    </>
  );
}

function ContactBody() {
  return (
    <div
      className="flex flex-col px-6 py-12 lg:px-24 lg:py-20"
      style={{ background: "var(--color-auth-input-bg)", gap: "64px" }}
    >
      <div>
        <Skeleton.Text width="6rem" />
        <Skeleton.Block height="2.25rem" width="40%" className="mt-2" />
        <div className="flex flex-col gap-2 mt-3" style={{ maxWidth: "640px" }}>
          <Skeleton.Text width="100%" />
          <Skeleton.Text width="70%" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ marginTop: "32px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col"
              style={{
                background: "var(--color-auth-input-bg)",
                border: `1px solid ${hairline}`,
                padding: "32px",
                gap: "16px",
              }}
            >
              <Skeleton.Block height="48px" width="48px" />
              <Skeleton.Block height="1.5rem" width="60%" />
              <Skeleton.Text width="100%" />
              <Skeleton.Text width="80%" />
              <div style={{ flex: 1 }} />
              <div style={{ height: "52px", border: `1px solid ${ink}` }} />
              <Skeleton.Text width="45%" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: "20px" }}>
          <Skeleton.Block height="14px" width="14px" className="flex-shrink-0" />
          <Skeleton.Text width="40%" />
        </div>
      </div>

      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--color-auth-input-bg)", border: `1px solid ${hairline}`, padding: "28px" }}
      >
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton.Block height="1.5rem" width="45%" />
          <Skeleton.Text width="70%" />
        </div>
        <div
          style={{
            height: "48px",
            width: "12rem",
            border: `1px solid ${red}`,
            flexShrink: 0,
          }}
        />
      </div>

      <div>
        <Skeleton.Block height="1.75rem" width="30%" />
        <div
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4"
          style={{ marginTop: "24px" }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col"
              style={{
                background: "var(--color-auth-input-bg)",
                border: `1px solid ${hairline}`,
                padding: "28px",
                gap: "14px",
              }}
            >
              <Skeleton.Block height="48px" width="48px" />
              <Skeleton.Block height="1.25rem" width="55%" />
              <Skeleton.Text width="90%" />
              <Skeleton.Text width="60%" />
              <Skeleton.Text width="45%" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <StoreBlockSkeleton />
        <Skeleton.Text width="7rem" className="mt-4" />
      </div>

      <article className="flex flex-col gap-3" style={{ maxWidth: "760px" }}>
        <Skeleton.Text width="60%" />
        <Skeleton.Text width="45%" />
      </article>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex flex-col" style={{ width: "320px", flexShrink: 0, gap: "8px" }}>
          <Skeleton.Text width="6rem" />
          <Skeleton.Block height="1.75rem" width="70%" />
          <Skeleton.Text width="40%" />
        </div>
        <div className="flex-1">
          {["65%", "55%", "70%"].map((width, i) => (
            <div
              key={i}
              className="flex items-center justify-between"
              style={{
                padding: "20px 0",
                borderBottom: i === 2 ? "none" : `1px solid ${hairline}`,
              }}
            >
              <Skeleton.Text width={width} />
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between lg:py-9 lg:px-10"
        style={{ background: warmBand, border: `1px solid ${hairline}` }}
      >
        <div className="flex flex-col flex-1">
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "var(--color-auth-input-bg)",
              border: `1px solid ${hairline}`,
            }}
          />
          <Skeleton.Block height="1.5rem" width="45%" className="mt-4" />
          <Skeleton.Text width="65%" className="mt-2" />
        </div>
        <div
          style={{
            height: "3rem",
            width: "12rem",
            border: `1px solid ${hairline}`,
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );
}

function EditorialText({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton.Text width="6rem" />
      <Skeleton.Block height="2rem" width="55%" className="mb-3" />
      {lines.map((width, i) => (
        <Skeleton.Text key={i} width={width} />
      ))}
    </div>
  );
}

function EditorialBand({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background }}>
      <div className={`${container} py-14 lg:py-24`} style={containerStyle}>
        {children}
      </div>
    </section>
  );
}

function EditorialBody() {
  return (
    <div>
      <EditorialBand background={paper}>
        <div className={twoColumn}>
          <EditorialText lines={["100%", "96%", "88%", "60%"]} />
          <Skeleton.Image aspectRatio="4/3" />
        </div>
      </EditorialBand>

      <EditorialBand background={stone}>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3 px-6 py-10">
              <Skeleton.Block height="24px" width="24px" />
              <Skeleton.Block height="2.5rem" width="50%" />
              <Skeleton.Text width="70%" />
            </div>
          ))}
        </div>
      </EditorialBand>

      <EditorialBand background={paper}>
        <div className={twoColumn}>
          <Skeleton.Image aspectRatio="4/3" className="order-2 lg:order-first" />
          <div className="order-1 lg:order-none">
            <EditorialText lines={["100%", "80%"]} />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" style={{ marginTop: "28px" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton.Block height="22px" width="22px" />
                  <Skeleton.Text width="60%" />
                  <Skeleton.Text width="90%" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </EditorialBand>

      <EditorialBand background={stone}>
        <div className={twoColumn}>
          <EditorialText lines={["100%", "94%", "100%", "70%"]} />
          <Skeleton.Image aspectRatio="4/3" />
        </div>
      </EditorialBand>

      <EditorialBand background={paper}>
        <Skeleton.Text width="6rem" />
        <Skeleton.Block height="1.75rem" width="40%" className="mt-2" />
        <div style={{ marginTop: "32px" }}>
          <StoreBlockSkeleton compact />
        </div>
      </EditorialBand>
    </div>
  );
}

function StoresBody() {
  return (
    <>
      <div
        className="flex flex-col px-6 py-12 lg:px-24 lg:py-20"
        style={{ background: "var(--color-auth-input-bg)", gap: "64px" }}
      >
        <article className="flex flex-col gap-3" style={{ maxWidth: "760px" }}>
          <Skeleton.Text width="60%" />
          <Skeleton.Text width="45%" />
        </article>

        <div className="flex flex-col" style={{ gap: "24px" }}>
          <StoreBlockSkeleton />
        </div>
      </div>

      <HelpBand />
    </>
  );
}

const BODIES: Record<Variant, () => React.ReactNode> = {
  policy: PolicyBody,
  faq: FaqBody,
  contact: ContactBody,
  editorial: EditorialBody,
  stores: StoresBody,
};

export default async function StorePageSkeleton({ variant }: { variant: Variant }) {
  const locale = await getLocale();
  const { value: siteBanners } = await getSiteBanners();
  const imageSrc =
    variant === "stores" ? storesHeroUrl(siteBanners) : pagesHeroUrl(siteBanners);
  const focus =
    variant === "stores" ? siteBanners.focus.storesHero : siteBanners.focus.pagesHero;
  const Body = BODIES[variant];

  return (
    <LoadingRegion>
      <HeroSkeleton variant={variant} locale={locale} imageSrc={imageSrc} focus={focus} />
      <Body />
    </LoadingRegion>
  );
}
