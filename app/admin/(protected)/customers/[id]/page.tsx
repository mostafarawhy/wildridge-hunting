import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import { getAdminCustomerDetail } from "@/lib/db/queries/customer";
import { getAuditLogList } from "@/lib/db/queries/audit-log";
import { can } from "@/lib/utils/staff-permissions";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from "@/lib/utils/ticket-status";
import OrderStatusPill from "@/components/ui/OrderStatusPill";
import QuoteStatusPill from "@/components/ui/QuoteStatusPill";
import CopyTextButton from "@/components/admin/CopyTextButton";
import EntityEventThread from "@/components/admin/EntityEventThread";
import CustomerManageActions from "@/components/admin/CustomerManageActions";
import CustomerLoyaltyCard from "@/components/admin/CustomerLoyaltyCard";

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

const tileStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  padding: "1.25rem 1.5rem",
};

const tileLabelStyle: React.CSSProperties = {
  ...labelStyle,
  marginBottom: "0.5rem",
};

const tileValueStyle: React.CSSProperties = {
  fontSize: "var(--text-heading)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  lineHeight: "var(--leading-tight)",
};

const tileSubStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  marginTop: "0.375rem",
};

const pillBase: React.CSSProperties = {
  paddingInline: "0.5rem",
  paddingBlock: "0.125rem",
  fontSize: "var(--text-label)",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const linkStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-action-primary)",
  textDecoration: "none",
};

const numberStyle: React.CSSProperties = {
  fontFamily: "monospace",
  color: "var(--color-action-primary)",
  textDecoration: "none",
};

const plainNumberStyle: React.CSSProperties = {
  fontFamily: "monospace",
  color: "#0b0b0b",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  padding: "0.875rem 0",
};

const columnStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const NEUTRAL_PILL = { backgroundColor: "#f3f4f6", color: "#374151" };
const PENDING_PILL = { backgroundColor: "#fef9c3", color: "#854d0e" };
const APPROVED_PILL = { backgroundColor: "#dcfce7", color: "#166534" };
const REJECTED_PILL = { backgroundColor: "#fee2e2", color: "#991b1b" };

const ID_PILLS: Record<
  string,
  { label: string; backgroundColor: string; color: string }
> = {
  NOT_REQUIRED: { label: "Not required", ...NEUTRAL_PILL },
  PENDING: { label: "Pending", ...PENDING_PILL },
  APPROVED: { label: "Approved", ...APPROVED_PILL },
  REJECTED: { label: "Rejected", ...REJECTED_PILL },
  EXPIRED: { label: "Expired", ...NEUTRAL_PILL },
};

const B2B_PILLS: Record<
  string,
  { label: string; backgroundColor: string; color: string }
> = {
  PENDING: { label: "Pending", ...PENDING_PILL },
  APPROVED: { label: "Approved", ...APPROVED_PILL },
  EXPIRED: { label: "Expired", ...NEUTRAL_PILL },
  REJECTED: { label: "Rejected", ...REJECTED_PILL },
  SUSPENDED: { label: "Suspended", ...NEUTRAL_PILL },
};

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

function CardHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        borderBottom: "1px solid var(--color-shop-divider)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <p style={labelStyle}>
        {title}
        {count !== undefined && (
          <span style={{ color: "var(--color-content-tertiary)" }}>
            {" "}
            · {count}
          </span>
        )}
      </p>
      {action}
    </div>
  );
}

function InfoRows({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div style={{ padding: "0 1.25rem" }}>
      {rows.map((row, idx) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            padding: "0.875rem 0",
            borderBottom:
              idx < rows.length - 1
                ? "1px solid var(--color-shop-divider)"
                : "none",
          }}
        >
          <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
          <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
        </div>
      ))}
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const { staffRole } = await requireStaff("customer:read");
  const detail = await getAdminCustomerDetail(id);

  if (!detail) notFound();

  const canManage = can(staffRole, "customer:manage");
  const canOrders = can(staffRole, "order:read");
  const canQuotes = can(staffRole, "quote:read");
  const canTickets = can(staffRole, "ticket:read");
  const canAudit = can(staffRole, "audit:read");
  const canVerification = can(staffRole, "verification:review");
  const canB2b = can(staffRole, "b2b:read");

  const activity = await getAuditLogList({
    entityScopes: [
      { entityType: "Customer", entityIds: [detail.id] },
      ...(canVerification
        ? [
            {
              entityType: "VerificationEvent",
              entityIds: detail.verificationEventIds,
            },
          ]
        : []),
      ...(canB2b
        ? [{ entityType: "B2BAccount", entityIds: detail.b2bAccountIds }]
        : []),
    ],
    page: 1,
    pageSize: 10,
  });

  const idPill = ID_PILLS[detail.identityVerification.status];
  const b2bPill = detail.b2bAccount
    ? B2B_PILLS[detail.b2bAccount.status]
    : null;
  const emailQuery = encodeURIComponent(detail.email);
  const lastPointsActivity = detail.loyaltyRecent[0]?.createdAt ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/customers"
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
          Back to Customers
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "var(--text-heading)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                lineHeight: "var(--leading-tight)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {detail.name}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              <span
                dir="ltr"
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-body)",
                  color: "#0b0b0b",
                }}
              >
                {detail.email}
              </span>
              <CopyTextButton value={detail.email} />
            </div>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                marginTop: "0.25rem",
              }}
            >
              Customer since {formatDisplayDate(detail.createdAt, "en")} · Last
              sign-in{" "}
              {detail.lastLoginAt
                ? formatDateTime(detail.lastLoginAt, "en")
                : "never"}{" "}
              · Language: {LOCALE_LABELS[detail.locale] ?? detail.locale}
            </p>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span
              style={{
                ...pillBase,
                backgroundColor: detail.isActive ? "#dcfce7" : "#fee2e2",
                color: detail.isActive ? "#166534" : "#991b1b",
              }}
            >
              {detail.isActive ? "Active" : "Suspended"}
            </span>
            <span
              style={{
                ...pillBase,
                backgroundColor: detail.role === "B2B" ? "#dbeafe" : "#f3f4f6",
                color: detail.role === "B2B" ? "#1e40af" : "#374151",
              }}
            >
              {detail.role}
            </span>
            <span
              style={{
                ...pillBase,
                backgroundColor: idPill.backgroundColor,
                color: idPill.color,
              }}
            >
              ID {idPill.label}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))",
          gap: "1rem",
        }}
      >
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Orders</p>
          <p style={tileValueStyle}>
            {detail.ordersCount.toLocaleString("en-US")}
          </p>
          <p style={tileSubStyle}>
            {detail.awaitingPaymentCount > 0
              ? `${detail.awaitingPaymentCount} awaiting offline payment`
              : `${detail.paidOrdersCount} paid`}
          </p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Lifetime spend</p>
          <p style={tileValueStyle}>
            {formatAED(detail.lifetimeSpendAed, "en")}
          </p>
          <p style={tileSubStyle}>{detail.paidOrdersCount} paid orders</p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Points</p>
          <p style={tileValueStyle}>
            {detail.loyaltyPoints.toLocaleString("en-US")}
          </p>
          <p style={tileSubStyle}>
            {lastPointsActivity
              ? `Last activity ${formatDisplayDate(lastPointsActivity, "en")}`
              : "No activity yet"}
          </p>
        </div>
        <div style={tileStyle}>
          <p style={tileLabelStyle}>Open tickets</p>
          <p style={tileValueStyle}>
            {detail.openTicketsCount.toLocaleString("en-US")}
          </p>
          <p style={tileSubStyle}>
            {detail.quotesCount} quotes · {detail.addressesCount} addresses
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          alignItems: "flex-start",
        }}
      >
        <div style={{ ...columnStyle, flex: "2 1 560px" }}>
          <div style={cardStyle}>
            <CardHeader
              title="Orders"
              count={detail.ordersCount}
              action={
                canOrders && detail.ordersCount > 0 ? (
                  <Link
                    href={`/admin/orders?status=ALL&q=${emailQuery}`}
                    style={linkStyle}
                  >
                    View all orders
                  </Link>
                ) : undefined
              }
            />
            <div style={{ padding: "0 1.25rem" }}>
              {detail.recentOrders.length === 0 ? (
                <p style={emptyStyle}>No orders yet.</p>
              ) : (
                detail.recentOrders.map((order, idx) => (
                  <div
                    key={order.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < detail.recentOrders.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    <div>
                      {canOrders ? (
                        <Link
                          href={`/admin/orders/${order.id}`}
                          style={numberStyle}
                          dir="ltr"
                        >
                          {order.orderNumber}
                        </Link>
                      ) : (
                        <span style={plainNumberStyle} dir="ltr">
                          {order.orderNumber}
                        </span>
                      )}
                      <div style={{ marginTop: "0.25rem" }}>
                        <OrderStatusPill status={order.status} />
                      </div>
                    </div>
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <p style={valueStyle}>
                        {formatAED(order.totalAed, "en")}
                      </p>
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                        }}
                      >
                        {formatDisplayDate(order.createdAt, "en")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <CardHeader
              title="Quotes"
              count={detail.quotesCount}
              action={
                canQuotes && detail.quotesCount > 0 ? (
                  <Link
                    href={`/admin/quotes?status=ALL&q=${emailQuery}`}
                    style={linkStyle}
                  >
                    View all quotes
                  </Link>
                ) : undefined
              }
            />
            <div style={{ padding: "0 1.25rem" }}>
              {detail.recentQuotes.length === 0 ? (
                <p style={emptyStyle}>No quote requests yet.</p>
              ) : (
                detail.recentQuotes.map((quote, idx) => (
                  <div
                    key={quote.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < detail.recentQuotes.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    {canQuotes ? (
                      <Link
                        href={`/admin/quotes/${quote.id}`}
                        style={numberStyle}
                        dir="ltr"
                      >
                        {quote.quoteNumber}
                      </Link>
                    ) : (
                      <span style={plainNumberStyle} dir="ltr">
                        {quote.quoteNumber}
                      </span>
                    )}
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <QuoteStatusPill status={quote.status} />
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.25rem",
                        }}
                      >
                        {formatDisplayDate(quote.createdAt, "en")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <CardHeader
              title="Tickets"
              count={detail.ticketsCount}
              action={
                canTickets && detail.ticketsCount > 0 ? (
                  <Link
                    href={`/admin/tickets?customerId=${detail.id}&status=ALL`}
                    style={linkStyle}
                  >
                    View all tickets
                  </Link>
                ) : undefined
              }
            />
            <div style={{ padding: "0 1.25rem" }}>
              {detail.recentTickets.length === 0 ? (
                <p style={emptyStyle}>No tickets yet.</p>
              ) : (
                detail.recentTickets.map((ticket, idx) => (
                  <div
                    key={ticket.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < detail.recentTickets.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    <div>
                      {canTickets ? (
                        <Link
                          href={`/admin/tickets/${ticket.id}`}
                          style={numberStyle}
                          dir="ltr"
                        >
                          {ticket.ticketNumber}
                        </Link>
                      ) : (
                        <span style={plainNumberStyle} dir="ltr">
                          {ticket.ticketNumber}
                        </span>
                      )}
                      <p
                        style={{
                          fontSize: "var(--text-body-sm)",
                          color: "#6b6b6b",
                          marginTop: "0.125rem",
                        }}
                      >
                        {ticket.subject}
                      </p>
                    </div>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                        textAlign: "end",
                        flexShrink: 0,
                      }}
                    >
                      {TICKET_STATUS_LABELS[ticket.status]} ·{" "}
                      {TICKET_PRIORITY_LABELS[ticket.priority]} ·{" "}
                      {formatDisplayDate(ticket.createdAt, "en")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <CustomerLoyaltyCard
            customerId={detail.id}
            email={detail.email}
            balance={detail.loyaltyPoints}
            recent={detail.loyaltyRecent}
            canAdjust={can(staffRole, "loyalty:manage")}
          />

          <div style={cardStyle}>
            <CardHeader
              title="Activity"
              count={activity.total}
              action={
                canAudit ? (
                  <Link
                    href={`/admin/audit?entityType=Customer&entityId=${detail.id}`}
                    style={linkStyle}
                  >
                    Open in audit log
                  </Link>
                ) : undefined
              }
            />
            {activity.items.length === 0 ? (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No activity yet.
              </p>
            ) : (
              <EntityEventThread items={activity.items} />
            )}
          </div>
        </div>

        <div style={{ ...columnStyle, flex: "1 1 320px" }}>
          <div style={cardStyle}>
            <CardHeader title="Profile" />
            <InfoRows
              rows={[
                { label: "Phone", value: detail.phone ?? "—" },
                {
                  label: "Email verified",
                  value: detail.emailVerifiedAt
                    ? formatDisplayDate(detail.emailVerifiedAt, "en")
                    : "Not verified",
                },
                {
                  label: "UAE PASS",
                  value: detail.uaePassLinked ? "Linked" : "Not linked",
                },
                {
                  label: "Language",
                  value: LOCALE_LABELS[detail.locale] ?? detail.locale,
                },
              ]}
            />
          </div>

          <div style={cardStyle}>
            <CardHeader
              title="Identity verification"
              action={
                <span
                  style={{
                    ...pillBase,
                    backgroundColor: idPill.backgroundColor,
                    color: idPill.color,
                  }}
                >
                  {idPill.label}
                </span>
              }
            />
            <InfoRows
              rows={[
                {
                  label: "Verified",
                  value: detail.identityVerification.verifiedAt
                    ? formatDisplayDate(
                        detail.identityVerification.verifiedAt,
                        "en",
                      )
                    : "—",
                },
                {
                  label: "Valid until",
                  value: detail.identityVerification.expiresAt
                    ? formatDisplayDate(
                        detail.identityVerification.expiresAt,
                        "en",
                      )
                    : "—",
                },
                {
                  label: "Submissions",
                  value: detail.identityVerification.submissionCount,
                },
              ]}
            />
            {detail.identityVerification.latestEventId && canVerification && (
              <div
                style={{
                  padding: "0.875rem 1.25rem",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <Link
                  href={`/admin/verification/${detail.identityVerification.latestEventId}`}
                  style={linkStyle}
                >
                  Open verification
                </Link>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <CardHeader
              title="Business account"
              action={
                b2bPill ? (
                  <span
                    style={{
                      ...pillBase,
                      backgroundColor: b2bPill.backgroundColor,
                      color: b2bPill.color,
                    }}
                  >
                    {b2bPill.label}
                  </span>
                ) : undefined
              }
            />
            {detail.b2bAccount ? (
              <>
                <InfoRows
                  rows={[
                    { label: "Company", value: detail.b2bAccount.companyNameEn },
                    {
                      label: "Applied",
                      value: formatDisplayDate(detail.b2bAccount.createdAt, "en"),
                    },
                    {
                      label: "Reviewed",
                      value: detail.b2bAccount.reviewedAt
                        ? formatDisplayDate(detail.b2bAccount.reviewedAt, "en")
                        : "—",
                    },
                    ...(detail.b2bAccount.rejectionReason
                      ? [
                          {
                            label: "Rejection reason",
                            value: detail.b2bAccount.rejectionReason,
                          },
                        ]
                      : []),
                  ]}
                />
                {canB2b && (
                  <div
                    style={{
                      padding: "0.875rem 1.25rem",
                      borderTop: "1px solid var(--color-shop-divider)",
                    }}
                  >
                    <Link
                      href={`/admin/b2b/${detail.b2bAccount.id}`}
                      style={linkStyle}
                    >
                      Open business account
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No business account.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <CardHeader title="Addresses" count={detail.addressesCount} />
            <div style={{ padding: "0 1.25rem" }}>
              {detail.addresses.length === 0 ? (
                <p style={emptyStyle}>No saved addresses.</p>
              ) : (
                detail.addresses.map((addr, idx) => (
                  <div
                    key={addr.id}
                    style={{
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < detail.addresses.length - 1
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
                          {addr.fullName}
                          {addr.isDefault && (
                            <span
                              style={{
                                marginInlineStart: "0.5rem",
                                fontSize: "var(--text-label)",
                                color: "#6b6b6b",
                                textTransform: "uppercase",
                              }}
                            >
                              Default
                            </span>
                          )}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                          }}
                        >
                          {addr.addressLine1}
                          {addr.addressLine2 ? `, ${addr.addressLine2}` : ""},{" "}
                          {addr.city}, {addr.emirate}, {addr.country}
                        </p>
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                          }}
                        >
                          {addr.phone}
                        </p>
                      </div>
                      {addr.label && (
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                          }}
                        >
                          {addr.label}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {canManage && (
            <div style={cardStyle}>
              <CardHeader title="Staff" />
              <div style={{ padding: "1.25rem" }}>
                <CustomerManageActions
                  customerId={detail.id}
                  currentNote={detail.internalNotes}
                  isActive={detail.isActive}
                  canManage={canManage}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
