import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";

export async function HelpBand() {
  const t = await getTranslations("pages");

  return (
    <div
      className="flex flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-24 lg:py-12"
      style={{
        background: "var(--color-auth-form-bg)",
        borderTop: "1px solid var(--color-shop-divider)",
      }}
    >
      <div>
        <p
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--color-action-primary)",
          }}
        >
          {t("band.eyebrow")}
        </p>
        <h2
          className="text-[26px] lg:text-[30px]"
          style={{
            fontWeight: 700,
            lineHeight: 1.2,
            color: "var(--primitive-black)",
            marginTop: "8px",
          }}
        >
          {t("band.title")}
        </h2>
        <p style={{ fontSize: "15px", color: "var(--color-content-tertiary)", marginTop: "8px" }}>
          {t("band.body")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LocaleButtonLink href="/contact" variant="primary" size="lg">
          {t("band.contact")}
        </LocaleButtonLink>
        <Link
          href="/faq"
          className="inline-flex items-center justify-center"
          style={{
            height: "52px",
            padding: "0 30px",
            border: "1px solid var(--primitive-black)",
            color: "var(--primitive-black)",
            background: "transparent",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {t("band.faq")}
        </Link>
      </div>
    </div>
  );
}
