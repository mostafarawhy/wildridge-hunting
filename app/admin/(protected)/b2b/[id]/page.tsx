import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getB2BApplicationDetail,
  getB2BLinkedRecords,
  type B2BApplicationDetailProjection,
  type B2BDocumentProjection,
} from "@/lib/db/queries/b2b";
import { getAuditLogList } from "@/lib/db/queries/audit-log";
import { can } from "@/lib/utils/staff-permissions";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  auditActionLabel,
  DOCUMENT_ACCESS_ACTIONS,
} from "@/lib/utils/audit-taxonomy";
import { latestDecisionOf, reasonTextOf } from "@/lib/utils/audit-reason";
import { B2B_DOCUMENT_TYPE_LABELS } from "@/lib/utils/document-labels";
import { CONVERTED_QUOTE_LABEL } from "@/lib/utils/quote-status";
import { AdminPageHeader } from "@/components/admin";
import B2BReviewActions from "@/components/admin/B2BReviewActions";
import B2BRequestActions from "@/components/admin/B2BRequestActions";
import B2BDocumentViewer from "@/components/admin/B2BDocumentViewer";
import B2BChangedDetailsCard from "@/components/admin/B2BChangedDetailsCard";
import ReviewStatusCard from "@/components/admin/ReviewStatusCard";
import EntityEventThread from "@/components/admin/EntityEventThread";
import InternalNotesPanel from "@/components/admin/InternalNotesPanel";
import QuoteStatusPill from "@/components/ui/QuoteStatusPill";
import TicketStatusPill from "@/components/ui/TicketStatusPill";
import { addB2BNoteAction } from "@/lib/actions/staff-notes";

export const dynamic = "force-dynamic";

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

function declaredFieldsFor(
  doc: B2BDocumentProjection,
  detail: B2BApplicationDetailProjection,
): { label: string; value: string }[] {
  const isSuperseded = doc.supersededAt !== null;
  const NOT_RECORDED = "Not recorded";

  switch (doc.type) {
    case "TRADE_LICENSE":
      return [
        {
          label: "Trade License No.",
          value:
            doc.declaredNumber ??
            (isSuperseded ? NOT_RECORDED : detail.tradeLicenseNo),
        },
      ];
    case "VAT_CERTIFICATE":
      return [
        {
          label: "VAT Number",
          value:
            doc.declaredNumber ??
            (isSuperseded ? NOT_RECORDED : (detail.vatNumber ?? "—")),
        },
      ];
    case "COMPANY_ID":
      return [
        {
          label: "Contact",
          value: isSuperseded ? NOT_RECORDED : (detail.contactName ?? "—"),
        },
      ];
    case "OTHER":
      return doc.declaredNumber
        ? [{ label: "Document No.", value: doc.declaredNumber }]
        : [];
    default:
      return [];
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminB2BDetailPage({ params }: Props) {
  const { id } = await params;
  const { staffRole } = await requireStaff("b2b:read");
  const detail = await getB2BApplicationDetail(id);

  if (!detail) notFound();

  const [events, accessEvents, linked] = await Promise.all([
    getAuditLogList({
      entityType: "B2BAccount",
      entityId: id,
      pageSize: 100,
      excludeActions: DOCUMENT_ACCESS_ACTIONS,
    }),
    getAuditLogList({
      entityType: "B2BAccount",
      entityId: id,
      pageSize: 100,
      actions: DOCUMENT_ACCESS_ACTIONS,
    }),
    getB2BLinkedRecords(id),
  ]);

  const threadItems = [...events.items, ...accessEvents.items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const historyTotal = events.total + accessEvents.total;

  const decision = latestDecisionOf(events.items);

  const latestNoteItem = events.items.find(
    (item) => item.action === "b2b.note",
  );
  const latestNoteText = latestNoteItem ? reasonTextOf(latestNoteItem) : null;
  const lastFulfilled =
    [...detail.fulfilledRequests].sort((a, b) =>
      a.fulfilledAt < b.fulfilledAt ? 1 : -1,
    )[0] ?? null;
  const customerResponded =
    detail.openRequest === null &&
    lastFulfilled !== null &&
    (detail.reviewedAt === null || lastFulfilled.fulfilledAt > detail.reviewedAt);
  const standingSummary = detail.openRequest
    ? `Waiting on the customer since ${formatDisplayDate(detail.openRequest.createdAt, "en")}`
    : customerResponded
      ? "Customer responded · ready for review"
      : detail.derivedStatus === "PENDING"
        ? "Ready for a decision"
        : decision
          ? `${auditActionLabel(decision.action)} · ${decision.actorName} · ${formatDisplayDate(decision.createdAt, "en")}`
          : "No decision recorded";
  const standingRows = [
    detail.openRequest && {
      label: "Asked for",
      value: `${
        detail.openRequest.scope === "DETAILS"
          ? "Company details"
          : detail.openRequest.types.length > 0
            ? detail.openRequest.types
                .map((type) => B2B_DOCUMENT_TYPE_LABELS[type])
                .join(", ")
            : "Documents"
      } · by ${detail.openRequest.requestedByName} · ${formatDisplayDate(detail.openRequest.createdAt, "en")}`,
    },
    !detail.openRequest &&
      lastFulfilled && {
        label: "Last request",
        value: `Asked by ${lastFulfilled.requestedByName} · provided ${formatDisplayDate(lastFulfilled.fulfilledAt, "en")}`,
      },
  ].filter(Boolean) as { label: string; value: string }[];

  const documents = detail.documents.map((doc) => ({
    id: doc.id,
    type: doc.type,
    filename: doc.filename,
    mimeType: doc.mimeType,
    label: doc.label,
    supersededAt: doc.supersededAt,
    uploadedAt: doc.uploadedAt,
    requestId: doc.requestId,
    declaredFields: declaredFieldsFor(doc, detail),
  }));

  const reviewRows = [
    decision && {
      label: "Last Decision",
      value: auditActionLabel(decision.action),
    },
    decision && {
      label: "Decision By",
      value: decision.actorName,
    },
    decision && {
      label: "Decision At",
      value: formatDateTime(decision.createdAt, "en"),
    },
    decision?.reason && {
      label: "Reason",
      value: decision.reason,
      preLine: true,
    },
    detail.reviewedBy && {
      label: "Reviewed By",
      value: detail.reviewedBy.name,
    },
    detail.reviewedAt && {
      label: "Reviewed At",
      value: formatDisplayDate(detail.reviewedAt, "en"),
    },
    detail.verifiedAt && {
      label: "Verified On",
      value: formatDisplayDate(detail.verifiedAt, "en"),
    },
    detail.verifiedAt && {
      label: "Valid Until",
      value: detail.expiresAt
        ? formatDisplayDate(detail.expiresAt, "en")
        : "No expiry",
    },
  ].filter(Boolean) as { label: string; value: string; preLine?: boolean }[];

  const companyRows: { label: string; value: React.ReactNode }[] = [
    { label: "Company (EN)", value: detail.companyNameEn },
    { label: "Company (AR)", value: detail.companyNameAr ?? "—" },
    {
      label: "Trade licence",
      value: (
        <span dir="ltr" style={{ fontFamily: "monospace" }}>
          {detail.tradeLicenseNo}
        </span>
      ),
    },
    {
      label: "VAT Number",
      value: detail.vatNumber ? (
        <span dir="ltr" style={{ fontFamily: "monospace" }}>
          {detail.vatNumber}
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Contact Name", value: detail.contactName ?? "—" },
    { label: "Contact Phone", value: detail.contactPhone ?? "—" },
    {
      label: "Credit Limit",
      value:
        detail.creditLimitAed != null
          ? formatAED(detail.creditLimitAed, "en")
          : "—",
    },
  ];

  const statusStyle = STATUS_STYLES[detail.derivedStatus] ?? {};
  const idStatusStyle =
    STATUS_STYLES[detail.customer.verificationStatus] ?? {};

  const canViewCustomer = can(staffRole, "customer:read");
  const canViewTickets = can(staffRole, "ticket:read");
  const canViewQuotes = can(staffRole, "quote:read");
  const canViewVerification =
    can(staffRole, "verification:review") &&
    detail.customer.latestVerificationEventId !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/b2b"
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
          Back to business accounts
        </Link>

        <AdminPageHeader
          title={detail.companyNameEn}
          subtitle={`Business account · Licence ${detail.tradeLicenseNo} · Applied ${formatDisplayDate(detail.createdAt, "en")}`}
          actions={
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <span style={{ ...pillStyle, ...statusStyle }}>
                {detail.derivedStatus}
              </span>
              {canViewCustomer && (
                <Link
                  href={`/admin/customers/${detail.customer.id}`}
                  style={linkStyle}
                >
                  View customer
                </Link>
              )}
              {can(staffRole, "ticket:manage") && (
                <Link
                  href={`/admin/tickets?b2bAccountId=${detail.id}`}
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
                  Open Ticket
                </Link>
              )}
            </div>
          }
        />
      </div>

      <ReviewStatusCard
        status={detail.derivedStatus}
        statusStyle={statusStyle}
        summary={standingSummary}
        rows={standingRows}
        latestNote={
          latestNoteItem && latestNoteText
            ? {
                actorName: latestNoteItem.actorName,
                createdAt: latestNoteItem.createdAt,
                text: latestNoteText,
              }
            : null
        }
      />

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
              <p style={labelStyle}>Decision</p>
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
                <p style={labelStyle}>Account now</p>
                <span style={{ ...pillStyle, ...statusStyle }}>
                  {detail.derivedStatus}
                </span>
              </div>
              {detail.expiresAt && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <p style={labelStyle}>Valid until</p>
                  <p style={valueStyle}>
                    {formatDisplayDate(detail.expiresAt, "en")}
                  </p>
                </div>
              )}
              <B2BReviewActions
                accountId={detail.id}
                derivedStatus={detail.derivedStatus}
                canApprove={can(staffRole, "b2b:approve")}
                canOverride={can(staffRole, "compliance:override")}
                companyNameEn={detail.companyNameEn}
                tradeLicenseNo={detail.tradeLicenseNo}
                contactName={detail.contactName}
                hasOpenRequest={detail.openRequest !== null}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Document Request</p>
            </div>
            <div style={{ padding: "1.25rem" }}>
              <B2BRequestActions
                accountId={detail.id}
                derivedStatus={detail.derivedStatus}
                canRequest={can(staffRole, "b2b:read")}
                openRequest={detail.openRequest}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Linked records</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {[
                { label: "Name", value: detail.customer.name },
                { label: "Email", value: detail.customer.email },
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
                <p style={labelStyle}>Quotes · {linked.quotes.total}</p>
              </div>
              {linked.quotes.items.length === 0 ? (
                <p style={emptyStyle}>No quotes under this account.</p>
              ) : (
                linked.quotes.items.map((quote, idx, arr) => (
                  <div
                    key={quote.id}
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
                    {canViewQuotes ? (
                      <Link
                        href={`/admin/quotes/${quote.id}`}
                        style={{ ...linkStyle, fontFamily: "monospace" }}
                        dir="ltr"
                      >
                        {quote.quoteNumber}
                      </Link>
                    ) : (
                      <span
                        style={{ fontFamily: "monospace", color: "#0b0b0b" }}
                        dir="ltr"
                      >
                        {quote.quoteNumber}
                      </span>
                    )}
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <QuoteStatusPill
                        status={quote.status}
                        label={
                          quote.convertedOrderId != null
                            ? CONVERTED_QUOTE_LABEL
                            : undefined
                        }
                      />
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
              {linked.quotes.total > 5 && (
                <p style={{ ...emptyStyle, paddingTop: 0 }}>
                  Latest 5 of {linked.quotes.total}
                </p>
              )}

              <div
                style={{
                  padding: "0.875rem 0 0",
                  borderTop: "1px solid var(--color-shop-divider)",
                }}
              >
                <p style={labelStyle}>Tickets · {linked.tickets.total}</p>
              </div>
              {linked.tickets.items.length === 0 ? (
                <p style={emptyStyle}>No tickets on this account.</p>
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
                <p style={{ ...emptyStyle, paddingTop: 0 }}>
                  Latest 5 of {linked.tickets.total}
                </p>
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
              <p style={labelStyle}>Company details</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {companyRows.map((row, idx, arr) => (
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

          <B2BChangedDetailsCard items={events.items} />

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>
                Documents{" "}
                <span style={{ color: "var(--color-content-tertiary)" }}>
                  · {documents.length}
                </span>
              </p>
            </div>
            {documents.length > 0 ? (
              <B2BDocumentViewer
                documents={documents}
                reviewedAt={detail.reviewedAt}
                subjectName={detail.companyNameEn}
                fulfilledRequests={detail.fulfilledRequests}
                accountId={detail.id}
              />
            ) : (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                No documents on file.
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>Review record</p>
            </div>
            {reviewRows.length > 0 ? (
              <div style={{ padding: "0 1.25rem" }}>
                {reviewRows.map((row, idx, arr) => (
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
                    <p
                      style={{
                        ...valueStyle,
                        textAlign: "end",
                        ...(row.preLine
                          ? { whiteSpace: "pre-line" as const }
                          : {}),
                      }}
                    >
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ ...emptyStyle, padding: "0.875rem 1.25rem" }}>
                Not reviewed yet.
              </p>
            )}
          </div>

          <InternalNotesPanel action={addB2BNoteAction} entityId={detail.id} />

          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <p style={labelStyle}>
                History{" "}
                <span style={{ color: "var(--color-content-tertiary)" }}>
                  · {historyTotal}
                </span>
              </p>
              {threadItems.length < historyTotal && (
                <p
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  Showing the latest {threadItems.length} of {historyTotal}.
                </p>
              )}
            </div>
            <EntityEventThread items={threadItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
