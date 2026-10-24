import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ProductDescription from "./ProductDescription";
import SpecsTable from "./SpecsTable";

interface ProductDetailsProps {
  description: { text: string; fallback: boolean } | null;
  specs: Array<{
    labelEn: string;
    labelAr: string;
    labelRu?: string | null;
    valueEn: string;
    valueAr: string;
    valueRu?: string | null;
  }>;
  locale: string;
}

const SUMMARY_CLASS =
  "flex items-center justify-between py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden";

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--primitive-black)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform group-open:rotate-180"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export default async function ProductDetails({
  description,
  specs,
  locale,
}: ProductDetailsProps) {
  const t = await getTranslations("shop");

  const labelStyle = {
    color: "var(--primitive-black)",
    fontWeight: "var(--font-semibold)",
  };

  return (
    <div>
      {description && (
        <details
          id="product-description"
          open
          className="group"
          style={{
            borderTop: "1px solid var(--color-shop-divider)",
            scrollMarginTop: "6rem",
          }}
        >
          <summary className={SUMMARY_CLASS}>
            <span className="text-body" style={labelStyle}>
              {t("description_heading")}
            </span>
            <Chevron />
          </summary>
          <div style={{ paddingBottom: "1rem" }}>
            <ProductDescription
              text={description.text}
              fallbackLang={description.fallback ? "en" : undefined}
            />
          </div>
        </details>
      )}
      {specs.length > 0 && (
        <details
          open
          className="group"
          style={{ borderTop: "1px solid var(--color-shop-divider)" }}
        >
          <summary className={SUMMARY_CLASS}>
            <span className="text-body" style={labelStyle}>
              {t("specs_label")}
            </span>
            <Chevron />
          </summary>
          <div style={{ paddingBottom: "1rem" }}>
            <SpecsTable specs={specs} locale={locale} />
          </div>
        </details>
      )}
      <details
        className="group"
        style={{
          borderTop: "1px solid var(--color-shop-divider)",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <summary className={SUMMARY_CLASS}>
          <span className="text-body" style={labelStyle}>
            {t("delivery_heading")}
          </span>
          <Chevron />
        </summary>
        <div style={{ paddingBottom: "1rem" }}>
          <p
            className="text-body-sm"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("delivery_body")}{" "}
            <Link
              href="/shipping"
              className="underline"
              style={{ color: "var(--primitive-black)" }}
            >
              {t("delivery_shipping_link")}
            </Link>
            {" · "}
            <Link
              href="/returns"
              className="underline"
              style={{ color: "var(--primitive-black)" }}
            >
              {t("delivery_returns_link")}
            </Link>
          </p>
        </div>
      </details>
    </div>
  );
}
