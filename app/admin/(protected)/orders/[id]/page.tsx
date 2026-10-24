import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminOrderDetail,
  getAdminOrderLinkedRecords,
  getOrderUnwindPreview,
} from "@/lib/db/queries/order";
import type { RefundMethod } from "@/app/generated/prisma/client";
import { REFUND_METHOD_LABELS } from "@/lib/utils/refund";
import { getSetting } from "@/lib/db/queries/settings";
import { can } from "@/lib/utils/staff-permissions";
import { formatAED, sumMoney, roundMoney } from "@/lib/utils/currency";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  CANCELLABLE_STATUSES,
  ORDER_STATUS_LABELS,
  RETURNABLE_STATUSES,
} from "@/lib/utils/order-status";
import {
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
} from "@/lib/utils/payment-method";
import { CONVERTED_QUOTE_LABEL } from "@/lib/utils/quote-status";
import { isHttpUrl } from "@/lib/utils/tracking-url";
import { AdminPageHeader } from "@/components/admin";
import CopyTextButton from "@/components/admin/CopyTextButton";
import OrderManageActions from "@/components/admin/OrderManageActions";
import OrderComplianceCard from "@/components/admin/OrderComplianceCard";
import { DeliveryProofActions } from "@/components/admin/DeliverOrderModal";
import PaymentProofActions from "@/components/admin/PaymentProofActions";
import OrderRefundsCard from "@/components/admin/OrderRefundsCard";
import OrderStatusPill from "@/components/ui/OrderStatusPill";
import QuoteStatusPill from "@/components/ui/QuoteStatusPill";
import TicketStatusPill from "@/components/ui/TicketStatusPill";

const STATUS_STYLES: Record<
  string,
  { backgroundColor: string; color: string }
> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#166534" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  SUSPENDED: { backgroundColor: "#f3f4f6", color: "#374151" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
  NOT_REQUIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  NGENIUS: "N-Genius",
  MANUAL: "Offline",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

const linkStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-action-primary)",
  textDecoration: "none",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  padding: "0.875rem 0",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  paddingInline: "0.625rem",
  paddingBlock: "0.25rem",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  borderRadius: "0",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--color-shop-divider)",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ do?: string }>;
}

const ORDER_PAGE_ACTIONS = [
  "pay",
  "deliver",
  "refund",
  "cancel",
  "return",
] as const;

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function settlementDetail(rawPayload: unknown): string | null {
  if (!isPlainObj(rawPayload)) return null;
  if (rawPayload.source === "serials") {
    const n = typeof rawPayload.units === "number" ? rawPayload.units : 0;
    return `${n} serial ${n === 1 ? "entry" : "entries"} recorded`;
  }
  if (rawPayload.source === "shipment") {
    const shipmentParts: string[] = [];
    if (typeof rawPayload.carrier === "string" && rawPayload.carrier.trim()) {
      shipmentParts.push(rawPayload.carrier);
    }
    if (typeof rawPayload.parcelCount === "number") {
      shipmentParts.push(
        `${rawPayload.parcelCount} ${rawPayload.parcelCount === 1 ? "parcel" : "parcels"}`,
      );
    }
    if (
      typeof rawPayload.estimatedDelivery === "string" &&
      rawPayload.estimatedDelivery
    ) {
      shipmentParts.push(
        `est. ${formatDisplayDate(rawPayload.estimatedDelivery, "en")}`,
      );
    }
    return shipmentParts.length > 0 ? shipmentParts.join(" · ") : null;
  }
  if (
    rawPayload.source === "delivery" ||
    rawPayload.source === "delivery_details"
  ) {
    const deliveryParts: string[] = [];
    if (typeof rawPayload.receivedBy === "string" && rawPayload.receivedBy) {
      deliveryParts.push(`Received by ${rawPayload.receivedBy}`);
    }
    if (typeof rawPayload.idChecked === "boolean") {
      deliveryParts.push(`ID checked ${rawPayload.idChecked ? "Yes" : "No"}`);
    }
    if (rawPayload.proof === true) deliveryParts.push("proof on file");
    return deliveryParts.length > 0 ? deliveryParts.join(" · ") : null;
  }
  if (rawPayload.source === "cancel") {
    const cancelParts: string[] = [];
    if (typeof rawPayload.refundDue === "number" && rawPayload.refundDue > 0) {
      cancelParts.push(`Refund owed ${formatAED(rawPayload.refundDue, "en")}`);
    }
    const units = Array.isArray(rawPayload.stock)
      ? rawPayload.stock.reduce(
          (sum: number, line: unknown) =>
            sum +
            (isPlainObj(line) && typeof line.units === "number"
              ? line.units
              : 0),
          0,
        )
      : 0;
    if (units > 0) {
      cancelParts.push(`${units} ${units === 1 ? "unit" : "units"} back`);
    }
    return cancelParts.length > 0 ? cancelParts.join(" · ") : null;
  }
  if (rawPayload.source === "return") {
    const returnParts: string[] = [
      rawPayload.restock === true ? "Stock back in" : "Kept out of stock",
    ];
    if (typeof rawPayload.refundDue === "number" && rawPayload.refundDue > 0) {
      returnParts.push(`Refund owed ${formatAED(rawPayload.refundDue, "en")}`);
    }
    return returnParts.join(" · ");
  }
  if (rawPayload.source === "refund_due") {
    return typeof rawPayload.amount === "number"
      ? `Refund owed +${formatAED(rawPayload.amount, "en")}`
      : null;
  }
  if (rawPayload.source === "refund") {
    const refundParts: string[] = [];
    if (typeof rawPayload.amount === "number") {
      refundParts.push(formatAED(rawPayload.amount, "en"));
    }
    const refundLabel =
      typeof rawPayload.methodOtherLabel === "string" &&
      rawPayload.methodOtherLabel.trim()
        ? rawPayload.methodOtherLabel
        : typeof rawPayload.method === "string" &&
            rawPayload.method in REFUND_METHOD_LABELS
          ? REFUND_METHOD_LABELS[rawPayload.method as RefundMethod]
          : null;
    if (refundLabel) refundParts.push(refundLabel);
    if (
      typeof rawPayload.externalReference === "string" &&
      rawPayload.externalReference.trim()
    ) {
      refundParts.push(`Ref ${rawPayload.externalReference}`);
    }
    if (typeof rawPayload.owedAfter === "number") {
      refundParts.push(
        rawPayload.owedAfter === 0
          ? "Refunded in full"
          : `${formatAED(rawPayload.owedAfter, "en")} owed`,
      );
    }
    return refundParts.length > 0 ? refundParts.join(" · ") : null;
  }
  if (rawPayload.source !== "mark_paid") return null;
  const parts: string[] = [];
  if (typeof rawPayload.amount === "number") {
    parts.push(formatAED(rawPayload.amount, "en"));
  }
  const label =
    typeof rawPayload.methodOtherLabel === "string" &&
    rawPayload.methodOtherLabel.trim()
      ? rawPayload.methodOtherLabel
      : typeof rawPayload.method === "string"
        ? paymentMethodLabel(rawPayload.method)
        : null;
  if (label) parts.push(label);
  if (
    typeof rawPayload.externalReference === "string" &&
    rawPayload.externalReference.trim()
  ) {
    parts.push(`Ref ${rawPayload.externalReference}`);
  }
  if (typeof rawPayload.remaining === "number") {
    parts.push(
      rawPayload.remaining === 0
        ? "Settled in full"
        : `${formatAED(rawPayload.remaining, "en")} outstanding`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { do: doParam } = await searchParams;
  const initialAction =
    ORDER_PAGE_ACTIONS.find((action) => action === doParam) ?? null;
  const { staffRole } = await requireStaff("order:read");
  const [detail, tax] = await Promise.all([
    getAdminOrderDetail(id),
    getSetting("tax_config"),
  ]);

  if (!detail) notFound();

  const linked = await getAdminOrderLinkedRecords(id, detail.couponCode);

  const unwindPreview =
    can(staffRole, "order:update") &&
    (CANCELLABLE_STATUSES.includes(detail.status) ||
      RETURNABLE_STATUSES.includes(detail.status))
      ? await getOrderUnwindPreview(id)
      : null;

  const outstandingAed = roundMoney(
    detail.totalAed - sumMoney(detail.settlements.map((s) => s.amountAed)),
  );

  const addr = detail.shippingAddressSnapshot;

  const canViewCustomer = can(staffRole, "customer:read");
  const canViewTickets = can(staffRole, "ticket:read");
  const canViewQuotes = can(staffRole, "quote:read");
  const canViewCoupon = can(staffRole, "coupon:manage");
  const canViewVerification =
    can(staffRole, "verification:review") &&
    detail.customer.latestVerificationEventId !== null;

  const idStatusStyle = STATUS_STYLES[detail.customer.verificationStatus] ?? {};

  const productCount = detail.items.filter(
    (item) => item.itemType === "PRODUCT",
  ).length;

  const deliveredEvent = [...detail.events]
    .reverse()
    .find((e) => e.toStatus === "DELIVERED" && e.fromStatus !== "DELIVERED");
  const deliveredByLabel =
    deliveredEvent?.actor === "STAFF"
      ? (deliveredEvent.staffName ?? "Staff")
      : deliveredEvent?.actor === "CUSTOMER"
        ? "The customer"
        : "—";

  const serialItems = detail.items
    .filter((item) => item.itemType === "PRODUCT")
    .map((item) => ({
      id: item.id,
      productSku: item.productSku,
      name: item.name,
      quantity: item.quantity,
      serialTracking: item.serialTracking,
      serials: item.serials.map((entry) => ({
        unitIndex: entry.unitIndex,
        value: entry.value,
        overrideReason: entry.overrideReason,
      })),
    }));

  const complianceSerialRows = detail.items
    .filter((item) => item.itemType === "PRODUCT")
    .flatMap((item) =>
      Array.from({ length: item.quantity }, (_, i) => {
        const unitIndex = i + 1;
        const entry = item.serials.find((s) => s.unitIndex === unitIndex);
        return {
          itemName: item.name,
          sku: item.productSku,
          kind: (item.serialTracking === "LOT" ? "LOT" : "SERIAL") as
            | "SERIAL"
            | "LOT",
          unitIndex,
          value: entry?.value ?? null,
          overrideReason: entry?.overrideReason ?? null,
          recordedByName: entry?.recordedByName ?? null,
          updatedAt: entry?.updatedAt ?? null,
        };
      }),
    );

  const hasTracking =
    detail.trackingNumber ||
    detail.shippedAt ||
    detail.deliveredAt ||
    detail.carrier;

  const deliveryRows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Ship to",
      value: (
        <>
          <p style={{ color: "#0b0b0b" }}>{addr.fullName}</p>
          <p style={{ color: "#6b6b6b" }}>{`${addr.addressLine1}${addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, ${addr.city}, ${addr.emirate}, ${addr.country}`}</p>
          <p>
            <span dir="ltr" style={{ color: "#6b6b6b" }}>{addr.phone}</span>
          </p>
        </>
      ),
    },
    ...(detail.shippingQuotedAt
      ? [
          {
            label: "Shipping quote",
            value: (
              <span dir="ltr">
                {`${formatAED(detail.shippingCostAed, "en")} · ${detail.shippingQuotedByName ?? "—"} · ${formatDateTime(detail.shippingQuotedAt, "en")}`}
              </span>
            ),
          },
        ]
      : []),
    ...(hasTracking
      ? [
          ...(detail.carrier
            ? [{ label: "Carrier", value: detail.carrier }]
            : []),
          ...(detail.parcelCount !== null
            ? [{ label: "Parcels", value: String(detail.parcelCount) }]
            : []),
          ...(detail.trackingNumber
            ? [
                {
                  label: "Tracking Number",
                  value: (
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {detail.trackingNumber}
                    </span>
                  ),
                },
              ]
            : []),
          ...(detail.trackingUrl
            ? [
                {
                  label: "Tracking URL",
                  value: isHttpUrl(detail.trackingUrl) ? (
                    <a
                      href={detail.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      style={{ color: "var(--color-action-primary)" }}
                    >
                      {detail.trackingUrl}
                    </a>
                  ) : (
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {detail.trackingUrl}
                    </span>
                  ),
                },
              ]
            : []),
          ...(detail.shippedAt
            ? [
                {
                  label: "Shipped on",
                  value: formatDisplayDate(detail.shippedAt, "en"),
                },
              ]
            : []),
          ...(detail.estimatedDelivery
            ? [
                {
                  label: "Estimated delivery",
                  value: formatDisplayDate(detail.estimatedDelivery, "en"),
                },
              ]
            : []),
          ...(detail.shipmentNote
            ? [{ label: "Note to customer", value: detail.shipmentNote }]
            : []),
          ...(detail.deliveredAt
            ? [
                {
                  label: "Delivered on",
                  value: formatDisplayDate(detail.deliveredAt, "en"),
                },
              ]
            : []),
          ...(detail.deliveryReceivedBy !== null
            ? [
                { label: "Received by", value: detail.deliveryReceivedBy },
                {
                  label: "ID checked",
                  value:
                    detail.deliveryIdChecked === null
                      ? "—"
                      : detail.deliveryIdChecked
                        ? "Yes"
                        : "No",
                },
              ]
            : []),
          ...(detail.deliveredAt
            ? [
                {
                  label: "Confirmed by",
                  value: deliveredByLabel,
                },
              ]
            : []),
          ...(detail.deliveryProofFilename
            ? [
                {
                  label: "Proof",
                  value: (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span dir="ltr">{detail.deliveryProofFilename}</span>
                      <DeliveryProofActions
                        orderId={detail.id}
                        filename={detail.deliveryProofFilename}
                      />
                    </span>
                  ),
                },
              ]
            : []),
          ...(detail.deliveryNote
            ? [{ label: "Note", value: detail.deliveryNote }]
            : []),
        ]
      : [{ label: "Tracking", value: "Not shipped yet." }]),
  ];

  const loyaltyValue =
    detail.status === "DELIVERED"
      ? "credited"
      : detail.status === "CANCELLED" ||
          detail.status === "RETURNED" ||
          detail.status === "PAYMENT_FAILED" ||
          detail.status === "REFUNDED"
        ? "not credited"
        : "credited on delivery";

  const noteRows: { label: string; value: string }[] = [
    { label: "Customer note", value: detail.customerNote ?? "—" },
    ...(detail.internalNote !== null
      ? [{ label: "Internal note", value: detail.internalNote }]
      : []),
    ...(detail.loyaltyCreditedPoints > 0
      ? [
          {
            label: "Loyalty",
            value: `${detail.loyaltyCreditedPoints.toLocaleString("en-US")} points · credited`,
          },
        ]
      : detail.loyaltyPointsEarned > 0
        ? [
            {
              label: "Loyalty",
              value: `${detail.loyaltyPointsEarned.toLocaleString("en-US")} points · ${loyaltyValue}`,
            },
          ]
        : []),
  ];

  const timelineEvents = [...detail.events].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/orders"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            textDecoration: "none",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Orders
        </Link>

        <AdminPageHeader
          title={detail.orderNumber}
          subtitle={`Placed ${formatDisplayDate(detail.createdAt, "en")} · ${productCount} ${productCount === 1 ? "item" : "items"} · ${formatAED(detail.totalAed, "en")}`}
          actions={
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <CopyTextButton value={detail.orderNumber} />
              <OrderStatusPill status={detail.status} />
              {can(staffRole, "ticket:manage") && (
                <Link
                  href={`/admin/tickets?orderId=${detail.id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "2.5rem",
                    paddingInline: "1.25rem",
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-bold)",
                    letterSpacing: "var(--tracking-widest)",
                    textTransform: "uppercase",
                    backgroundColor: "#0b0b0b",
                    color: "#ffffff",
                    borderRadius: "0",
                    textDecoration: "none",
                  }}
                >
                  Create Ticket
                </Link>
              )}
            </div>
          }
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          flexDirection: "row-reverse",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        <div
          className="admin-review-rail"
          style={{
            flex: "1 1 320px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div style={{ ...cardStyle, borderTop: "3px solid #0b0b0b" }}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Order status</p>
            </div>
            <div
              style={{
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
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
                <p style={labelStyle}>Order now</p>
                <OrderStatusPill status={detail.status} />
              </div>
              <OrderManageActions
                orderId={detail.id}
                status={detail.status}
                deliveredAt={detail.deliveredAt}
                deliveryReceivedBy={detail.deliveryReceivedBy}
                regulated={detail.regulated}
                loyaltyPoints={detail.loyaltyPointsEarned}
                canManage={can(staffRole, "order:update")}
                canOverrideSerials={can(staffRole, "compliance:override")}
                serialItems={serialItems}
                subtotalAed={detail.subtotalAed}
                addonTotalAed={detail.addonTotalAed}
                discountAmountAed={detail.discountAmountAed}
                shippingCostAed={detail.shippingCostAed}
                shippingQuotedAt={detail.shippingQuotedAt}
                vatRate={tax.vatRate}
                canMarkPaid={can(staffRole, "order:mark_paid")}
                outstandingAed={outstandingAed}
                orderTotalAed={detail.totalAed}
                canRecordContact={can(staffRole, "order:record_contact")}
                canCreateTicket={can(staffRole, "ticket:manage")}
                customerEmail={detail.customer.email}
                orderNumber={detail.orderNumber}
                receivedAed={detail.receivedAed}
                refundDueAed={detail.refundDueAed}
                refundedAed={detail.refundedAed}
                owedAed={detail.owedAed}
                preview={unwindPreview}
                hasGatewayReference={detail.paymentRef !== null}
                initialAction={initialAction}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Linked records</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                { label: "Customer", value: detail.customer.name },
                {
                  label: "Email",
                  value: (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <span>{detail.customer.email}</span>
                      <CopyTextButton value={detail.customer.email} />
                    </span>
                  ),
                },
                {
                  label: "ID verification",
                  value: (
                    <span style={{ ...pillStyle, ...idStatusStyle }}>
                      {detail.customer.verificationStatus}
                    </span>
                  ),
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
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={labelStyle}>{row.label}</p>
                  <div style={{ ...valueStyle, textAlign: "end" }}>
                    {row.value}
                  </div>
                </div>
              ))}

              {(canViewCustomer || canViewVerification || canViewTickets) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                    padding: "0.875rem 0",
                    borderTop: "1px solid var(--color-shop-divider)",
                  }}
                >
                  {canViewCustomer && (
                    <Link
                      href={`/admin/customers/${detail.customer.id}`}
                      style={linkStyle}
                    >
                      Customer page
                    </Link>
                  )}
                  {canViewVerification && (
                    <Link
                      href={`/admin/verification/${detail.customer.latestVerificationEventId}`}
                      style={linkStyle}
                    >
                      ID review
                    </Link>
                  )}
                  {canViewTickets && (
                    <Link
                      href={`/admin/tickets?customerId=${detail.customer.id}&status=ALL`}
                      style={linkStyle}
                    >
                      All tickets
                    </Link>
                  )}
                </div>
              )}

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>Source quote</p>
              </div>
              {detail.quoteRequestId && detail.quoteRequestNumber ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  {canViewQuotes ? (
                    <Link
                      href={`/admin/quotes/${detail.quoteRequestId}`}
                      style={{ ...linkStyle, fontFamily: "monospace" }}
                      dir="ltr"
                    >
                      {detail.quoteRequestNumber}
                    </Link>
                  ) : (
                    <span
                      style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                      dir="ltr"
                    >
                      {detail.quoteRequestNumber}
                    </span>
                  )}
                  <div style={{ textAlign: "end", flexShrink: 0 }}>
                    {detail.quoteRequestStatus && (
                      <QuoteStatusPill
                        status={detail.quoteRequestStatus}
                        label={CONVERTED_QUOTE_LABEL}
                      />
                    )}
                    {detail.quoteRequestCreatedAt && (
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.25rem",
                        }}
                      >
                        {formatDisplayDate(detail.quoteRequestCreatedAt, "en")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p style={emptyStyle}>Not from a quote.</p>
              )}

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>Coupon</p>
              </div>
              {detail.couponCode ? (
                <div style={{ padding: "0.875rem 0" }}>
                  {linked.couponId && canViewCoupon ? (
                    <Link
                      href={`/admin/coupons/${linked.couponId}`}
                      style={{ ...linkStyle, fontFamily: "monospace" }}
                      dir="ltr"
                    >
                      {detail.couponCode}
                    </Link>
                  ) : (
                    <span
                      style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                      dir="ltr"
                    >
                      {detail.couponCode}
                    </span>
                  )}
                </div>
              ) : (
                <p style={emptyStyle}>No coupon on this order.</p>
              )}

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>
                  Tickets on this order · {linked.tickets.total}
                </p>
              </div>
              {linked.tickets.items.length === 0 ? (
                <p style={emptyStyle}>No tickets on this order.</p>
              ) : (
                linked.tickets.items.map((ticket, idx, arr) => (
                  <div
                    key={ticket.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < arr.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    {canViewTickets ? (
                      <Link
                        href={`/admin/tickets/${ticket.id}`}
                        style={{ ...linkStyle, fontFamily: "monospace" }}
                        dir="ltr"
                      >
                        {ticket.ticketNumber}
                      </Link>
                    ) : (
                      <span
                        style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                        dir="ltr"
                      >
                        {ticket.ticketNumber}
                      </span>
                    )}
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <TicketStatusPill status={ticket.status} />
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.25rem",
                        }}
                      >
                        {formatDisplayDate(ticket.createdAt, "en")}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {linked.tickets.total > 5 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <p style={{ ...emptyStyle, paddingTop: 0 }}>
                    Latest 5 of {linked.tickets.total}
                  </p>
                  {canViewTickets && (
                    <Link
                      href={`/admin/tickets?q=${encodeURIComponent(detail.orderNumber)}&status=ALL`}
                      style={{ ...linkStyle, paddingBottom: "0.875rem" }}
                    >
                      View all
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "2 1 560px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>
                Items{" "}
                <span style={{ color: "var(--color-content-tertiary)" }}>
                  · {detail.items.length}
                </span>
              </p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {detail.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: "0.875rem 0",
                    borderBottom:
                      idx < detail.items.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
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
                    <div>
                      <p
                        style={{
                          ...valueStyle,
                          fontWeight: "var(--font-medium)",
                        }}
                      >
                        {item.itemType === "ADDON" ? "+ " : ""}
                        {item.name}
                      </p>
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.125rem",
                        }}
                      >
                        {item.quantity} × {formatAED(item.unitPriceAed, "en")}
                      </p>
                    </div>
                    <p style={{ ...valueStyle, textAlign: "end", flexShrink: 0 }}>
                      {formatAED(item.lineTotalAed, "en")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Order Summary</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                {
                  label: "Goods subtotal",
                  value: formatAED(detail.subtotalAed, "en"),
                },
                ...(detail.addonTotalAed > 0
                  ? [
                      {
                        label: "Add-ons",
                        value: formatAED(detail.addonTotalAed, "en"),
                      },
                    ]
                  : []),
                {
                  label: "Shipping",
                  value: formatAED(detail.shippingCostAed, "en"),
                },
                ...(detail.discountAmountAed > 0
                  ? [
                      {
                        label: "Discount",
                        value: formatAED(detail.discountAmountAed, "en"),
                      },
                    ]
                  : []),
                ...(detail.loyaltyPointsUsed > 0 ? [{ label: `Points (${detail.loyaltyPointsUsed.toLocaleString("en-US")})`, value: formatAED(detail.loyaltyDiscountAmountAed, "en") }] : []),
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
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={labelStyle}>{row.label}</p>
                  <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 0",
                  borderTop: "1px solid #0b0b0b",
                }}
              >
                <p style={{ ...labelStyle, fontWeight: "var(--font-semibold)" }}>
                  Total
                </p>
                <p
                  style={{
                    ...valueStyle,
                    textAlign: "end",
                    fontWeight: "var(--font-semibold)",
                  }}
                >
                  {formatAED(detail.totalAed, "en")}
                </p>
              </div>
              <div style={{ paddingBottom: "0.875rem" }}>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  VAT included: {formatAED(detail.taxAmountAed, "en")}
                </p>
                {tax.storeTrn && (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      marginTop: "0.125rem",
                    }}
                  >
                    Store TRN{" "}
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {tax.storeTrn}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Payment</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                {
                  label: "Provider",
                  value:
                    PAYMENT_PROVIDER_LABELS[detail.paymentProvider] ??
                    detail.paymentProvider,
                },
                {
                  label: "Reference",
                  value: detail.paymentRef ? (
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {detail.paymentRef}
                    </span>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Paid on",
                  value: detail.paidAt
                    ? formatDisplayDate(detail.paidAt, "en")
                    : "—",
                },
              ].map((row, idx, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                    borderBottom:
                      idx < arr.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
                  <div style={{ ...valueStyle, textAlign: "end" }}>
                    {row.value}
                  </div>
                </div>
              ))}
              {detail.paymentProvider === "MANUAL" &&
                detail.settlements.length === 0 && (
                  <p
                    style={{
                      ...emptyStyle,
                      borderTop: "1px solid var(--color-shop-divider)",
                    }}
                  >
                    No payments recorded yet.
                  </p>
                )}
            </div>
          </div>

          {detail.settlements.length > 0 && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <p style={labelStyle}>
                  Payments{" "}
                  <span style={{ color: "var(--color-content-tertiary)" }}>
                    · {detail.settlements.length}
                  </span>
                </p>
              </div>
              <div>
                {detail.settlements.map((s, idx) => (
                  <div key={s.id}>
                    <div
                      style={{
                        padding: "1rem 1.25rem 0.5rem",
                        backgroundColor: "#fafafa",
                        borderTop:
                          idx > 0
                            ? "1px solid var(--color-shop-divider)"
                            : "none",
                        borderBottom: "1px solid var(--color-shop-divider)",
                      }}
                    >
                      <p style={labelStyle}>Settlement {idx + 1}</p>
                    </div>
                    <div style={{ padding: "0 1.25rem" }}>
                      {[
                        {
                          label: "Amount",
                          value: (
                            <span dir="ltr">
                              {formatAED(s.amountAed, "en")}
                            </span>
                          ),
                        },
                        {
                          label: "Method",
                          value:
                            s.methodOtherLabel ??
                            PAYMENT_METHOD_LABELS[s.method],
                        },
                        {
                          label: "Reference",
                          value: <span dir="ltr">{s.externalReference}</span>,
                        },
                        {
                          label: "Paid At",
                          value: formatDisplayDate(s.paidAt, "en"),
                        },
                        {
                          label: "Recorded By",
                          value: s.recordedByName ?? "—",
                        },
                        {
                          label: "Proof",
                          value: (
                            <span
                              style={{
                                display: "inline-flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: "0.5rem",
                              }}
                            >
                              <span>
                                {s.mimeType
                                  ? `${s.filename} (${s.mimeType})`
                                  : s.filename}
                              </span>
                              {can(staffRole, "order:mark_paid") && (
                                <PaymentProofActions
                                  orderId={detail.id}
                                  paymentId={s.id}
                                  filename={s.filename}
                                />
                              )}
                            </span>
                          ),
                        },
                        ...(s.notes
                          ? [{ label: "Note", value: s.notes }]
                          : []),
                      ].map((row, rowIdx, arr) => (
                        <div
                          key={row.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "1rem",
                            padding: "0.875rem 0",
                            borderBottom:
                              rowIdx < arr.length - 1
                                ? "1px solid var(--color-shop-divider)"
                                : "none",
                          }}
                        >
                          <p style={{ ...labelStyle, flexShrink: 0 }}>
                            {row.label}
                          </p>
                          <p style={{ ...valueStyle, textAlign: "end" }}>
                            {row.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <OrderRefundsCard
            orderId={detail.id}
            receivedAed={detail.receivedAed}
            refundDueAed={detail.refundDueAed}
            refundedAed={detail.refundedAed}
            owedAed={detail.owedAed}
            refundState={detail.refundState}
            refunds={detail.refunds}
            canMarkPaid={can(staffRole, "order:mark_paid")}
            openRecordOnMount={initialAction === "refund"}
          />

          <OrderComplianceCard
            orderId={detail.id}
            status={detail.status}
            regulated={detail.regulated}
            snapshot={detail.complianceSnapshot}
            documents={detail.complianceDocuments}
            serials={complianceSerialRows}
            serialProgress={detail.serialProgress}
            shipment={{
              carrier: detail.carrier,
              parcelCount: detail.parcelCount,
              trackingNumber: detail.trackingNumber,
              shippedAt: detail.shippedAt,
              estimatedDelivery: detail.estimatedDelivery,
              note: detail.shipmentNote,
            }}
            delivery={{
              deliveredAt: detail.deliveredAt,
              receivedBy: detail.deliveryReceivedBy,
              idChecked: detail.deliveryIdChecked,
              confirmedBy: deliveredByLabel,
              hasProof: detail.deliveryProofFilename !== null,
              note: detail.deliveryNote,
            }}
            canArchive={can(staffRole, "order:update")}
            canViewVerificationDocs={can(staffRole, "verification:review")}
            canViewB2BDocs={can(staffRole, "b2b:read")}
            canOverrideSerials={can(staffRole, "compliance:override")}
            serialItems={serialItems}
          />

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Delivery</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {deliveryRows.map((row, idx, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                    borderBottom:
                      idx < arr.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
                  <div style={{ ...valueStyle, textAlign: "end" }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Notes</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {noteRows.map((row, idx, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                    borderBottom:
                      idx < arr.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
                  <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                ...cardHeaderStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <p style={labelStyle}>
                Timeline{" "}
                <span style={{ color: "var(--color-content-tertiary)" }}>
                  · {detail.events.length}
                </span>
              </p>
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                Newest first
              </p>
            </div>
            {timelineEvents.length === 0 ? (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No events yet.
              </p>
            ) : (
              <div style={{ padding: "0 1.25rem" }}>
                {timelineEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < timelineEvents.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          ...valueStyle,
                          fontWeight: "var(--font-medium)",
                        }}
                      >
                        {event.fromStatus && event.fromStatus !== event.toStatus
                          ? `${ORDER_STATUS_LABELS[event.fromStatus]} → `
                          : ""}
                        {ORDER_STATUS_LABELS[event.toStatus]}
                      </p>
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.125rem",
                        }}
                      >
                        {event.actor}
                        {event.staffName ? ` · ${event.staffName}` : ""}
                      </p>
                      {settlementDetail(event.rawPayload) && (
                        <p
                          dir="ltr"
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#0b0b0b",
                            marginTop: "0.125rem",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {settlementDetail(event.rawPayload)}
                        </p>
                      )}
                      {event.note && (
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                            borderInlineStart:
                              "3px solid var(--color-status-warning)",
                            paddingInlineStart: "0.75rem",
                            minWidth: 0,
                          }}
                        >
                          {event.note}
                        </p>
                      )}
                      {event.trackingNumber && (
                        <p
                          dir="ltr"
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                            fontFamily: "monospace",
                          }}
                        >
                          {event.trackingNumber}
                        </p>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                        flexShrink: 0,
                        textAlign: "end",
                      }}
                    >
                      {formatDateTime(event.createdAt, "en")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
