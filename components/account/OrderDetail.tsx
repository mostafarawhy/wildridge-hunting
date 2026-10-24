"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatAED, sumMoney } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import Button from "@/components/ui/Button";
import OrderStatusBadge from "@/components/ui/OrderStatusBadge";
import AccountHelpLink from "@/components/account/AccountHelpLink";
import RequestOrderContactModal from "@/components/account/RequestOrderContactModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  approveShippingQuoteAction,
  confirmOrderDeliveryAction,
  declineShippingQuoteAction,
  retryOrderPaymentAction,
} from "@/lib/actions/orders";
import type { OrderConfirmationProjection } from "@/lib/db/queries/order";
import type { ShippingMethodSnapshot } from "@/types/order";
import { getCountryName } from "@/lib/data/countries";
import { isHttpUrl } from "@/lib/utils/tracking-url";

interface Props {
  projection: OrderConfirmationProjection;
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

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "var(--color-auth-label-text)",
};

const vatNoteRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "0.375rem",
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

function pickShippingMethodName(
  method: ShippingMethodSnapshot,
  locale: "en" | "ar" | "ru",
): string {
  if (locale === "ar") return method.nameAr;
  if (locale === "ru") return method.nameRu;
  return method.nameEn;
}

export default function OrderDetail({ projection, locale }: Props) {
  const t = useTranslations("account.orders");
  const tq = useTranslations("account.orders.quote");
  const tp = useTranslations("account.orders.payment");
  const tc = useTranslations("account.orders.contact");
  const td = useTranslations("account.orders.delivery");
  const tr = useTranslations("account.orders.refund");
  const tsuccess = useTranslations("checkout.success");
  const router = useRouter();
  const [contactOpen, setContactOpen] = useState(false);

  const isPaid =
    projection.paidAt !== null || projection.settlements.length > 0;

  const isAwaitingQuote = projection.status === "AWAITING_SHIPPING_QUOTE";
  const isQuoted = projection.status === "AWAITING_QUOTE_APPROVAL";
  const isPaymentPending = projection.status === "PAYMENT_PENDING";
  const isPaymentFailed = projection.status === "PAYMENT_FAILED";
  const canRetryPayment = isPaymentPending || isPaymentFailed;
  const isAwaitingManualPayment =
    projection.status === "AWAITING_MANUAL_PAYMENT";
  const isShipped = projection.status === "SHIPPED";

  const [isPending, startTransition] = useTransition();
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [retryError, setRetryError] = useState<string | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  function handleApprove() {
    setQuoteError(null);
    startTransition(async () => {
      const result = await approveShippingQuoteAction(
        { orderId: projection.id, expectedTotal: projection.totalAed },
        locale,
      );
      if (result.success) {
        window.location.href = result.data.redirectUrl;
      } else {
        setApproveOpen(false);
        setQuoteError(tq(`errors.${result.errorCode}`));
      }
    });
  }

  function handleDeclineConfirm() {
    setQuoteError(null);
    startTransition(async () => {
      const result = await declineShippingQuoteAction(
        { orderId: projection.id, reason: declineReason.trim() || undefined },
      );
      if (result.success) {
        setDeclineOpen(false);
        router.refresh();
      } else {
        setQuoteError(tq(`errors.${result.errorCode}`));
      }
    });
  }

  function handleRetryPayment() {
    setRetryError(null);
    startTransition(async () => {
      const result = await retryOrderPaymentAction(
        { orderId: projection.id, expectedTotal: projection.totalAed },
        locale,
      );
      if (result.success) {
        window.location.href = result.data.redirectUrl;
      } else {
        setRetryError(tp(`errors.${result.errorCode}`));
      }
    });
  }

  function handleConfirmDelivery() {
    setDeliveryError(null);
    startTransition(async () => {
      const result = await confirmOrderDeliveryAction({ orderId: projection.id });
      setDeliveryOpen(false);
      if (result.success) {
        router.refresh();
      } else {
        setDeliveryError(td(`errors.${result.errorCode}`));
      }
    });
  }

  const productItems = projection.items.filter((i) => i.itemType === "PRODUCT");
  const addonItems = projection.items.filter((i) => i.itemType === "ADDON");

  const taxAed = projection.taxAmountAed;
  const effectiveRate = Math.round(projection.vatRate * 100);
  const refundedAed = sumMoney(projection.refunds.map((r) => r.amountAed));

  const loyaltyPoints = projection.loyaltyPointsEarned;
  const loyaltyNoteKind =
    loyaltyPoints > 0
      ? projection.status === "DELIVERED"
        ? "earned"
        : projection.loyaltyPointsFrozen &&
            ![
              "CANCELLED",
              "REFUNDED",
              "PARTIALLY_REFUNDED",
              "PAYMENT_FAILED",
              "RETURNED",
            ].includes(projection.status)
          ? "pending"
          : null
      : null;
  const loyaltyNoteColor =
    loyaltyNoteKind === "earned"
      ? "var(--color-success)"
      : "var(--primitive-black)";
  const loyaltyNote = loyaltyNoteKind ? (
    <div
      style={{
        marginTop: "0.75rem",
        borderInlineStart: "3px solid var(--primitive-gold-dark)",
        paddingInlineStart: "0.75rem",
        fontSize: "var(--text-body-sm)",
        color: "var(--color-content-tertiary)",
      }}
    >
      {t.rich(
        loyaltyNoteKind === "earned"
          ? "loyaltyPointsEarned"
          : "loyaltyPointsPending",
        {
          points: loyaltyPoints.toLocaleString("en-US"),
          b: (c) => (
            <span
              dir="ltr"
              style={{ color: loyaltyNoteColor, fontWeight: "var(--font-semibold)" }}
            >
              {c}
            </span>
          ),
        },
      )}
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/account/orders"
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
          {t("backToOrders")}
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
              style={{
                fontSize: "var(--text-heading)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-action-primary)",
                letterSpacing: "var(--tracking-tight)",
                lineHeight: "var(--leading-tight)",
                margin: 0,
              }}
            >
              <span dir="ltr">{projection.orderNumber}</span>
            </h1>
            <OrderStatusBadge
              status={projection.status}
              label={t(`status.${projection.status}`)}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            {isPaid && (
              <Link
                href={`/receipt/${projection.id}?print=1`}
                target="_blank"
                rel="noopener"
                style={{
                  color: "var(--color-action-primary)",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {tsuccess("saveReceipt")}
              </Link>
            )}
            <AccountHelpLink href={`/account/support?order=${projection.id}`} />
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
      </div>

      {(isAwaitingQuote || isQuoted) && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>
              {isAwaitingQuote ? tq("awaitingQuoteTitle") : tq("quotedTitle")}
            </p>
          </div>

          <div
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              style={{
                ...valueStyle,
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {isAwaitingQuote ? tq("awaitingQuoteBody") : tq("quotedBody")}
            </p>

            {isQuoted && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                    paddingTop: "0.625rem",
                    borderTop: "1px solid var(--color-auth-form-border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      {t("subtotal")}
                    </span>
                    <span
                      dir="ltr"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-auth-label-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatAED(projection.subtotalAed, locale)}
                    </span>
                  </div>

                  {projection.addonTotalAed > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                        }}
                      >
                        {t("addons")}
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-auth-label-text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatAED(projection.addonTotalAed, locale)}
                      </span>
                    </div>
                  )}

                  {projection.discountAmountAed > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                        }}
                      >
                        {t("discount")}
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-status-success-text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        -{formatAED(projection.discountAmountAed, locale)}
                      </span>
                    </div>
                  )}

                  {projection.loyaltyPointsUsed > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                        }}
                      >
                        {t("points")}
                        <span
                          dir="ltr"
                          style={{
                            marginInlineStart: "0.25rem",
                            color: "var(--color-content-tertiary)",
                          }}
                        >
                          · {projection.loyaltyPointsUsed.toLocaleString("en-US")}
                        </span>
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-status-success-text)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        -{formatAED(projection.loyaltyDiscountAmountAed, locale)}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      {tq("quotedShipping")}
                    </span>
                    <span
                      dir="ltr"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-auth-label-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
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
                      {formatAED(projection.totalAed, locale)}
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

                  {loyaltyNote}
                </div>

                {!declineOpen && !approveOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={() => setApproveOpen(true)}
                      disabled={isPending}
                      loading={isPending}
                    >
                      {tq("approvePay")}
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={() => setContactOpen(true)}
                      disabled={isPending}
                    >
                      {tc("cta")}
                    </Button>

                    <button
                      type="button"
                      onClick={() => setDeclineOpen(true)}
                      disabled={isPending}
                      style={{
                        width: "100%",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "var(--color-action-danger)",
                        fontSize: "var(--text-body-sm)",
                        textAlign: "center",
                        opacity: isPending ? 0.4 : 1,
                        padding: "0.25rem 0",
                      }}
                    >
                      {tq("declineCancel")}
                    </button>
                  </div>
                )}

                {approveOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--font-bold)",
                        color: "var(--color-auth-label-text)",
                      }}
                    >
                      {tq("approveConfirmTitle")}
                    </p>
                    <div
                      style={{
                        border: "1px solid var(--color-auth-form-border)",
                        borderRadius: "var(--radius-none)",
                        padding: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "var(--color-content-tertiary)",
                          }}
                        >
                          {tq("approveConfirmTotalLabel")}
                        </span>
                        <span
                          dir="ltr"
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            fontSize: "var(--text-heading)",
                            fontWeight: "var(--font-bold)",
                            color: "var(--color-auth-label-text)",
                          }}
                        >
                          {formatAED(projection.totalAed, locale)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                        }}
                      >
                        {tq("approveConfirmVatNote")}
                      </p>
                    </div>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        lineHeight: "var(--leading-relaxed)",
                      }}
                    >
                      {tq("approveConfirmBody")}
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handleApprove}
                      disabled={isPending}
                      loading={isPending}
                    >
                      {tq("approveConfirmCta")}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={() => setApproveOpen(false)}
                      disabled={isPending}
                    >
                      {tq("approveConfirmBack")}
                    </Button>
                  </div>
                )}

                {declineOpen && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--font-bold)",
                        color: "var(--color-auth-label-text)",
                      }}
                    >
                      {tq("declineConfirmTitle")}
                    </p>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      {tq("declineConfirmBody")}
                    </p>
                    <div>
                      <label
                        style={{
                          ...labelStyle,
                          display: "block",
                          marginBottom: "0.375rem",
                        }}
                      >
                        {tq("declineReasonLabel")}
                      </label>
                      <textarea
                        rows={3}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          fontSize: "var(--text-body)",
                          color: "var(--color-auth-label-text)",
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--color-auth-form-border)",
                          borderRadius: "var(--radius-none)",
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <Button
                      variant="danger"
                      size="lg"
                      fullWidth
                      onClick={handleDeclineConfirm}
                      disabled={isPending}
                      loading={isPending}
                    >
                      {tq("declineConfirm")}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={() => {
                        setDeclineOpen(false);
                        setDeclineReason("");
                      }}
                      disabled={isPending}
                    >
                      {tq("declineBack")}
                    </Button>
                  </div>
                )}

                {quoteError && (
                  <p
                    style={{
                      color: "var(--color-action-danger)",
                      fontSize: "var(--text-body-sm)",
                    }}
                  >
                    {quoteError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {canRetryPayment && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>
              {isPaymentFailed ? tp("failedTitle") : tp("pendingTitle")}
            </p>
          </div>

          <div
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              style={{
                ...valueStyle,
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {isPaymentFailed ? tp("failedBody") : tp("pendingBody")}
            </p>

            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto sm:self-start min-w-[240px]"
              onClick={handleRetryPayment}
              disabled={isPending}
              loading={isPending}
            >
              {tp("payNow")}
            </Button>

            {retryError && (
              <p
                style={{
                  color: "var(--color-action-danger)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {retryError}
              </p>
            )}
          </div>
        </div>
      )}

      {isAwaitingManualPayment && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{tc("cardTitle")}</p>
          </div>

          <div
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              style={{
                ...valueStyle,
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {tc("cardBody")}
            </p>

            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => setContactOpen(true)}
            >
              {tc("cta")}
            </Button>
          </div>
        </div>
      )}

      {isShipped && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{td("cardTitle")}</p>
          </div>

          <div
            style={{
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <p
              style={{
                ...valueStyle,
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {td("cardBody")}
            </p>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setDeliveryOpen(true)}
              disabled={isPending}
              loading={isPending}
            >
              {td("cta")}
            </Button>

            {deliveryError && (
              <p
                style={{
                  color: "var(--color-action-danger)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {deliveryError}
              </p>
            )}
          </div>
        </div>
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
          {productItems.map((product, idx) => {
            const children = addonItems.filter(
              (a) => a.parentOrderItemId === product.id,
            );
            const isLast = idx === productItems.length - 1;

            return (
              <div
                key={product.id}
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
                      {product.name}
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
                      {formatAED(product.unitPriceAed, locale)} ×{" "}
                      {product.quantity}
                    </p>
                    {product.serials && (
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                          marginTop: "0.125rem",
                        }}
                      >
                        {t(product.serials.kind === "LOT" ? "lot" : "serial")}:{" "}
                        <span dir="ltr">{product.serials.values.join(", ")}</span>
                      </p>
                    )}
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
                    {formatAED(product.lineTotalAed, locale)}
                  </p>
                </div>

                {children.map((addon) => (
                  <div
                    key={addon.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      marginTop: "0.5rem",
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
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "var(--color-content-tertiary)",
                          marginTop: "0.125rem",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span dir="ltr">
                          {formatAED(addon.unitPriceAed, locale)} ×{" "}
                          {addon.quantity}
                        </span>
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
                      {formatAED(addon.lineTotalAed, locale)}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--color-auth-form-border)",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("subtotal")}
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-auth-label-text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatAED(projection.subtotalAed, locale)}
            </span>
          </div>

          {projection.addonTotalAed > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {t("addons")}
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-auth-label-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(projection.addonTotalAed, locale)}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {isQuoted ? tq("quotedShipping") : t("shipping")}
              </span>
              {projection.discountAmountAed === 0 &&
                projection.couponCode &&
                projection.shippingCostAed === 0 && (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-status-success-text)",
                      marginTop: "0.125rem",
                    }}
                  >
                    {t("freeShipping")}{" "}
                    <span dir="ltr">· {projection.couponCode}</span>
                  </p>
                )}
            </div>
            {isAwaitingQuote ? (
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {tq("shippingToBeQuoted")}
              </span>
            ) : (
              <span
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-auth-label-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(projection.shippingCostAed, locale)}
              </span>
            )}
          </div>

          {projection.discountAmountAed > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {t("discount")}
                {projection.couponCode && (
                  <span
                    dir="ltr"
                    style={{
                      marginInlineStart: "0.25rem",
                      color: "var(--color-content-tertiary)",
                    }}
                  >
                    · {projection.couponCode}
                  </span>
                )}
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-status-success-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                -{formatAED(projection.discountAmountAed, locale)}
              </span>
            </div>
          )}

          {projection.loyaltyPointsUsed > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {t("points")}
                <span
                  dir="ltr"
                  style={{
                    marginInlineStart: "0.25rem",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  · {projection.loyaltyPointsUsed.toLocaleString("en-US")}
                </span>
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-status-success-text)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                -{formatAED(projection.loyaltyDiscountAmountAed, locale)}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: "0.625rem",
              borderTop: "1px solid var(--color-auth-form-border)",
              marginTop: "0.25rem",
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
              {isAwaitingQuote ? tq("provisionalTotal") : t("total")}
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
              {formatAED(projection.totalAed, locale)}
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

          {loyaltyNote}

          {isAwaitingQuote && (
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {tq("awaitingQuoteBody")}
            </p>
          )}
        </div>
      </div>

      {projection.refundDueAed > 0 && (
        <div
          style={{
            ...cardStyle,
            borderInlineStart: "3px solid var(--color-action-primary)",
          }}
        >
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{tr("title")}</p>
          </div>
          <div
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <span style={valueStyle}>{tr("due")}</span>
              <span
                dir="ltr"
                style={{
                  ...valueStyle,
                  fontWeight: "var(--font-semibold)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatAED(projection.refundDueAed, locale)}
              </span>
            </div>
            {projection.refunds.map((refund, idx) => (
              <p
                key={idx}
                style={{
                  ...valueStyle,
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {tr("line", {
                  amount: formatAED(refund.amountAed, locale),
                  date: formatDisplayDate(refund.refundedAt, locale),
                })}
                {" · "}
                {refund.method === "OTHER" && refund.methodOtherLabel
                  ? refund.methodOtherLabel
                  : tr(`method.${refund.method}`)}
              </p>
            ))}
            {refundedAed < projection.refundDueAed && (
              <p
                style={{
                  ...valueStyle,
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                {tr("pending")}
              </p>
            )}
          </div>
        </div>
      )}

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
          <p style={{ ...valueStyle, fontWeight: "var(--font-semibold)" }}>
            {projection.shippingAddress.fullName}
          </p>
          <p
            dir="ltr"
            style={{
              ...valueStyle,
              color: "var(--color-content-tertiary)",
            }}
          >
            {projection.shippingAddress.phone}
          </p>
          <p
            style={{
              ...valueStyle,
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

      {projection.quoteRequestId && projection.quoteRequestNumber && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("quoteRequestTitle")}</p>
          </div>
          <div
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <span dir="ltr" style={valueStyle}>
              {projection.quoteRequestNumber}
            </span>
            <Link
              href={`/account/quotes/${projection.quoteRequestId}`}
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-action-primary)",
              }}
            >
              {t("viewQuoteRequest")}
            </Link>
          </div>
        </div>
      )}

      {projection.shippingMethod && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("shippingMethod")}</p>
          </div>
          <div
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <p style={{ ...valueStyle, fontWeight: "var(--font-medium)" }}>
              {pickShippingMethodName(projection.shippingMethod, locale)}
            </p>
          </div>
        </div>
      )}

      {(projection.trackingNumber ||
        projection.carrier ||
        projection.deliveredAt) && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-auth-form-border)",
            }}
          >
            <p style={labelStyle}>{t("trackingTitle")}</p>
          </div>
          <div
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {projection.carrier && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("carrier")}
                </span>
                <span style={valueStyle}>{projection.carrier}</span>
              </div>
            )}

            {projection.trackingNumber && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("trackingNumber")}
                </span>
                <span dir="ltr" style={valueStyle}>
                  {projection.trackingNumber}
                </span>
              </div>
            )}

            {projection.parcelCount !== null && (
              <p
                style={{
                  ...valueStyle,
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  margin: 0,
                }}
              >
                {t("parcels", { count: projection.parcelCount })}
              </p>
            )}

            {projection.estimatedDelivery && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("estimatedDelivery")}
                </span>
                <span style={valueStyle}>
                  {formatDisplayDate(projection.estimatedDelivery, locale)}
                </span>
              </div>
            )}

            {projection.deliveredAt && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("deliveredOn")}
                </span>
                <span style={valueStyle}>
                  {formatDisplayDate(projection.deliveredAt, locale)}
                </span>
              </div>
            )}

            {projection.shipmentNote && (
              <div style={{ marginTop: "0.25rem" }}>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                    margin: 0,
                  }}
                >
                  {t("shipmentNote")}
                </p>
                <p
                  style={{
                    ...valueStyle,
                    lineHeight: "var(--leading-relaxed)",
                    margin: "0.125rem 0 0",
                  }}
                >
                  {projection.shipmentNote}
                </p>
              </div>
            )}

            {projection.trackingUrl && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("trackingUrl")}
                </span>
                {isHttpUrl(projection.trackingUrl) ? (
                  <a
                    href={projection.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body)",
                      color: "var(--color-action-primary)",
                    }}
                  >
                    {t("trackPackage")}
                  </a>
                ) : (
                  <span dir="ltr" style={valueStyle}>
                    {projection.trackingUrl}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                ...valueStyle,
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {projection.customerNote}
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onConfirm={handleConfirmDelivery}
        title={td("confirmTitle")}
        message={td("confirmBody")}
        confirmLabel={td("confirmCta")}
        cancelLabel={td("confirmBack")}
        isPending={isPending}
        destructive={false}
      />

      <RequestOrderContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        orderId={projection.id}
      />
    </div>
  );
}
