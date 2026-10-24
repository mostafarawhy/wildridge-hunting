import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminQuoteDetail,
  getAdminQuoteLinkedRecords,
} from "@/lib/db/queries/quote";
import { getSetting } from "@/lib/db/queries/settings";
import { can } from "@/lib/utils/staff-permissions";
import { formatAED, sumMoney } from "@/lib/utils/currency";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  CONVERTED_QUOTE_LABEL,
  QUOTE_STATUS_LABELS,
  isTerminalQuoteStatus,
} from "@/lib/utils/quote-status";
import { AdminPageHeader } from "@/components/admin";
import CopyTextButton from "@/components/admin/CopyTextButton";
import QuoteManageActions from "@/components/admin/QuoteManageActions";
import QuotePricingForm from "@/components/admin/QuotePricingForm";
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

const addonStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const strongLabelStyle: React.CSSProperties = {
  ...labelStyle,
  color: "#0b0b0b",
};

const strongValueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-semibold)",
  color: "#0b0b0b",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminQuoteDetailPage({ params }: Props) {
  const { id } = await params;
  const { staffRole } = await requireStaff("quote:read");
  const [detail, defaultNote] = await Promise.all([
    getAdminQuoteDetail(id),
    getSetting("quote_default_note"),
  ]);

  if (!detail) notFound();

  const linked = await getAdminQuoteLinkedRecords(id);

  const canManage = can(staffRole, "quote:manage");
  const canCreateTicket = can(staffRole, "ticket:manage");
  const canViewCustomer = can(staffRole, "customer:read");
  const canViewB2B = can(staffRole, "b2b:read");
  const canViewOrder = can(staffRole, "order:read");
  const canViewTickets = can(staffRole, "ticket:read");
  const canViewVerification =
    can(staffRole, "verification:review") &&
    detail.customer.latestVerificationEventId !== null;
  const isTerminal = isTerminalQuoteStatus(detail.status);
  const canPrice = canManage && !isTerminal;

  const idStatusStyle = STATUS_STYLES[detail.customer.verificationStatus] ?? {};
  const b2bStatusStyle = STATUS_STYLES[detail.b2bAccount.derivedStatus] ?? {};

  const itemCount = detail.items.length;
  const timelineEvents = [...detail.events].reverse();

  const addr = detail.shippingAddress;

  const goodsSubtotalAed = sumMoney(
    detail.items.map((i) => i.quotedLineTotalAed ?? 0),
  );
  const addonsSubtotalAed = sumMoney(
    detail.items.flatMap((i) =>
      i.selectedAddons.map((a) => a.quotedLineTotalAed ?? 0),
    ),
  );
  const agreedTotalAed =
    detail.quotedTotalAed != null && detail.shippingCostAed != null
      ? sumMoney([detail.quotedTotalAed, detail.shippingCostAed])
      : null;

  const summaryRows: {
    label: string;
    value: string;
    strong?: boolean;
    topRule?: boolean;
  }[] = [];
  if (detail.quotedTotalAed != null) {
    summaryRows.push({
      label: "Goods",
      value: formatAED(goodsSubtotalAed, "en"),
    });
    if (addonsSubtotalAed > 0) {
      summaryRows.push({
        label: "Add-ons",
        value: formatAED(addonsSubtotalAed, "en"),
      });
    }
    summaryRows.push({
      label: "Quoted Total",
      value: formatAED(detail.quotedTotalAed, "en"),
    });
  }
  if (detail.shippingCostAed != null) {
    summaryRows.push({
      label: "Shipping Cost",
      value: formatAED(detail.shippingCostAed, "en"),
    });
  }
  if (agreedTotalAed != null) {
    summaryRows.push({
      label: "Customer Pays",
      value: formatAED(agreedTotalAed, "en"),
      strong: true,
      topRule: true,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/quotes"
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
          Back to Quotes
        </Link>

        <AdminPageHeader
          title={detail.quoteNumber}
          subtitle={`Submitted ${formatDisplayDate(detail.createdAt, "en")} · ${detail.companyNameEn} · ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
          actions={
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <CopyTextButton value={detail.quoteNumber} />
              <QuoteStatusPill
                status={detail.status}
                label={
                  detail.convertedOrderId != null
                    ? CONVERTED_QUOTE_LABEL
                    : undefined
                }
              />
              {canCreateTicket && (
                <Link
                  href={`/admin/tickets?quoteRequestId=${detail.id}`}
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
              <p style={labelStyle}>Quote status</p>
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
                <p style={labelStyle}>Quote now</p>
                <QuoteStatusPill
                  status={detail.status}
                  label={
                    detail.convertedOrderId != null
                      ? CONVERTED_QUOTE_LABEL
                      : undefined
                  }
                />
              </div>
              {agreedTotalAed != null && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <p style={labelStyle}>Customer pays</p>
                  <p style={strongValueStyle}>
                    {formatAED(agreedTotalAed, "en")}
                  </p>
                </div>
              )}
              <QuoteManageActions
                quoteId={detail.id}
                status={detail.status}
                canManage={canManage}
                convertedOrderNumber={detail.convertedOrderNumber}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Linked records</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              <div style={{ padding: "0.875rem 0 0" }}>
                <p style={labelStyle}>Business account</p>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.875rem 0",
                }}
              >
                {canViewB2B ? (
                  <Link
                    href={`/admin/b2b/${detail.b2bAccount.id}`}
                    style={linkStyle}
                  >
                    {detail.b2bAccount.companyNameEn}
                  </Link>
                ) : (
                  <span style={{ ...valueStyle }}>
                    {detail.b2bAccount.companyNameEn}
                  </span>
                )}
                <span style={{ ...pillStyle, ...b2bStatusStyle }}>
                  {detail.b2bAccount.derivedStatus}
                </span>
              </div>

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>Customer</p>
              </div>
              {[
                { label: "Name", value: detail.customer.name },
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
                <p style={labelStyle}>Converted order</p>
              </div>
              {detail.convertedOrderId && detail.convertedOrderNumber ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  {canViewOrder ? (
                    <Link
                      href={`/admin/orders/${detail.convertedOrderId}`}
                      style={{ ...linkStyle, fontFamily: "monospace" }}
                      dir="ltr"
                    >
                      {detail.convertedOrderNumber}
                    </Link>
                  ) : (
                    <span
                      style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                      dir="ltr"
                    >
                      {detail.convertedOrderNumber}
                    </span>
                  )}
                  {detail.convertedOrderStatus && (
                    <OrderStatusPill status={detail.convertedOrderStatus} />
                  )}
                </div>
              ) : (
                <p style={emptyStyle}>Not converted yet.</p>
              )}

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>
                  Tickets on this quote · {linked.tickets.total}
                </p>
              </div>
              {linked.tickets.items.length === 0 ? (
                <p style={emptyStyle}>No tickets on this quote.</p>
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
                      href={`/admin/tickets?q=${encodeURIComponent(detail.quoteNumber)}&status=ALL`}
                      style={{ ...linkStyle, paddingBottom: "0.875rem" }}
                    >
                      View all
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Details</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                {
                  label: "Submitted",
                  value: formatDisplayDate(detail.createdAt, "en"),
                },
                {
                  label: "Quoted on",
                  value: detail.quotedAt
                    ? formatDisplayDate(detail.quotedAt, "en")
                    : "—",
                },
                {
                  label: "Quoted by",
                  value: detail.quotedByStaffName ?? "—",
                },
                {
                  label: "Shipping method",
                  value: detail.shippingMethodLabel ?? "—",
                },
                { label: "Items", value: String(itemCount) },
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
                  <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
                </div>
              ))}
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
          {canPrice && (
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
                <p style={labelStyle}>Pricing</p>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  Prices entered are VAT-inclusive.
                </p>
              </div>
              <div style={{ padding: "1.25rem" }}>
                <QuotePricingForm
                  quoteId={detail.id}
                  items={detail.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    quotedUnitPriceAed: item.quotedUnitPriceAed,
                    requestedQuantity: item.requestedQuantity,
                    selectedAddons: item.selectedAddons,
                  }))}
                  defaultSendNote={defaultNote.body}
                  existingSendNote={detail.sendNote}
                  existingShippingCostAed={detail.shippingCostAed}
                  existingShippingMethodLabel={detail.shippingMethodLabel}
                />
              </div>
            </div>
          )}

          {!canPrice && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <p style={labelStyle}>
                  Items{" "}
                  <span style={{ color: "var(--color-content-tertiary)" }}>
                    · {itemCount}
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
                          {item.name}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                          }}
                        >
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <div style={{ textAlign: "end", flexShrink: 0 }}>
                        <p style={valueStyle}>
                          {item.quotedUnitPriceAed != null
                            ? formatAED(item.quotedUnitPriceAed, "en")
                            : "—"}
                        </p>
                        {item.quotedLineTotalAed != null && (
                          <p
                            style={{
                              fontSize: "var(--text-body-sm)",
                              color: "#6b6b6b",
                            }}
                          >
                            Line: {formatAED(item.quotedLineTotalAed, "en")}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.selectedAddons.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          paddingInlineStart: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.375rem",
                        }}
                      >
                        {item.selectedAddons.map((addon) => (
                          <div
                            key={addon.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "1rem",
                            }}
                          >
                            <p style={addonStyle}>+ {addon.name}</p>
                            <div style={{ textAlign: "end", flexShrink: 0 }}>
                              <p style={addonStyle}>
                                {addon.quotedUnitPriceAed != null
                                  ? `${formatAED(addon.quotedUnitPriceAed, "en")} × ${addon.quantity}`
                                  : `× ${addon.quantity}`}
                              </p>
                              <p style={addonStyle}>
                                {addon.quotedLineTotalAed != null
                                  ? `Line: ${formatAED(addon.quotedLineTotalAed, "en")}`
                                  : "Line: —"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!canPrice && detail.quotedTotalAed != null && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <p style={labelStyle}>Quote Summary</p>
              </div>
              <div style={{ padding: "0 1.25rem" }}>
                {summaryRows.map((row, idx, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderTop: row.topRule ? "1px solid #0b0b0b" : "none",
                      borderBottom:
                        idx < arr.length - 1 && !arr[idx + 1].topRule
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    <p style={row.strong ? strongLabelStyle : labelStyle}>
                      {row.label}
                    </p>
                    <p
                      style={{
                        ...(row.strong ? strongValueStyle : valueStyle),
                        textAlign: "end",
                      }}
                    >
                      {row.value}
                    </p>
                  </div>
                ))}
                {detail.shippingCostAed == null && (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      padding: "0.875rem 0",
                    }}
                  >
                    Shipping not quoted yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {!canPrice && detail.quotedTotalAed == null && (
            <div style={cardStyle}>
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                Not priced yet.
              </p>
            </div>
          )}

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Business Identity (at submission)</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                {
                  label: "Legal Entity",
                  value: (
                    <>
                      <span>{detail.snapshotLegalNameEn ?? "—"}</span>
                      {detail.snapshotLegalNameAr && (
                        <span dir="rtl" style={{ display: "block" }}>
                          {detail.snapshotLegalNameAr}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  label: "Trade Licence",
                  value: (
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {detail.snapshotTradeLicenseNo ?? "—"}
                    </span>
                  ),
                },
                {
                  label: "VAT Number",
                  value: (
                    <span dir="ltr" style={{ fontFamily: "monospace" }}>
                      {detail.snapshotVatNumber ?? "—"}
                    </span>
                  ),
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
                  <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Delivery</p>
            </div>
            {addr ? (
              <div style={{ padding: "0 1.25rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  <p style={{ ...labelStyle, flexShrink: 0 }}>Ship to</p>
                  <div style={{ ...valueStyle, textAlign: "end" }}>
                    <p style={{ color: "#0b0b0b" }}>{addr.fullName}</p>
                    <p style={{ color: "#6b6b6b" }}>{`${addr.addressLine1}${addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, ${addr.city}, ${addr.emirate}, ${addr.country}`}</p>
                    <p>
                      <span dir="ltr" style={{ color: "#6b6b6b" }}>{addr.phone}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No delivery address on this quote.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Notes</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                { label: "Customer note", value: detail.customerNote ?? "—" },
                ...(detail.sendNote
                  ? [{ label: "Note sent to customer", value: detail.sendNote }]
                  : []),
                ...(detail.internalNote
                  ? [{ label: "Internal note", value: detail.internalNote }]
                  : []),
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
                        {event.fromStatus === "QUOTED" &&
                        event.toStatus === "QUOTED"
                          ? "Prices revised"
                          : `${event.fromStatus ? `${QUOTE_STATUS_LABELS[event.fromStatus]} → ` : ""}${QUOTE_STATUS_LABELS[event.toStatus]}`}
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
                      {event.note && (
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                          }}
                        >
                          {event.note}
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
