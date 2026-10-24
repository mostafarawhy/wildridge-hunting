import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import { formatDisplayDate } from "@/lib/utils/date";

interface Props {
  message: string;
  requestedAt: string;
  locale: "en" | "ar" | "ru";
  scope: "DOCUMENTS" | "DETAILS";
  children?: ReactNode;
}

function ExclamationIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0, marginTop: "1px" }}
    >
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" />
      <line
        x1="10"
        y1="6"
        x2="10"
        y2="11"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14" r="0.75" fill={color} />
    </svg>
  );
}

export default function VerificationDocumentRequestNotice({
  message,
  requestedAt,
  locale,
  scope,
  children,
}: Props) {
  const t = useTranslations("account.verification");

  return (
    <div
      className="flex flex-col gap-3 p-5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
        borderInlineStart: "3px solid var(--color-status-warning)",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "var(--color-status-warning)",
        }}
      >
        {t("request.heading")}
      </p>
      <div className="flex items-start gap-3">
        <ExclamationIcon color="var(--color-status-warning)" />
        <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {scope === "DETAILS" ? t("request.bodyDetails") : t("request.body")}
          </p>
          <blockquote
            style={{
              margin: 0,
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
              {t("request.messageLabel")}
            </p>
            {message}
          </blockquote>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
            }}
          >
            {t("request.requestedOn", {
              date: formatDisplayDate(requestedAt, locale),
            })}
          </p>
          {scope === "DETAILS" && !children && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <LocaleButtonLink
                href="/account/verification/details"
                variant="primary"
                size="md"
              >
                {t("request.detailsCta")}
              </LocaleButtonLink>
            </div>
          )}
        </div>
      </div>
      {children && (
        <div
          style={{
            borderTop: "1px solid var(--color-shop-divider)",
            paddingTop: "1.25rem",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
