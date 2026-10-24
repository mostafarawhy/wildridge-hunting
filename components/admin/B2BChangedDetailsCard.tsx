import { formatDateTime } from "@/lib/utils/date";
import type { AuditLogListItem } from "@/lib/db/queries/audit-log";

interface Props {
  items: AuditLogListItem[];
}

const FIELDS: { key: string; label: string; mono: boolean }[] = [
  { key: "companyNameEn", label: "Company (EN)", mono: false },
  { key: "companyNameAr", label: "Company (AR)", mono: false },
  { key: "tradeLicenseNo", label: "Trade License No.", mono: true },
  { key: "vatNumber", label: "VAT Number", mono: false },
  { key: "contactName", label: "Contact Name", mono: false },
  { key: "contactPhone", label: "Contact Phone", mono: false },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
  margin: 0,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function B2BChangedDetailsCard({ items }: Props) {
  const event = items.find((i) => i.action === "b2b.details_updated");
  if (!event) return null;

  const before = asRecord(event.before);
  const after = asRecord(event.after);
  if (!before || !after) return null;

  const changed = FIELDS.map((field) => {
    const from = asText(before[field.key]);
    const to = asText(after[field.key]);
    if (from === to) return null;
    return {
      label: field.label,
      mono: field.mono,
      from: from ?? "Not set",
      to: to ?? "Cleared",
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const licenceReplaced = after.licenceDocumentReplaced === true;
  const total = changed.length + (licenceReplaced ? 1 : 0);

  return (
    <div style={cardStyle}>
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p
          style={{
            ...rowLabelStyle,
            color: "var(--color-action-primary)",
          }}
        >
          Changed details
        </p>
        <p
          style={{
            marginTop: "0.25rem",
            marginBottom: 0,
            fontSize: "var(--text-body-sm)",
            color: "#6b6b6b",
          }}
        >
          Updated by {event.actorName} ·{" "}
          {formatDateTime(event.createdAt, "en")}
        </p>
      </div>
      <div style={{ padding: "0 1.25rem" }}>
        {total === 0 && (
          <p
            style={{
              padding: "0.875rem 0",
              margin: 0,
              fontSize: "var(--text-body)",
              color: "#6b6b6b",
            }}
          >
            No identity fields changed in this update.
          </p>
        )}
        {changed.map((row, idx) => (
          <div
            key={row.label}
            style={{
              padding: "0.875rem 0",
              borderBottom:
                idx < total - 1
                  ? "1px solid var(--color-shop-divider)"
                  : "none",
            }}
          >
            <p style={rowLabelStyle}>{row.label}</p>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginTop: "0.375rem",
              }}
            >
              <span
                dir={row.mono ? "ltr" : undefined}
                style={{
                  fontSize: "var(--text-body)",
                  color: "#6b6b6b",
                  ...(row.mono ? { fontFamily: "monospace" } : {}),
                }}
              >
                {row.from}
              </span>
              <span
                aria-hidden="true"
                style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
              >
                →
              </span>
              <span
                dir={row.mono ? "ltr" : undefined}
                style={{
                  fontSize: "var(--text-body)",
                  color: "#0b0b0b",
                  ...(row.mono ? { fontFamily: "monospace" } : {}),
                }}
              >
                {row.to}
              </span>
            </div>
          </div>
        ))}
        {licenceReplaced && (
          <div style={{ padding: "0.875rem 0" }}>
            <p style={rowLabelStyle}>License document</p>
            <p
              style={{
                marginTop: "0.375rem",
                marginBottom: 0,
                fontSize: "var(--text-body)",
                color: "#0b0b0b",
              }}
            >
              Replaced with this update
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
