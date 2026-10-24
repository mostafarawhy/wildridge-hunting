import { useTranslations } from "next-intl";
import { formatDisplayDate } from "@/lib/utils/date";
import type { ReviewHistoryEntry, ReviewHistoryKind } from "@/lib/db/queries/review-history";

interface Props {
  entries: ReviewHistoryEntry[];
  locale: "en" | "ar" | "ru";
}

export default function ReviewHistory({ entries, locale }: Props) {
  const t = useTranslations("account.history");

  const kindLabel: Record<ReviewHistoryKind, string> = {
    submitted: t("kinds.submitted"),
    renewalSubmitted: t("kinds.renewalSubmitted"),
    documentsRequested: t("kinds.documentsRequested"),
    detailsRequested: t("kinds.detailsRequested"),
    documentsProvided: t("kinds.documentsProvided"),
    detailsUpdated: t("kinds.detailsUpdated"),
    approved: t("kinds.approved"),
    rejected: t("kinds.rejected"),
    suspended: t("kinds.suspended"),
    expired: t("kinds.expired"),
  };

  return (
    <div>
      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "var(--color-content-tertiary)",
          marginBottom: "0.75rem",
        }}
      >
        {t("heading")}
      </p>

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          padding: "0 1.25rem",
        }}
      >
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            style={{
              padding: "0.875rem 0",
              borderBottom:
                index < entries.length - 1
                  ? "1px solid var(--color-shop-divider)"
                  : "none",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--primitive-black)",
              }}
            >
              {kindLabel[entry.kind]}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                marginTop: "0.125rem",
              }}
            >
              {formatDisplayDate(entry.at, locale)}
            </p>
            {entry.items.length > 0 && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.125rem",
                }}
              >
                {entry.items.join(", ")}
              </p>
            )}
            {entry.message && (
              <blockquote
                style={{
                  margin: 0,
                  marginTop: "0.5rem",
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                  fontStyle: "italic",
                  whiteSpace: "pre-line",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-semibold)",
                    fontStyle: "normal",
                    marginBottom: "0.25rem",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("messageLabel")}
                </p>
                {entry.message}
              </blockquote>
            )}
            {entry.reason && (
              <blockquote
                style={{
                  margin: 0,
                  marginTop: "0.5rem",
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                  fontStyle: "italic",
                  whiteSpace: "pre-line",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-semibold)",
                    fontStyle: "normal",
                    marginBottom: "0.25rem",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("reasonLabel")}
                </p>
                {entry.reason}
              </blockquote>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
