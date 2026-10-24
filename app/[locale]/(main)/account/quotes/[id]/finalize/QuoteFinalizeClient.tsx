"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAED } from "@/lib/utils/currency";
import { getCountryName } from "@/lib/data/countries";
import VerificationSection from "@/components/checkout/VerificationSection";
import FinalizeButtons from "./FinalizeButtons";
import type { QuoteFinalizeProjection } from "@/lib/db/queries/quote";

interface Props {
  projection: Omit<QuoteFinalizeProjection, "shippingCostAed"> & {
    shippingCostAed: number;
  };
  locale: "en" | "ar" | "ru";
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-content-tertiary)",
};

const vatNoteRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.5rem",
};

const vatNoteLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
};

const vatNoteValueStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
  fontVariantNumeric: "tabular-nums",
};

export default function QuoteFinalizeClient({ projection, locale }: Props) {
  const t = useTranslations("account.quotes.finalize");

  const totalAed =
    projection.goodsSubtotalAed +
    projection.addonSubtotalAed +
    projection.shippingCostAed;
  const verificationApproved = projection.verification.status === "APPROVED";
  const taxAed = projection.taxAmountAed;
  const effectiveRate = Math.round(projection.vatRate * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href={`/account/quotes/${projection.quote.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            marginBottom: "1.25rem",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="flip-rtl"
          >
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span dir="ltr">{projection.quote.quoteNumber}</span>
        </Link>

        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("heading")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
          }}
        >
          {t("subheading")}
        </p>
      </div>

      {projection.shippingAddress && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("shippingAddressHeading")}</p>
          </div>
          <div
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--color-auth-label-text)",
              }}
            >
              {projection.shippingAddress.fullName}
            </p>
            <p
              dir="ltr"
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {projection.shippingAddress.phone}
            </p>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {projection.shippingAddress.addressLine1}
              {projection.shippingAddress.addressLine2 && (
                <>, {projection.shippingAddress.addressLine2}</>
              )}
              <br />
              {projection.shippingAddress.city}, {projection.shippingAddress.emirate}
              {projection.shippingAddress.postalCode && (
                <> {projection.shippingAddress.postalCode}</>
              )}
              <br />
              {getCountryName(projection.shippingAddress.country)}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                marginTop: "0.5rem",
              }}
            >
              {t("addressLockedNote")}
            </p>
          </div>
        </div>
      )}

      {projection.restricted && (
        <VerificationSection
          verification={projection.verification}
          locale={locale}
        />
      )}

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("itemsHeading")}</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {projection.items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                padding: "1rem 0",
                borderBottom:
                  idx === projection.items.length - 1
                    ? "none"
                    : "1px solid var(--color-auth-form-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--color-auth-label-text)",
                      lineHeight: "var(--leading-snug)",
                    }}
                  >
                    {item.name}
                  </p>
                  <p
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      marginTop: "0.125rem",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.quotedUnitPriceAed != null
                      ? `${formatAED(item.quotedUnitPriceAed, locale)} × ${item.quantity}`
                      : `×${item.quantity}`}
                  </p>
                </div>
                <p
                  dir="ltr"
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-auth-label-text)",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatAED(item.quotedLineTotalAed, locale)}
                </p>
              </div>

              {item.selectedAddons.map((addon) => (
                <div
                  key={addon.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    marginTop: "0.625rem",
                    paddingInlineStart: "1rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      + {addon.name}
                    </p>
                    <p
                      dir="ltr"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        marginTop: "0.125rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {addon.quotedUnitPriceAed != null
                        ? `${formatAED(addon.quotedUnitPriceAed, locale)} × ${addon.quantity}`
                        : `×${addon.quantity}`}
                    </p>
                  </div>
                  <p
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatAED(addon.quotedLineTotalAed, locale)}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("paymentHeading")}</p>
        </div>
        <div
          style={{
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("goodsSubtotal")}
            </span>
            <span dir="ltr" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-label-text)", fontVariantNumeric: "tabular-nums" }}>
              {formatAED(projection.goodsSubtotalAed, locale)}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("addonSubtotal")}
            </span>
            <span dir="ltr" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-label-text)", fontVariantNumeric: "tabular-nums" }}>
              {formatAED(projection.addonSubtotalAed, locale)}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("shippingLine")}
            </span>
            <span dir="ltr" style={{ fontSize: "var(--text-body-sm)", color: "var(--color-auth-label-text)", fontVariantNumeric: "tabular-nums" }}>
              {formatAED(projection.shippingCostAed, locale)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: "0.625rem",
              borderTop: "1px solid var(--color-auth-form-border)",
              marginTop: "0.25rem",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "var(--color-auth-label-text)",
              }}
            >
              {t("total")}
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: "var(--text-heading)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-auth-label-text)",
                letterSpacing: "var(--tracking-tight)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatAED(totalAed, locale)}
            </span>
          </div>

          {taxAed > 0 && (
            <div style={vatNoteRowStyle}>
              <span style={vatNoteLabelStyle}>
                {t("vatInclLine", { rate: effectiveRate })}
              </span>
              <span dir="ltr" style={vatNoteValueStyle}>
                {formatAED(taxAed, locale)}
              </span>
            </div>
          )}

          <FinalizeButtons
            quoteId={projection.quote.id}
            totalAed={totalAed}
            locale={locale}
            restricted={projection.restricted}
            verificationApproved={verificationApproved}
          />
        </div>
      </div>
    </div>
  );
}
