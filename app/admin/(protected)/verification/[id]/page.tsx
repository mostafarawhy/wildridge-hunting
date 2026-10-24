import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth-staff";
import {
  getVerificationEventDetail,
  getCustomerVerificationEvents,
  type VerificationEventDetail,
} from "@/lib/db/queries/verification";
import { getAuditLogList } from "@/lib/db/queries/audit-log";
import { deriveB2BStatus } from "@/lib/db/queries/b2b";
import { can } from "@/lib/utils/staff-permissions";
import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  auditActionLabel,
  DOCUMENT_ACCESS_ACTIONS,
} from "@/lib/utils/audit-taxonomy";
import { latestDecisionOf, reasonTextOf } from "@/lib/utils/audit-reason";
import { AdminPageHeader } from "@/components/admin";
import VerificationSubmissionStack from "@/components/admin/VerificationSubmissionStack";
import VerificationReviewActions from "@/components/admin/VerificationReviewActions";
import VerificationRequestActions from "@/components/admin/VerificationRequestActions";
import VerificationChangedDetailsCard from "@/components/admin/VerificationChangedDetailsCard";
import ReviewStatusCard from "@/components/admin/ReviewStatusCard";
import EntityEventThread from "@/components/admin/EntityEventThread";
import InternalNotesPanel from "@/components/admin/InternalNotesPanel";
import { addVerificationNoteAction } from "@/lib/actions/staff-notes";
import { VERIFICATION_ROLE_LABELS } from "@/lib/utils/document-labels";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<
  string,
  { backgroundColor: string; color: string }
> = {
  PENDING: { backgroundColor: "#fef9c3", color: "#854d0e" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#166534" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#991b1b" },
  EXPIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
  NOT_REQUIRED: { backgroundColor: "#f3f4f6", color: "#374151" },
  SUSPENDED: { backgroundColor: "#f3f4f6", color: "#374151" },
};

const PROVIDER_LABELS: Record<string, string> = {
  SUMSUB: "Automated check",
  UAE_PASS: "UAE PASS",
  MANUAL_REVIEW: "Manual Review",
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

function declaredFieldsFor(
  role: string,
  source: Pick<VerificationEventDetail, "declaredIdNumber" | "declaredAddress">,
): { label: string; value: string }[] {
  switch (role) {
    case "IDENTITY":
      return [
        { label: "ID / Passport No.", value: source.declaredIdNumber ?? "—" },
      ];
    case "PROOF_OF_ADDRESS":
      return [
        { label: "Declared Address", value: source.declaredAddress ?? "—" },
      ];
    case "PHOTO":
      return [];
    default:
      return [];
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminVerificationDetailPage({ params }: Props) {
  const { id } = await params;
  const { staffRole } = await requireStaff("verification:review");
  const detail = await getVerificationEventDetail(id);

  if (!detail) notFound();

  const [events, accessEvents, submissionEvents] = await Promise.all([
    getAuditLogList({
      entityType: "VerificationEvent",
      entityId: id,
      pageSize: 100,
      excludeActions: DOCUMENT_ACCESS_ACTIONS,
    }),
    getAuditLogList({
      entityType: "VerificationEvent",
      entityId: id,
      pageSize: 100,
      actions: DOCUMENT_ACCESS_ACTIONS,
    }),
    getCustomerVerificationEvents(detail.customer.id),
  ]);

  const threadItems = [...events.items, ...accessEvents.items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const historyTotal = events.total + accessEvents.total;

  const submissions = submissionEvents.map((event) => ({
    id: event.id,
    provider: event.provider,
    status: event.status,
    createdAt: event.createdAt,
    reviewedAt: event.reviewedAt,
    reviewedByName: event.reviewedByName,
    fulfilledRequests: event.fulfilledRequests,
    documents: event.documents.map((d) => ({
      id: d.id,
      role: d.role,
      type: d.type,
      filename: d.filename,
      mimeType: d.mimeType,
      declaredFields: declaredFieldsFor(d.role, event),
      supersededAt: d.supersededAt,
      uploadedAt: d.createdAt,
      requestId: d.requestId,
    })),
  }));

  const displayStatus =
    detail.status === "APPROVED" &&
    detail.customer.latestApprovedEventId === detail.id &&
    detail.customer.currentStatus === "EXPIRED"
      ? "EXPIRED"
      : detail.status;
  const statusStyle = STATUS_STYLES[displayStatus] ?? {};

  const decision = latestDecisionOf(events.items);

  const latestNoteItem = events.items.find(
    (item) => item.action === "verification.note",
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
      : detail.status === "PENDING"
        ? "Ready for a decision"
        : decision
          ? `${auditActionLabel(decision.action)} · ${decision.actorName} · ${formatDisplayDate(decision.createdAt, "en")}`
          : "No decision recorded";
  const standingRows = [
    detail.openRequest && {
      label: "Asked for",
      value: `${
        detail.openRequest.scope === "DETAILS"
          ? "Declared details"
          : detail.openRequest.roles
              .map((role) => VERIFICATION_ROLE_LABELS[role] ?? role)
              .join(", ")
      } · by ${detail.openRequest.requestedByName} · ${formatDisplayDate(detail.openRequest.createdAt, "en")}`,
    },
    !detail.openRequest &&
      lastFulfilled && {
        label: "Last request",
        value: `Asked by ${lastFulfilled.requestedByName} · provided ${formatDisplayDate(lastFulfilled.fulfilledAt, "en")}`,
      },
    displayStatus !== detail.status && {
      label: "Review result",
      value: `Approved${
        detail.reviewedAt
          ? ` on ${formatDisplayDate(detail.reviewedAt, "en")}`
          : ""
      }${detail.reviewedBy ? ` by ${detail.reviewedBy.name}` : ""}`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

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
    detail.rejectionReason && {
      label: "Rejection Reason (sent to the customer)",
      value: detail.rejectionReason,
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
    detail.reviewResult && {
      label: "Result",
      value: detail.reviewResult,
    },
  ].filter(Boolean) as { label: string; value: string; preLine?: boolean }[];

  const credential =
    detail.customer.currentStatus === "APPROVED"
      ? detail.customer.verifiedAt
        ? `Verified ${formatDisplayDate(detail.customer.verifiedAt, "en")} · valid until ${detail.customer.expiresAt ? formatDisplayDate(detail.customer.expiresAt, "en") : "no expiry"}`
        : "Active"
      : detail.customer.currentStatus === "EXPIRED"
        ? "Expired"
        : "None active";

  const canViewCustomer = can(staffRole, "customer:read");
  const canViewTickets = can(staffRole, "ticket:read");
  const canViewB2b = can(staffRole, "b2b:read");

  const linkStyle: React.CSSProperties = {
    fontSize: "var(--text-body-sm)",
    color: "var(--color-action-primary)",
    textDecoration: "none",
  };

  const pillBase: React.CSSProperties = {
    display: "inline-block",
    paddingInline: "0.625rem",
    paddingBlock: "0.25rem",
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-semibold)",
    letterSpacing: "var(--tracking-wide)",
    textTransform: "uppercase",
    borderRadius: "0",
  };

  const businessStatus = detail.customer.b2bAccount
    ? deriveB2BStatus(
        detail.customer.b2bAccount.status,
        detail.customer.b2bAccount.expiresAt
          ? new Date(detail.customer.b2bAccount.expiresAt)
          : null,
      )
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <Link
          href="/admin/verification"
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
          Back to Queue
        </Link>

        <AdminPageHeader
          title={detail.customer.name}
          subtitle={`Identity verification · ${PROVIDER_LABELS[detail.provider] ?? detail.provider} · Submitted ${formatDisplayDate(detail.createdAt, "en")}`}
          actions={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  paddingInline: "0.625rem",
                  paddingBlock: "0.25rem",
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-semibold)",
                  letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                  borderRadius: "0",
                  ...statusStyle,
                }}
              >
                {displayStatus}
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
                  href={`/admin/tickets?verificationEventId=${detail.id}`}
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
        status={displayStatus}
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
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
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
            <span
              style={{
                display: "inline-block",
                paddingInline: "0.625rem",
                paddingBlock: "0.25rem",
                fontSize: "var(--text-label)",
                fontWeight: "var(--font-semibold)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
                borderRadius: "0",
                ...(STATUS_STYLES[detail.customer.currentStatus] ?? {}),
              }}
            >
              {detail.customer.currentStatus}
            </span>
          </div>
          <VerificationReviewActions
            eventId={detail.id}
            eventStatus={detail.status}
            accountStatus={detail.customer.currentStatus}
            canApprove={can(staffRole, "verification:approve")}
            canOverride={can(staffRole, "compliance:override")}
            declaredIdNumber={detail.declaredIdNumber}
            declaredAddress={detail.declaredAddress}
            customerName={detail.customer.name}
            hasOpenRequest={detail.openRequest !== null}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={labelStyle}>Document Request</p>
        </div>
        <div style={{ padding: "1.25rem" }}>
          <VerificationRequestActions
            eventId={detail.id}
            eventStatus={detail.status}
            canRequest={can(staffRole, "verification:review")}
            allowDetails={
              detail.provider === "MANUAL_REVIEW" &&
              detail.declaredIdNumber !== null &&
              detail.declaredAddress !== null
            }
            openRequest={detail.openRequest}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={labelStyle}>Customer</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {[
            { label: "Name", value: detail.customer.name },
            { label: "Email", value: detail.customer.email },
            { label: "Role", value: detail.customer.role },
            {
              label: "Account Status",
              value: (
                <span
                  style={{
                    ...pillBase,
                    ...(STATUS_STYLES[detail.customer.currentStatus] ?? {}),
                  }}
                >
                  {detail.customer.currentStatus}
                </span>
              ),
            },
            { label: "Current credential", value: credential },
            {
              label: "Business account",
              value: businessStatus ? (
                <span
                  style={{
                    ...pillBase,
                    ...(STATUS_STYLES[businessStatus] ?? {}),
                  }}
                >
                  {businessStatus}
                </span>
              ) : (
                "None"
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
              <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
            </div>
          ))}
          {(canViewCustomer || canViewTickets || canViewB2b) && (
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
              {canViewTickets && (
                <Link
                  href={`/admin/tickets?customerId=${detail.customer.id}&status=ALL`}
                  style={linkStyle}
                >
                  All tickets
                </Link>
              )}
              {canViewB2b && detail.customer.b2bAccount && (
                <Link
                  href={`/admin/b2b/${detail.customer.b2bAccount.id}`}
                  style={linkStyle}
                >
                  Business account
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
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={labelStyle}>
            Documents{" "}
            <span style={{ color: "var(--color-content-tertiary)" }}>
              · {submissions.length}
            </span>
          </p>
        </div>
        <VerificationSubmissionStack
          submissions={submissions}
          viewedEventId={detail.id}
          subjectName={detail.customer.name}
        />
      </div>

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={labelStyle}>Declared Identity</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {[
            {
              label: "ID / Passport Number",
              value: detail.declaredIdNumber ?? "—",
              mono: true,
            },
            {
              label: "Declared Address",
              value: detail.declaredAddress ?? "—",
              mono: false,
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
              {row.mono ? (
                <p
                  dir="ltr"
                  style={{
                    ...valueStyle,
                    textAlign: "end",
                    fontFamily: "monospace",
                  }}
                >
                  {row.value}
                </p>
              ) : (
                <p style={{ ...valueStyle, textAlign: "end" }}>{row.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <VerificationChangedDetailsCard items={events.items} />

      {(detail.reviewedAt ||
        detail.reviewedBy ||
        decision ||
        detail.rejectionReason) && (
        <div style={cardStyle}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--color-shop-divider)",
            }}
          >
            <p style={labelStyle}>Review</p>
          </div>
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
                    ...(row.preLine ? { whiteSpace: "pre-line" as const } : {}),
                  }}
                >
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p style={labelStyle}>Submission</p>
        </div>
        <div style={{ padding: "0 1.25rem" }}>
          {[
            {
              label: "Provider",
              value: PROVIDER_LABELS[detail.provider] ?? detail.provider,
            },
            detail.notes != null && { label: "Notes", value: detail.notes },
          ]
            .filter(Boolean)
            .map((row, idx, arr) => (
              <div
                key={(row as { label: string }).label}
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
                <p style={{ ...labelStyle, flexShrink: 0 }}>
                  {(row as { label: string }).label}
                </p>
                <p style={{ ...valueStyle, textAlign: "end" }}>
                  {(row as { value: string }).value}
                </p>
              </div>
            ))}
        </div>
      </div>

      <InternalNotesPanel action={addVerificationNoteAction} entityId={detail.id} />

      <div style={cardStyle}>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
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
