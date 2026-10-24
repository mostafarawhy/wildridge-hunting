import { formatDisplayDate, formatDateTime } from "@/lib/utils/date";
import {
  B2B_DOCUMENT_TYPE_LABELS,
  VERIFICATION_ROLE_LABELS,
} from "@/lib/utils/document-labels";
import ComplianceDocumentTile, {
  ArchiveNowButton,
} from "@/components/admin/ComplianceDocumentTile";
import { CorrectSerialsButton } from "@/components/admin/SerialCaptureModal";
import { NO_SERIAL_REASON } from "@/lib/utils/order-serials";
import type { SerialLineInput } from "@/lib/utils/order-serials";
import type {
  AdminOrderComplianceDocumentProjection,
  OrderStatus,
} from "@/lib/db/queries/order";
import type { ComplianceSnapshot } from "@/types/order";

export interface ComplianceCardSerialRow {
  itemName: string;
  sku: string | null;
  kind: "SERIAL" | "LOT";
  unitIndex: number;
  value: string | null;
  overrideReason: string | null;
  recordedByName: string | null;
  updatedAt: string | null;
}

interface Props {
  orderId: string;
  status: OrderStatus;
  regulated: boolean;
  snapshot: ComplianceSnapshot | null;
  documents: AdminOrderComplianceDocumentProjection[];
  serials: ComplianceCardSerialRow[];
  serialProgress: { required: number; recorded: number };
  shipment: {
    carrier: string | null;
    parcelCount: number | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    estimatedDelivery: string | null;
    note: string | null;
  };
  delivery: {
    deliveredAt: string | null;
    receivedBy: string | null;
    idChecked: boolean | null;
    confirmedBy: string;
    hasProof: boolean;
    note: string | null;
  };
  canArchive: boolean;
  canViewVerificationDocs: boolean;
  canViewB2BDocs: boolean;
  canOverrideSerials: boolean;
  serialItems: SerialLineInput[];
}

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

const sectionTitle: React.CSSProperties = {
  ...labelStyle,
  color: "#0b0b0b",
  margin: 0,
  padding: "1rem 0 0.25rem",
};

const PROVIDER_LABELS: Record<string, string> = {
  SUMSUB: "Automated check",
  UAE_PASS: "UAE PASS",
  MANUAL_REVIEW: "Manual review",
};

const STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: "Not required",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
};

const PILL: Record<
  "complete" | "incomplete" | "none",
  { text: string; backgroundColor: string; color: string; border: string }
> = {
  complete: {
    text: "Complete",
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },
  incomplete: {
    text: "Incomplete",
    backgroundColor: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
  },
  none: {
    text: "Not regulated",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
  },
};

function Row({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: last ? "none" : "1px solid var(--color-shop-divider)",
      }}
    >
      <p style={{ ...labelStyle, flexShrink: 0, margin: 0 }}>{label}</p>
      <div style={{ ...valueStyle, textAlign: "end" }}>{children}</div>
    </div>
  );
}

function RowGroup({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div>
      {rows.map((row, idx) => (
        <Row key={row.label} label={row.label} last={idx === rows.length - 1}>
          {row.value}
        </Row>
      ))}
    </div>
  );
}

function day(iso: string | null): string {
  return iso ? formatDisplayDate(iso, "en") : "—";
}

export default function OrderComplianceCard({
  orderId,
  status,
  regulated,
  snapshot,
  documents,
  serials,
  serialProgress,
  shipment,
  delivery,
  canArchive,
  canViewVerificationDocs,
  canViewB2BDocs,
  canOverrideSerials,
  serialItems,
}: Props) {
  const verification = snapshot?.verification ?? null;
  const b2b = snapshot?.b2b ?? null;
  const unarchived = documents.filter((d) => d.archivedAt === null);
  const snapshotDocumentCount =
    (verification?.documents.length ?? 0) + (b2b?.documents.length ?? 0);

  const gaps: string[] = [];
  if (regulated) {
    if (snapshot === null) {
      gaps.push("No compliance snapshot was recorded for this order.");
    } else if (verification === null || verification.status !== "APPROVED") {
      gaps.push("Identity was not approved at purchase.");
    }
    if (unarchived.length > 0) {
      gaps.push(
        `${unarchived.length} ${unarchived.length === 1 ? "document is" : "documents are"} not copied to this order yet.`,
      );
    }
    if (serialProgress.required > serialProgress.recorded) {
      gaps.push(
        `Serials: ${serialProgress.recorded} of ${serialProgress.required} units recorded.`,
      );
    }
    if (status === "DELIVERED") {
      if (delivery.receivedBy === null) {
        gaps.push("Handover details are not recorded.");
      } else if (delivery.idChecked !== true) {
        gaps.push("The recipient's ID check is not recorded.");
      }
    }
  }

  const pill = !regulated
    ? PILL.none
    : gaps.length === 0
      ? PILL.complete
      : PILL.incomplete;

  const verificationRows: { label: string; value: React.ReactNode }[] =
    verification
      ? [
          {
            label: "Provider",
            value:
              PROVIDER_LABELS[verification.provider] ?? verification.provider,
          },
          {
            label: "Status at purchase",
            value: STATUS_LABELS[verification.status] ?? verification.status,
          },
          { label: "Verified", value: day(verification.verifiedAt) },
          { label: "Expires", value: day(verification.expiresAt) },
          {
            label: "Snapshot taken",
            value: snapshot ? formatDateTime(snapshot.snapshotAt, "en") : "—",
          },
        ]
      : [];

  const shipmentRows: { label: string; value: React.ReactNode }[] = [
    ...(shipment.carrier ? [{ label: "Carrier", value: shipment.carrier }] : []),
    ...(shipment.parcelCount !== null
      ? [{ label: "Parcels", value: String(shipment.parcelCount) }]
      : []),
    ...(shipment.trackingNumber
      ? [
          {
            label: "Tracking number",
            value: (
              <span dir="ltr" style={{ fontFamily: "monospace" }}>
                {shipment.trackingNumber}
              </span>
            ),
          },
        ]
      : []),
    ...(shipment.shippedAt
      ? [{ label: "Shipped on", value: day(shipment.shippedAt) }]
      : []),
    ...(shipment.estimatedDelivery
      ? [{ label: "Estimated delivery", value: day(shipment.estimatedDelivery) }]
      : []),
    ...(shipment.note ? [{ label: "Note to customer", value: shipment.note }] : []),
  ];

  const deliveryRows: { label: string; value: React.ReactNode }[] = [
    ...(delivery.deliveredAt
      ? [{ label: "Delivered on", value: day(delivery.deliveredAt) }]
      : []),
    ...(delivery.receivedBy !== null
      ? [
          { label: "Received by", value: delivery.receivedBy },
          {
            label: "ID checked",
            value:
              delivery.idChecked === null
                ? "—"
                : delivery.idChecked
                  ? "Yes"
                  : "No",
          },
        ]
      : []),
    ...(delivery.deliveredAt
      ? [{ label: "Confirmed by", value: delivery.confirmedBy }]
      : []),
    ...(delivery.hasProof
      ? [{ label: "Proof", value: "On file — see the Delivery card" }]
      : []),
    ...(delivery.note ? [{ label: "Note", value: delivery.note }] : []),
  ];

  return (
    <div style={cardStyle}>
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
        <p style={{ ...labelStyle, margin: 0 }}>Compliance record</p>
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
            backgroundColor: pill.backgroundColor,
            color: pill.color,
            border: pill.border,
          }}
        >
          {pill.text}
        </span>
      </div>

      <div style={{ padding: "0 1.25rem 1rem" }}>
        {regulated && gaps.length > 0 && (
          <div
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              padding: "0.75rem 1rem",
              marginTop: "1rem",
            }}
          >
            {gaps.map((gap) => (
              <p
                key={gap}
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#92400e",
                  margin: 0,
                }}
              >
                {gap}
              </p>
            ))}
          </div>
        )}

        {snapshot === null ? (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              padding: "0.875rem 0 0",
              margin: 0,
            }}
          >
            Placed before compliance records were kept.
          </p>
        ) : (
          <>
            <p style={sectionTitle}>Identity at purchase</p>
            {verification ? (
              <RowGroup rows={verificationRows} />
            ) : (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  margin: "0.5rem 0 0",
                }}
              >
                No identity verification was on file at purchase.
              </p>
            )}

            {b2b && (
              <>
                <p style={sectionTitle}>Business account at purchase</p>
                <RowGroup
                  rows={[
                    {
                      label: "Status",
                      value: STATUS_LABELS[b2b.status] ?? b2b.status,
                    },
                    {
                      label: "Trade licence no.",
                      value: (
                        <span dir="ltr" style={{ fontFamily: "monospace" }}>
                          {b2b.tradeLicenseNo}
                        </span>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <p style={sectionTitle}>Documents</p>
          {canArchive && unarchived.length > 0 && (
            <ArchiveNowButton orderId={orderId} />
          )}
        </div>
        {documents.length === 0 && snapshotDocumentCount > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              margin: "0.5rem 0 0",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                margin: 0,
              }}
            >
              This order&apos;s documents were captured before copies were kept.
            </p>
            {canArchive && (
              <ArchiveNowButton
                orderId={orderId}
                label="Copy documents to this order"
              />
            )}
          </div>
        ) : documents.length === 0 ? (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              margin: "0.5rem 0 0",
            }}
          >
            No documents were on file at purchase.
          </p>
        ) : (
          <div>
            {documents.map((doc, idx) => {
              const canAccess =
                doc.source === "VERIFICATION"
                  ? canViewVerificationDocs
                  : canViewB2BDocs;
              const label =
                doc.source === "VERIFICATION"
                  ? (VERIFICATION_ROLE_LABELS[doc.documentKind] ??
                    doc.documentKind)
                  : (B2B_DOCUMENT_TYPE_LABELS[doc.documentKind] ??
                    doc.documentKind);
              return (
                <div
                  key={doc.id}
                  style={{
                    borderBottom:
                      idx < documents.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <ComplianceDocumentTile
                    orderId={orderId}
                    documentId={doc.id}
                    label={label}
                    filename={doc.filename}
                    mimeType={doc.mimeType}
                    declaredNumber={doc.declaredNumber}
                    copiedOn={doc.archivedAt ? day(doc.archivedAt) : null}
                    canAccess={canAccess}
                    hiddenReason={
                      doc.source === "VERIFICATION"
                        ? "Hidden — needs verification review access"
                        : "Hidden — needs business account access"
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        {serialProgress.required > 0 && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <p style={sectionTitle}>
                Serials · {serialProgress.recorded} of {serialProgress.required}{" "}
                recorded
              </p>
              {(status === "SHIPPED" || status === "DELIVERED") &&
                canOverrideSerials && (
                  <CorrectSerialsButton
                    orderId={orderId}
                    status={status}
                    items={serialItems}
                    canOverride={canOverrideSerials}
                  />
                )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                <thead>
                  <tr>
                    {["Item", "Unit", "Value", "Recorded by", "Date"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            ...labelStyle,
                            textAlign: "start",
                            padding: "0.5rem 0.5rem 0.5rem 0",
                            borderBottom: "1px solid var(--color-shop-divider)",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {serials.map((s) => (
                    <tr key={`${s.sku}-${s.itemName}-${s.unitIndex}`}>
                      <td style={cellStyle}>{s.itemName}</td>
                      <td style={cellStyle}>
                        {s.kind === "LOT" ? "Lot" : "Serial"} {s.unitIndex}
                      </td>
                      <td style={cellStyle}>
                        {s.overrideReason === NO_SERIAL_REASON ? (
                          "No serial"
                        ) : s.overrideReason ? (
                          `Override: ${s.overrideReason}`
                        ) : s.value ? (
                          <span dir="ltr" style={{ fontFamily: "monospace" }}>
                            {s.value}
                          </span>
                        ) : (
                          <span style={{ color: "#92400e" }}>Not recorded</span>
                        )}
                      </td>
                      <td style={cellStyle}>{s.recordedByName ?? "—"}</td>
                      <td style={cellStyle}>
                        {s.updatedAt ? formatDateTime(s.updatedAt, "en") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {shipmentRows.length > 0 && (
          <>
            <p style={sectionTitle}>Shipment</p>
            <RowGroup rows={shipmentRows} />
          </>
        )}

        {deliveryRows.length > 0 && (
          <>
            <p style={sectionTitle}>Delivery</p>
            <RowGroup rows={deliveryRows} />
          </>
        )}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "0.5rem 0.5rem 0.5rem 0",
  color: "#0b0b0b",
  borderBottom: "1px solid var(--color-shop-divider)",
  verticalAlign: "top",
  textAlign: "start",
};
