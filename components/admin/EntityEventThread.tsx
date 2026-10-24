import { auditActionLabel, eventVisual } from "@/lib/utils/audit-taxonomy";
import { formatDateTime } from "@/lib/utils/date";
import { reasonTextOf } from "@/lib/utils/audit-reason";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import { DiffBody } from "@/components/admin/AuditDiffModal";
import type { AuditLogListItem } from "@/lib/db/queries/audit-log";
import type { StaffRole } from "@/app/generated/prisma/client";
import {
  B2B_DOCUMENT_TYPE_LABELS,
  VERIFICATION_ROLE_LABELS,
} from "@/lib/utils/document-labels";

interface Props {
  items: AuditLogListItem[];
}

const detailLineStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function documentLabelOf(action: string, value: string): string {
  const labels = action.startsWith("b2b.")
    ? B2B_DOCUMENT_TYPE_LABELS
    : VERIFICATION_ROLE_LABELS;
  return labels[value] ?? humanize(value);
}

function detailLineOf(item: AuditLogListItem): string | null {
  if (item.action === "verification.documents_requested") {
    const after = asRecord(item.after);
    const roles = after?.roles;
    if (!Array.isArray(roles)) return null;
    const labels = roles
      .filter((r): r is string => typeof r === "string")
      .map((r) => documentLabelOf(item.action, r));
    if (labels.length === 0) return null;
    return `Requested: ${labels.join(", ")}`;
  }

  if (item.action === "b2b.documents_requested") {
    const after = asRecord(item.after);
    const types = after?.types;
    if (!Array.isArray(types)) return null;
    const labels = types
      .filter((t): t is string => typeof t === "string")
      .map((t) => documentLabelOf(item.action, t));
    if (labels.length === 0) return null;
    return `Requested: ${labels.join(", ")}`;
  }

  if (item.action.endsWith(".document_accessed")) {
    const metadata = asRecord(item.metadata);
    if (!metadata) return null;
    const filename = metadata.filename;
    const roleOrType = metadata.role ?? metadata.type;
    if (typeof filename !== "string" || typeof roleOrType !== "string") {
      return null;
    }
    const verb =
      metadata.variant === "download"
        ? "Downloaded"
        : metadata.variant === "view"
          ? "Opened"
          : null;
    if (verb === null) return null;
    return `${verb} · ${documentLabelOf(item.action, roleOrType)} · ${filename}`;
  }

  return null;
}

export default function EntityEventThread({ items }: Props) {
  if (items.length === 0) {
    return (
      <div style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          No recorded events yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 1.25rem" }}>
      {items.map((item, idx) => {
        const reason = reasonTextOf(item);
        const visual = eventVisual(item.action);
        const isNote = visual.wash !== null;
        const detailLine = detailLineOf(item);
        return (
        <div
          key={item.id}
          style={
            visual.wash !== null
              ? {
                  margin: "0.5rem 0",
                  padding: "0.875rem 1rem",
                  backgroundColor: visual.wash,
                  borderInlineStart: `3px solid ${visual.rail}`,
                }
              : {
                  padding: "0.875rem 0 0.875rem 1rem",
                  borderInlineStart: `3px solid ${visual.rail}`,
                  borderBottom:
                    idx < items.length - 1
                      ? "1px solid var(--color-shop-divider)"
                      : "none",
                }
          }
        >
          <span
            dir="ltr"
            style={{
              display: "inline-block",
              padding: "0.125rem 0.5rem",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              color: visual.pillColor,
              backgroundColor: visual.pillBg,
            }}
          >
            {auditActionLabel(item.action)}
          </span>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
            }}
          >
            {item.actorName}{" "}
            <span style={{ color: isNote ? "#78350f" : "#6b6b6b" }}>
              (
              {item.actorType === "STAFF" && item.actorRole
                ? STAFF_ROLE_LABELS[item.actorRole as StaffRole]
                : item.actorType}
              )
            </span>
          </p>
          {detailLine !== null && <p style={detailLineStyle}>{detailLine}</p>}
          {reason !== null && (
            <blockquote
              style={{
                margin: 0,
                marginTop: "0.5rem",
                borderInlineStart: `3px solid ${
                  isNote ? visual.rail : "var(--color-shop-divider)"
                }`,
                paddingInlineStart: "0.75rem",
                fontSize: "var(--text-body-sm)",
                color: isNote ? "#78350f" : "#6b6b6b",
                fontStyle: "italic",
                whiteSpace: "pre-line",
              }}
            >
              {reason}
            </blockquote>
          )}
          <p
            style={{
              marginTop: "0.125rem",
              fontSize: "var(--text-body-sm)",
              color: isNote ? visual.pillColor : "#6b6b6b",
            }}
          >
            {formatDateTime(item.createdAt, "en")}
          </p>
          {(item.before != null || item.after != null) && (
            <details style={{ marginTop: "0.5rem" }}>
              <summary
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#1e40af",
                  cursor: "pointer",
                }}
              >
                View changes
              </summary>
              <div style={{ marginTop: "0.5rem" }}>
                <DiffBody row={item} />
              </div>
            </details>
          )}
        </div>
        );
      })}
    </div>
  );
}
