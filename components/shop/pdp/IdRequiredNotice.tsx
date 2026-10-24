import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isUaePassEnabled } from "@/lib/env.client";

interface IdRequiredNoticeProps {
  variant?: "full" | "compact";
}

export default function IdRequiredNotice({
  variant = "full",
}: IdRequiredNoticeProps) {
  const t = useTranslations("shop");
  const compact = variant === "compact";

  const icon = (
    <svg
      aria-hidden="true"
      width={compact ? 18 : 22}
      height={compact ? 18 : 22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={
        compact
          ? {
              color: "var(--color-action-primary)",
              marginTop: "1px",
              flexShrink: 0,
            }
          : undefined
      }
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M5.5 16.5c.6-1.5 1.8-2.3 3.5-2.3s2.9.8 3.5 2.3" />
      <path d="M14.5 10h4" />
      <path d="M14.5 13.5h3" />
    </svg>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: compact ? "0.625rem" : "0.875rem",
        border: "1px solid var(--color-auth-form-border)",
        borderInlineStart: "3px solid var(--color-action-primary)",
        padding: compact ? "0.75rem 0.875rem" : "1rem 1.125rem",
      }}
    >
      {compact ? (
        icon
      ) : (
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "1px solid var(--color-auth-form-border)",
            color: "var(--color-action-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          minWidth: 0,
        }}
      >
        <p
          className="text-body-sm"
          style={{
            color: "var(--primitive-black)",
            fontWeight: "var(--font-semibold)",
          }}
        >
          {t("id_notice.title")}
        </p>
        {!compact && (
          <p
            className="text-body-sm"
            style={{
              color: "var(--color-content-tertiary)",
              lineHeight: 1.55,
            }}
          >
            {t(isUaePassEnabled() ? "id_notice.body" : "id_notice.body_without_uaepass")}
          </p>
        )}
        <Link
          href={{ pathname: "/faq", query: { q: t("id_notice.faq_query") } }}
          className="text-body-sm underline"
          style={{
            color: "var(--color-action-primary)",
            textUnderlineOffset: "3px",
            marginTop: "0.25rem",
          }}
        >
          {t("id_notice.link")}
        </Link>
      </div>
    </div>
  );
}
