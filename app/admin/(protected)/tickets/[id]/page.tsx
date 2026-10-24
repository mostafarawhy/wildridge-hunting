import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getAdminTicketDetail,
  getTicketCustomerOtherTickets,
} from "@/lib/db/queries/ticket";
import { getAssignableStaff } from "@/lib/db/queries/staff";
import { can } from "@/lib/utils/staff-permissions";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CONTACT_REASON_LABELS,
  TICKET_EVENT_LABELS,
  isTerminalTicketStatus,
} from "@/lib/utils/ticket-status";
import { CONVERTED_QUOTE_LABEL } from "@/lib/utils/quote-status";
import { AdminPageHeader } from "@/components/admin";
import CopyTextButton from "@/components/admin/CopyTextButton";
import TicketManageActions from "@/components/admin/TicketManageActions";
import TicketTextEditor from "@/components/admin/TicketTextEditor";
import TicketCommentForm from "@/components/admin/TicketCommentForm";
import TicketStatusPill from "@/components/ui/TicketStatusPill";
import OrderStatusPill from "@/components/ui/OrderStatusPill";
import QuoteStatusPill from "@/components/ui/QuoteStatusPill";
import { isHttpUrl } from "@/lib/utils/tracking-url";

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

const sectionHeadStyle: React.CSSProperties = {
  padding: "0.875rem 0 0",
  borderTop: "1px solid var(--color-shop-divider)",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id } = await params;
  const { staffRole } = await requireStaff("ticket:read");
  const detail = await getAdminTicketDetail(id);

  if (!detail) notFound();

  const [assignableStaff, otherTickets] = await Promise.all([
    getAssignableStaff(),
    detail.customer
      ? getTicketCustomerOtherTickets(detail.id, detail.customer.id)
      : Promise.resolve(null),
  ]);

  const canManage = can(staffRole, "ticket:manage");
  const canViewCustomer = can(staffRole, "customer:read");
  const canViewOrder = can(staffRole, "order:read");
  const canViewQuote = can(staffRole, "quote:read");
  const canViewB2B = can(staffRole, "b2b:read");
  const canViewVerification = can(staffRole, "verification:review");
  const isTerminal = isTerminalTicketStatus(detail.status);

  const sourceLabel = detail.isStaffAuthored
    ? "Created by staff"
    : "Customer request";

  const requestRows: { label: string; value: string }[] = [
    {
      label: "Submitted by",
      value: `${detail.createdByName} · ${detail.createdByEmail}`,
    },
    ...(detail.quoteContactReason
      ? [
          {
            label: "Customer's reason",
            value: TICKET_CONTACT_REASON_LABELS[detail.quoteContactReason],
          },
        ]
      : []),
  ];

  const detailRows: { label: string; value: string }[] = [
    { label: "Category", value: TICKET_CATEGORY_LABELS[detail.category] },
    { label: "Priority", value: TICKET_PRIORITY_LABELS[detail.priority] },
    { label: "Assignee", value: detail.assignedTo?.name ?? "Unassigned" },
    { label: "Source", value: detail.isStaffAuthored ? "Staff" : "Customer" },
    { label: "Opened", value: formatDisplayDate(detail.createdAt, "en") },
    {
      label: "Resolved",
      value: detail.resolvedAt
        ? formatDisplayDate(detail.resolvedAt, "en")
        : "—",
    },
    {
      label: "Closed",
      value: detail.closedAt ? formatDisplayDate(detail.closedAt, "en") : "—",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/tickets"
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
          Back to Tickets
        </Link>

        <AdminPageHeader
          title={detail.subject}
          subtitle={`${detail.ticketNumber} · Opened ${formatDisplayDate(detail.createdAt, "en")} · ${sourceLabel}`}
          actions={
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <CopyTextButton value={detail.ticketNumber} />
              <TicketStatusPill status={detail.status} />
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
              <p style={labelStyle}>Status and ownership</p>
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
                <p style={labelStyle}>Ticket now</p>
                <TicketStatusPill status={detail.status} />
              </div>
              <TicketManageActions
                ticketId={detail.id}
                status={detail.status}
                priority={detail.priority}
                category={detail.category}
                linkKind={
                  detail.order
                    ? "order"
                    : detail.quoteRequest
                      ? "quote"
                      : detail.b2bAccount
                        ? "b2b"
                        : detail.verificationEvent
                          ? "verification"
                          : "customer"
                }
                assignedTo={detail.assignedTo}
                assignableStaff={assignableStaff}
                canManage={canManage}
                closedAt={detail.closedAt}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Linked records</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              <div style={{ padding: "0.875rem 0 0" }}>
                <p style={labelStyle}>
                  {detail.order
                    ? "Order"
                    : detail.quoteRequest
                      ? "Quote"
                      : detail.b2bAccount
                        ? "Business account"
                        : detail.verificationEvent
                          ? "Verification review"
                          : "Linked record"}
                </p>
              </div>
              {detail.order ? (
                <div style={{ padding: "0.875rem 0" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    {canViewOrder ? (
                      <Link
                        href={`/admin/orders/${detail.order.id}`}
                        style={{ ...linkStyle, fontFamily: "monospace" }}
                        dir="ltr"
                      >
                        {detail.order.orderNumber}
                      </Link>
                    ) : (
                      <span
                        style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                        dir="ltr"
                      >
                        {detail.order.orderNumber}
                      </span>
                    )}
                    <OrderStatusPill status={detail.order.status} />
                  </div>
                  {(detail.order.trackingNumber ||
                    detail.order.trackingUrl) && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        marginTop: "0.5rem",
                      }}
                    >
                      {detail.order.trackingNumber && (
                        <span
                          dir="ltr"
                          style={{
                            fontFamily: "monospace",
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                          }}
                        >
                          {detail.order.trackingNumber}
                        </span>
                      )}
                      {detail.order.trackingUrl &&
                        (isHttpUrl(detail.order.trackingUrl) ? (
                          <a
                            href={detail.order.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                            style={{
                              fontSize: "var(--text-body-sm)",
                              color: "var(--color-action-primary)",
                            }}
                          >
                            Track
                          </a>
                        ) : (
                          <span
                            dir="ltr"
                            style={{
                              fontFamily: "monospace",
                              fontSize: "var(--text-body-sm)",
                              color: "#6b6b6b",
                            }}
                          >
                            {detail.order.trackingUrl}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ) : detail.quoteRequest ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  {canViewQuote ? (
                    <Link
                      href={`/admin/quotes/${detail.quoteRequest.id}`}
                      style={{ ...linkStyle, fontFamily: "monospace" }}
                      dir="ltr"
                    >
                      {detail.quoteRequest.quoteNumber}
                    </Link>
                  ) : (
                    <span
                      style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                      dir="ltr"
                    >
                      {detail.quoteRequest.quoteNumber}
                    </span>
                  )}
                  <QuoteStatusPill
                    status={detail.quoteRequest.status}
                    label={
                      detail.quoteRequest.convertedOrderId != null
                        ? CONVERTED_QUOTE_LABEL
                        : undefined
                    }
                  />
                </div>
              ) : detail.b2bAccount ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {canViewB2B ? (
                      <Link
                        href={`/admin/b2b/${detail.b2bAccount.id}`}
                        style={linkStyle}
                      >
                        {detail.b2bAccount.companyNameEn}
                      </Link>
                    ) : (
                      <p style={valueStyle}>{detail.b2bAccount.companyNameEn}</p>
                    )}
                    <p
                      dir="ltr"
                      style={{
                        fontFamily: "monospace",
                        fontSize: "var(--text-body-sm)",
                        color: "#6b6b6b",
                        marginTop: "0.125rem",
                      }}
                    >
                      {detail.b2bAccount.tradeLicenseNo}
                    </p>
                  </div>
                  <span
                    style={{
                      ...pillStyle,
                      ...(STATUS_STYLES[detail.b2bAccount.derivedStatus] ?? {}),
                    }}
                  >
                    {detail.b2bAccount.derivedStatus}
                  </span>
                </div>
              ) : detail.verificationEvent ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  {canViewVerification ? (
                    <Link
                      href={`/admin/verification/${detail.verificationEvent.id}`}
                      style={linkStyle}
                    >
                      Review
                    </Link>
                  ) : (
                    <span style={{ ...valueStyle, color: "#6b6b6b" }}>
                      {detail.verificationEvent.customerName}
                    </span>
                  )}
                  <span
                    style={{
                      ...pillStyle,
                      ...(STATUS_STYLES[detail.verificationEvent.status] ?? {}),
                    }}
                  >
                    {detail.verificationEvent.status}
                  </span>
                </div>
              ) : (
                <p style={emptyStyle}>Not linked to a record.</p>
              )}

              <div style={sectionHeadStyle}>
                <p style={labelStyle}>Customer</p>
              </div>
              {detail.customer ? (
                <>
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
                        <span
                          style={{
                            ...pillStyle,
                            ...(STATUS_STYLES[
                              detail.customer.verificationStatus
                            ] ?? {}),
                          }}
                        >
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
                    <Link
                      href={`/admin/tickets?customerId=${detail.customer.id}&status=ALL`}
                      style={linkStyle}
                    >
                      All tickets
                    </Link>
                  </div>
                </>
              ) : detail.contactEmail ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.875rem 0",
                  }}
                >
                  <span style={valueStyle}>{detail.contactEmail}</span>
                  <CopyTextButton value={detail.contactEmail} />
                </div>
              ) : (
                <p style={emptyStyle}>No customer on this ticket.</p>
              )}

              {detail.customer && otherTickets && (
                <>
                  <div style={sectionHeadStyle}>
                    <p style={labelStyle}>
                      Other tickets from this customer · {otherTickets.total}
                    </p>
                  </div>
                  {otherTickets.items.length === 0 ? (
                    <p style={emptyStyle}>No other tickets.</p>
                  ) : (
                    otherTickets.items.map((ticket, idx, arr) => (
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
                        <Link
                          href={`/admin/tickets/${ticket.id}`}
                          style={{ ...linkStyle, fontFamily: "monospace" }}
                          dir="ltr"
                        >
                          {ticket.ticketNumber}
                        </Link>
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
                  {otherTickets.total > 5 && (
                    <p style={{ ...emptyStyle, paddingTop: 0 }}>
                      Latest 5 of {otherTickets.total}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Details</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {detailRows.map((row, idx, arr) => (
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
            <div
              style={{
                ...cardHeaderStyle,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <p style={labelStyle}>Request</p>
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                }}
              >
                {detail.isStaffAuthored
                  ? "Created by staff"
                  : "From the customer"}
              </p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {requestRows.map((row, idx, arr) => (
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

          <TicketTextEditor
            ticketId={detail.id}
            subject={detail.subject}
            description={detail.description}
            canEdit={canManage && !isTerminal && detail.isStaffAuthored}
            showCustomerNote={
              canManage && !isTerminal && !detail.isStaffAuthored
            }
            fromCustomer={!detail.isStaffAuthored}
          />

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
                Conversation{" "}
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
                Oldest first
              </p>
            </div>
            {detail.events.length === 0 ? (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No activity yet.
              </p>
            ) : (
              <div style={{ padding: "0 1.25rem" }}>
                {detail.events.map((event, idx) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                      padding: "0.875rem 0",
                      borderBottom:
                        idx < detail.events.length - 1
                          ? "1px solid var(--color-shop-divider)"
                          : "none",
                    }}
                  >
                    <div
                      style={
                        event.type === "COMMENT"
                          ? {
                              borderInlineStart:
                                "3px solid var(--color-status-warning)",
                              paddingInlineStart: "0.75rem",
                              minWidth: 0,
                            }
                          : { minWidth: 0 }
                      }
                    >
                      <p
                        style={{
                          ...valueStyle,
                          fontWeight: "var(--font-medium)",
                        }}
                      >
                        {event.type === "STATUS_CHANGE"
                          ? `${event.fromStatus ? `${TICKET_STATUS_LABELS[event.fromStatus]} → ` : ""}${event.toStatus ? TICKET_STATUS_LABELS[event.toStatus] : ""}`
                          : event.type === "ASSIGNMENT"
                            ? event.note
                              ? `${TICKET_EVENT_LABELS.ASSIGNMENT}: ${event.note}`
                              : TICKET_EVENT_LABELS.ASSIGNMENT
                            : TICKET_EVENT_LABELS.COMMENT}
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
                      {event.type === "STATUS_CHANGE" && event.note && (
                        <p
                          style={{
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                            marginTop: "0.125rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {event.note}
                        </p>
                      )}
                      {event.type === "COMMENT" && event.note && (
                        <p
                          style={{
                            ...valueStyle,
                            whiteSpace: "pre-wrap",
                            lineHeight: "var(--leading-relaxed)",
                            overflowWrap: "anywhere",
                            marginTop: "0.375rem",
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
            {canManage && (
              <div
                style={{
                  borderTop: "1px solid var(--color-shop-divider)",
                  backgroundColor: "#fafafa",
                  padding: "1.25rem",
                }}
              >
                {isTerminal ? (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "#6b6b6b",
                    }}
                  >
                    This ticket is closed. Reopen it to add a comment.
                  </p>
                ) : (
                  <TicketCommentForm ticketId={detail.id} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
