import { getTranslations } from "next-intl/server";
import { formatShortDate } from "@/lib/utils/date";
import type { CustomerSupportRequest } from "@/lib/db/queries/support";

interface Props {
  requests: CustomerSupportRequest[];
  locale: "en" | "ar" | "ru";
}

type StatusTone = "success" | "info" | "warning" | "danger" | "neutral";

const STATUS_TONE: Record<CustomerSupportRequest["status"], StatusTone> = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  WAITING_ON_CUSTOMER: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const TONE_TOKENS: Record<StatusTone, { border: string; text: string }> = {
  success: { border: "var(--primitive-green)", text: "var(--primitive-green)" },
  info: { border: "var(--primitive-blue)", text: "var(--primitive-blue)" },
  warning: { border: "var(--primitive-amber)", text: "var(--primitive-amber)" },
  danger: {
    border: "var(--color-action-primary)",
    text: "var(--color-action-primary)",
  },
  neutral: {
    border: "var(--primitive-muted-gray)",
    text: "var(--primitive-muted-gray)",
  },
};

function StatusPill({
  status,
  label,
}: {
  status: CustomerSupportRequest["status"];
  label: string;
}) {
  const tokens = TONE_TOKENS[STATUS_TONE[status]];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1875rem 0.5rem",
        fontSize: "var(--text-eyebrow)",
        fontWeight: "var(--font-black)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        borderRadius: "var(--radius-none)",
        border: `1px solid ${tokens.border}`,
        color: tokens.text,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const sectionCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "var(--color-action-primary)",
  margin: 0,
};

export default async function SupportRequestList({ requests, locale }: Props) {
  const t = await getTranslations("account.support");

  return (
    <div style={sectionCard}>
      <p style={sectionTitle}>{t("list.title")}</p>

      {requests.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {t("list.empty")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {requests.map((request) => {
            const title = request.systemSubject
              ? request.linked?.kind === "order"
                ? (
                    <>
                      {t("list.aboutOrder")}{" "}
                      <span dir="ltr">{request.linked.number}</span>
                    </>
                  )
                : (
                    <>
                      {t("list.aboutQuote")}{" "}
                      <span dir="ltr">{request.linked?.number}</span>
                    </>
                  )
              : request.subject;

            const linkedLabel = request.linked
              ? request.linked.kind === "order"
                ? (
                    <>
                      {t("list.linked.order")}{" "}
                      <span dir="ltr">{request.linked.number}</span>
                    </>
                  )
                : request.linked.kind === "quote"
                  ? (
                      <>
                        {t("list.linked.quote")}{" "}
                        <span dir="ltr">{request.linked.number}</span>
                      </>
                    )
                  : request.linked.kind === "b2b"
                    ? t("list.linked.b2b")
                    : t("list.linked.verification")
              : null;

            return (
              <div
                key={request.id}
                style={{
                  border: "1px solid var(--color-shop-divider)",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      fontWeight: "var(--font-semibold)",
                      color: "var(--color-auth-label-text)",
                      margin: 0,
                    }}
                  >
                    {title}
                  </p>
                  <StatusPill
                    status={request.status}
                    label={t(`status.${request.status}`)}
                  />
                </div>

                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                    margin: 0,
                  }}
                >
                  <span dir="ltr">{request.ticketNumber}</span>
                  {linkedLabel && <> · {linkedLabel}</>}
                  {" · "}
                  {t("list.opened", {
                    date: formatShortDate(request.createdAt, locale),
                  })}
                </p>

                {request.status === "WAITING_ON_CUSTOMER" && (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--primitive-amber)",
                      margin: 0,
                    }}
                  >
                    {t("list.waitingHint")}
                  </p>
                )}

                <details>
                  <summary
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-action-primary)",
                      cursor: "pointer",
                    }}
                  >
                    {t("list.showMessage")}
                  </summary>
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      whiteSpace: "pre-wrap",
                      marginTop: "0.5rem",
                    }}
                  >
                    {request.message}
                  </p>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
