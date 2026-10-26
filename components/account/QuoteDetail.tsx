"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatAED, sumMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import QuoteStatusBadge from "@/components/ui/QuoteStatusBadge";
import Button from "@/components/ui/Button";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import RequestQuoteContactModal from "@/components/account/RequestQuoteContactModal";
import AccountHelpLink from "@/components/account/AccountHelpLink";
import { acceptQuoteAction, cancelQuoteAction } from "@/lib/actions/quote";
import type { QuoteDetailProjection } from "@/lib/db/queries/quote";
import { getCountryName } from "@/lib/data/countries";

interface Props {
  projection: QuoteDetailProjection;
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

const dangerLinkStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "transparent",
  border: "none",
  color: "var(--color-action-danger)",
  fontSize: "var(--text-body-sm)",
  textAlign: "center",
  padding: "0.25rem 0",
};

const advisoryTextStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "var(--color-content-tertiary)",
  lineHeight: "var(--leading-relaxed)",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-error-text)",
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginTop: "0.5rem",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-label-text)",
  fontVariantNumeric: "tabular-nums",
};

const summaryStageLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-semibold)",
  color: "var(--color-auth-label-text)",
};

const summaryStageValueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-semibold)",
  color: "var(--color-auth-label-text)",
  fontVariantNumeric: "tabular-nums",
};

function StatusPanel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-auth-form-border)",
        borderInlineStart: "3px solid var(--color-status-warning)",
        borderRadius: "var(--radius-none)",
      }}
    >
      <p style={{ ...labelStyle, color: "var(--color-status-warning)" }}>
        {eyebrow}
      </p>
      {children}
    </div>
  );
}

export default function QuoteDetail({ projection, locale }: Props) {
  const t = useTranslations("account.quotes");
  const agreedTotalAed = sumMoney([
    projection.quotedTotalAed ?? 0,
    projection.shippingCostAed ?? 0,
  ]);
  const statusLabel =
    projection.convertedOrderId !== null
      ? t("statusConverted")
      : t(`status.${projection.status}`);
  const pricesVisible = projection.quotedTotalAed != null;
  const goodsSubtotalAed = sumMoney(
    projection.items.map((i) => i.quotedLineTotalAed ?? 0),
  );
  const addonsSubtotalAed = sumMoney(
    projection.items.flatMap((i) =>
      i.selectedAddons.map((a) => a.quotedLineTotalAed ?? 0),
    ),
  );
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptQuoteAction(
        {
          quoteId: projection.id,
          consent: true,
          expectedTotal: agreedTotalAed,
        },
        locale,
      );
      if (result.success) {
        router.refresh();
      } else {
        setError(t(`errors.${result.errorCode}`));
      }
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelQuoteAction({ quoteId: projection.id });
      if (result.success) {
        router.refresh();
      } else {
        setError(t(`errors.${result.errorCode}`));
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/account/quotes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            marginBottom: "1.25rem",
            transition: "color var(--duration-base) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color =
              "var(--color-action-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color =
              "var(--color-content-tertiary)";
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
          {t("backToQuotes")}
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              flex: 1,
            }}
          >
            <h1
              className="text-[1.375rem] sm:text-[length:var(--text-heading)]"
              style={{
                fontWeight: "var(--font-bold)",
                color: "var(--color-action-primary)",
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--leading-tight)",
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              <span dir="ltr">{projection.quoteNumber}</span>
            </h1>
            <QuoteStatusBadge status={projection.status} label={statusLabel} />
          </div>
          <div className="hidden sm:block">
            <AccountHelpLink href={`/account/support?quote=${projection.id}`} />
          </div>
        </div>

        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
          }}
        >
          {formatDisplayDate(projection.createdAt, locale)}
        </p>

        <div className="mt-4 grid grid-cols-1 sm:hidden">
          <AccountHelpLink href={`/account/support?quote=${projection.id}`} />
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("placedUnder")}</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {[
            {
              label: t("legalEntity"),
              value: projection.snapshotLegalName ?? "—",
              mono: false,
            },
            {
              label: t("tradeLicense"),
              value: projection.snapshotTradeLicenseNo ?? "—",
              mono: true,
            },
            {
              label: t("vatNumber"),
              value: projection.snapshotVatNumber ?? "—",
              mono: true,
            },
          ].map((row, idx, arr) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                padding: "0.875rem 0",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid var(--color-auth-form-border)"
                    : "none",
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-medium)",
                  color: "var(--color-auth-label-text)",
                }}
              >
                {row.label}
              </p>
              <p
                dir={row.mono ? "ltr" : undefined}
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  flexShrink: 0,
                  ...(row.mono ? { fontFamily: "var(--font-mono)" } : {}),
                }}
              >
                {row.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {projection.shippingAddress && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("shippingTo")}</p>
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
              {projection.shippingAddress.city},{" "}
              {projection.shippingAddress.emirate}
              {projection.shippingAddress.postalCode && (
                <> {projection.shippingAddress.postalCode}</>
              )}
              <br />
              {getCountryName(projection.shippingAddress.country)}
            </p>
          </div>
        </div>
      )}

      {projection.sendNote && (
        <StatusPanel eyebrow={t("staffNote")}>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-content-tertiary)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {projection.sendNote}
          </p>
        </StatusPanel>
      )}

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("items")}</p>
        </div>

        <div style={{ padding: "0 1.25rem" }}>
          {projection.items.map((item, idx) => {
            const isLast = idx === projection.items.length - 1;
            const showPrice = pricesVisible && item.quotedLineTotalAed != null;

            return (
              <div
                key={item.id}
                style={{
                  padding: "1rem 0",
                  borderBottom: isLast
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
                    {item.requestedQuantity != null &&
                      item.requestedQuantity !== item.quantity && (
                        <p
                          dir="ltr"
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "var(--color-content-tertiary)",
                            marginTop: "0.125rem",
                          }}
                        >
                          <span style={{ textDecoration: "line-through" }}>
                            {t("requestedQuantity", {
                              count: item.requestedQuantity,
                            })}
                          </span>{" "}
                          → {t("confirmedQuantity", { count: item.quantity })}
                        </p>
                      )}
                    <p
                      dir="ltr"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        marginTop: "0.125rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {showPrice && item.quotedUnitPriceAed != null
                        ? `${formatAED(item.quotedUnitPriceAed, locale)} × ${item.quantity}`
                        : `×${item.quantity}`}
                    </p>
                  </div>
                  {showPrice && (
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
                      {formatAED(item.quotedLineTotalAed!, locale)}
                    </p>
                  )}
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
                        {pricesVisible && addon.quotedUnitPriceAed != null
                          ? `${formatAED(addon.quotedUnitPriceAed, locale)} × ${addon.quantity}`
                          : `×${addon.quantity}`}
                      </p>
                    </div>
                    {pricesVisible && (
                      <p
                        dir="ltr"
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                          flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {addon.quotedLineTotalAed != null
                          ? formatAED(addon.quotedLineTotalAed, locale)
                          : "—"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("pricing")}</p>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          {pricesVisible ? (
            <>
              <div style={{ ...summaryRowStyle, marginTop: 0 }}>
                <span style={summaryLabelStyle}>{t("goodsSubtotal")}</span>
                <span dir="ltr" style={summaryValueStyle}>
                  {formatAED(goodsSubtotalAed, locale)}
                </span>
              </div>

              <div style={summaryRowStyle}>
                <span style={summaryLabelStyle}>{t("addonsSubtotal")}</span>
                <span dir="ltr" style={summaryValueStyle}>
                  {formatAED(addonsSubtotalAed, locale)}
                </span>
              </div>

              <div style={summaryRowStyle}>
                <span style={summaryStageLabelStyle}>{t("quotedTotal")}</span>
                <span dir="ltr" style={summaryStageValueStyle}>
                  {formatAED(projection.quotedTotalAed!, locale)}
                </span>
              </div>

              {projection.shippingCostAed != null && (
                <div style={summaryRowStyle}>
                  <span style={summaryLabelStyle}>{t("shippingCost")}</span>
                  <span dir="ltr" style={summaryValueStyle}>
                    {formatAED(projection.shippingCostAed, locale)}
                  </span>
                </div>
              )}

              <div
                style={{
                  ...summaryRowStyle,
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--color-auth-form-border)",
                }}
              >
                <span style={summaryStageLabelStyle}>{t("total")}</span>
                <span dir="ltr" style={summaryStageValueStyle}>
                  {formatAED(agreedTotalAed, locale)}
                </span>
              </div>
            </>
          ) : projection.status === "CANCELLED" ? (
            <p style={advisoryTextStyle}>{t("cancelledAdvisory")}</p>
          ) : projection.status === "CLOSED" ? (
            <p style={advisoryTextStyle}>{t("closedAdvisory")}</p>
          ) : (
            <p style={advisoryTextStyle}>{t("awaitingPricing")}</p>
          )}

          {(projection.status === "NEW" ||
            projection.status === "CONTACTED") && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "1.25rem",
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                fullWidth
                disabled={isPending}
                onClick={() => setContactModalOpen(true)}
              >
                {t("requestContactCta")}
              </Button>

              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                disabled={isPending}
                style={dangerLinkStyle}
              >
                {t("cancelQuoteCta")}
              </button>

              {error && <p style={errorTextStyle}>{error}</p>}
            </div>
          )}

          {projection.status === "QUOTED" &&
            projection.quotedTotalAed != null &&
            (projection.consentAvailable ? (
              <div style={{ marginTop: "1.25rem" }}>
                <div
                  style={{
                    ...cardStyle,
                    marginBottom: "1rem",
                    borderTop: "2px solid var(--color-auth-label-text)",
                  }}
                >
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid var(--color-auth-form-border)",
                    }}
                  >
                    <p style={labelStyle}>{t("consentTermsHeading")}</p>
                  </div>
                  <div
                    dir={locale === "ar" ? "rtl" : "ltr"}
                    style={{
                      padding: "1rem 1.25rem",
                      maxHeight: "320px",
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      fontSize: "var(--text-body)",
                      color: "var(--color-auth-label-text)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {projection.consentTermsBody}
                  </div>
                </div>

                <div
                  style={{
                    ...cardStyle,
                    marginBottom: "1.25rem",
                    borderTop: "2px solid var(--color-auth-label-text)",
                  }}
                >
                  <div
                    style={{
                      padding: "1rem 1.25rem",
                      borderBottom: "1px solid var(--color-auth-form-border)",
                    }}
                  >
                    <p style={labelStyle}>{t("consentRulesHeading")}</p>
                  </div>
                  <div
                    dir={locale === "ar" ? "rtl" : "ltr"}
                    style={{
                      padding: "1rem 1.25rem",
                      maxHeight: "320px",
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      fontSize: "var(--text-body)",
                      color: "var(--color-auth-label-text)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {projection.consentRulesBody}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.625rem",
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-bold)",
                    color: "var(--color-auth-label-text)",
                    cursor: "pointer",
                    marginBottom: "1.25rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    style={{
                      marginTop: "0.1875rem",
                      accentColor: "var(--color-action-primary)",
                    }}
                  />
                  {t("consentCheckbox")}
                </label>

                <div
                  style={{
                    borderInlineStart:
                      "3px solid var(--color-auth-form-border)",
                    paddingInlineStart: "0.75rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--color-auth-label-text)",
                      marginBottom: "0.375rem",
                    }}
                  >
                    {t("whatNextHeading")}
                  </p>
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {t("whatNextBody")}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={!consent || isPending}
                    loading={isPending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("acceptCta")}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    fullWidth
                    disabled={isPending}
                    onClick={() => setContactModalOpen(true)}
                  >
                    {t("requestContactCta")}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={isPending}
                    style={dangerLinkStyle}
                  >
                    {t("cancelQuoteCta")}
                  </button>

                  {error && <p style={errorTextStyle}>{error}</p>}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "1.25rem" }}>
                <div
                  style={{
                    borderInlineStart:
                      "3px solid var(--color-auth-form-border)",
                    paddingInlineStart: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    {t("consentUnavailable")}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    fullWidth
                    disabled={isPending}
                    onClick={() => setContactModalOpen(true)}
                  >
                    {t("requestContactCta")}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={isPending}
                    style={dangerLinkStyle}
                  >
                    {t("cancelQuoteCta")}
                  </button>

                  {error && <p style={errorTextStyle}>{error}</p>}
                </div>
              </div>
            ))}

          {projection.status === "ACCEPTED" && (
            <div style={{ marginTop: "1.25rem" }}>
              <div
                style={{
                  borderInlineStart: "3px solid var(--color-auth-form-border)",
                  paddingInlineStart: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                    lineHeight: "var(--leading-relaxed)",
                  }}
                >
                  {t("acceptedAdvisory")}
                </p>
              </div>

              {projection.convertedOrderNumber === null ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <LocaleButtonLink
                    href={`/account/quotes/${projection.id}/finalize`}
                    variant="primary"
                    size="lg"
                  >
                    {t("finalizeCta")}
                  </LocaleButtonLink>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  <Link
                    href={`/account/orders/${projection.convertedOrderId}`}
                    style={{ color: "var(--color-action-primary)" }}
                  >
                    {t("convertedToOrder", {
                      orderNumber: projection.convertedOrderNumber,
                    })}
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {projection.status === "QUOTED" && projection.quotedTotalAed != null && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            handleAccept();
          }}
          title={t("acceptConfirmTitle")}
          message={t("acceptConfirmBody", {
            total: formatAED(agreedTotalAed, locale),
          })}
          confirmLabel={t("acceptCta")}
          cancelLabel={t("cancel")}
          isPending={isPending}
          destructive={false}
        />
      )}

      {(projection.status === "NEW" ||
        projection.status === "CONTACTED" ||
        projection.status === "QUOTED") && (
        <ConfirmDialog
          open={cancelConfirmOpen}
          onClose={() => setCancelConfirmOpen(false)}
          onConfirm={() => {
            setCancelConfirmOpen(false);
            handleCancel();
          }}
          title={t("cancelConfirmTitle")}
          message={t("cancelConfirmBody")}
          confirmLabel={t("cancelQuoteCta")}
          cancelLabel={t("cancel")}
          isPending={isPending}
          destructive={true}
        />
      )}

      <RequestQuoteContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        quoteId={projection.id}
      />

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-auth-form-border)",
          }}
        >
          <p style={labelStyle}>{t("timeline")}</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {projection.events.map((event, idx) => {
            const isLast = idx === projection.events.length - 1;
            return (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  padding: "0.875rem 0",
                  borderBottom: isLast
                    ? "none"
                    : "1px solid var(--color-auth-form-border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "var(--color-auth-label-text)",
                    }}
                  >
                    {t(`status.${event.toStatus}`)}
                  </p>
                  {event.note && (
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        marginTop: "0.125rem",
                        lineHeight: "var(--leading-relaxed)",
                      }}
                    >
                      {event.note}
                    </p>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                    flexShrink: 0,
                  }}
                >
                  {formatDisplayDate(event.createdAt, locale)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {projection.customerNote && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("customerNote")}</p>
          </div>
          <div style={{ padding: "1rem 1.25rem" }}>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {projection.customerNote}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
