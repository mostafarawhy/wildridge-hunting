import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getCustomerB2BStatus } from "@/lib/db/queries/customer";
import { getOwnB2BDocuments } from "@/lib/db/queries/b2b";
import { getOwnB2BHistory } from "@/lib/db/queries/review-history";
import { createSignedUrl } from "@/lib/services/storage";
import { getSetting } from "@/lib/db/queries/settings";
import { formatDisplayDate } from "@/lib/utils/date";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import {
  B2BCredentialCard,
  B2BDocumentStrip,
  B2BDocumentRequestNotice,
  B2BProvideDocumentsForm,
  ReviewHistory,
} from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";

const BUCKET = "b2b-documents";

const STATUS_ACCENT: Record<"warning" | "danger" | "neutral", string> = {
  warning: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
  neutral: "var(--color-status-neutral-text)",
};

function StatusPanel({
  type,
  eyebrow,
  children,
}: {
  type: "warning" | "danger" | "neutral";
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: STATUS_ACCENT[type],
        }}
      >
        {eyebrow}
      </p>
      {children}
    </div>
  );
}

function StatusIcon({
  variant,
  color,
}: {
  variant: "clock" | "cross" | "exclamation";
  color: string;
}) {
  if (variant === "cross") {
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
          x1="6.5"
          y1="6.5"
          x2="13.5"
          y2="13.5"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="13.5"
          y1="6.5"
          x2="6.5"
          y2="13.5"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === "exclamation") {
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

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0, marginTop: "1px" }}
    >
      <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" />
      <polyline
        points="10,5 10,10.5 13.5,12.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
}

export default async function B2BStatusPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("account.b2b");
  const session = await auth();

  if (session?.user?.principal !== "customer") {
    return redirect({ href: "/auth/login", locale });
  }

  const status = await getCustomerB2BStatus(session.user.id);

  if (!status) {
    return redirect({ href: "/b2b", locale });
  }

  const documents = await Promise.all(
    (await getOwnB2BDocuments(session.user.id)).map(async (d) => ({
      id: d.id,
      type: d.type,
      mimeType: d.mimeType ?? "",
      label: d.label,
      supersededAt: d.supersededAt,
      previewUrl: await createSignedUrl(BUCKET, d.storageKey, 300).catch(
        () => null,
      ),
    })),
  );

  const currentDocuments = documents.filter((d) => d.supersededAt === null);
  const previousDocuments = documents.filter((d) => d.supersededAt !== null);

  const b2bContent = await getSetting("b2b_content");

  const historyItemLabel: Record<string, string> = {
    TRADE_LICENSE: t("documents.tradeLicense"),
    VAT_CERTIFICATE: t("documents.vatCertificate"),
    COMPANY_ID: t("documents.companyId"),
  };
  const history = (await getOwnB2BHistory(session.user.id)).map((entry) => ({
    ...entry,
    items: entry.items.map(
      (item) => historyItemLabel[item] ?? t("documents.other"),
    ),
  }));

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Page header */}
      <AccountHeaderRow helpHref="/account/support?topic=BUSINESS">
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-action-primary)",
            letterSpacing: "var(--tracking-tight)",
            lineHeight: "var(--leading-tight)",
            margin: 0,
          }}
        >
          {t("pageTitle")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          {t("subtitle")}
        </p>
      </AccountHeaderRow>

      {status.openRequest && (
        <B2BDocumentRequestNotice
          message={status.openRequest.message}
          requestedAt={status.openRequest.requestedAt}
          locale={locale}
          scope={status.openRequest.scope}
        >
          {status.openRequest.scope === "DOCUMENTS" ? (
            <B2BProvideDocumentsForm
              accountId={status.id}
              locale={locale}
              b2bContent={b2bContent[locale]}
              requestedTypes={status.openRequest.types}
            />
          ) : null}
        </B2BDocumentRequestNotice>
      )}

      {status.derivedStatus === "APPROVED" ? (
        <B2BCredentialCard
          accountId={status.id}
          companyNameEn={status.companyNameEn}
          companyNameAr={status.companyNameAr}
          contactName={status.contactName}
          verifiedAt={status.verifiedAt}
          expiresAt={status.expiresAt}
          locale={locale}
        />
      ) : status.derivedStatus === "EXPIRED" ? (
        <StatusPanel type="neutral" eyebrow={t("expired.heading")}>
          <div className="flex items-start gap-3">
            <StatusIcon variant="clock" color={STATUS_ACCENT.neutral} />
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              {t("expired.body")}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <LocaleButtonLink
              href="/account/b2b/renew"
              variant="primary"
              size="md"
            >
              {t("expired.ctaRenew")}
            </LocaleButtonLink>
          </div>
        </StatusPanel>
      ) : status.status === "PENDING" ? (
        <StatusPanel type="warning" eyebrow={t("pending.heading")}>
          <div className="flex items-start gap-3">
            <StatusIcon variant="clock" color={STATUS_ACCENT.warning} />
            <div className="flex flex-col gap-1">
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {t("pending.body")}
              </p>
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.25rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-eyebrow)",
                    fontWeight: "var(--font-bold)",
                    letterSpacing: "var(--tracking-widest)",
                    textTransform: "uppercase",
                    marginInlineEnd: "0.5rem",
                  }}
                >
                  {t("pending.submittedOn")}
                </span>
                {formatDisplayDate(status.createdAt, locale)}
              </p>
            </div>
          </div>
        </StatusPanel>
      ) : status.status === "REJECTED" ? (
        <StatusPanel type="danger" eyebrow={t("rejected.heading")}>
          <div className="flex items-start gap-3">
            <StatusIcon variant="cross" color={STATUS_ACCENT.danger} />
            <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>
              {status.rejectionReason && (
                <blockquote
                  style={{
                    borderInlineStart:
                      "3px solid var(--color-status-danger-border)",
                    paddingInlineStart: "0.75rem",
                    color: "var(--color-content-tertiary)",
                    fontSize: "var(--text-body-sm)",
                    fontStyle: "italic",
                    margin: 0,
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
                    {t("rejected.reasonLabel")}
                  </p>
                  {status.rejectionReason}
                </blockquote>
              )}
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {t("rejected.body")}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "center",
                }}
              >
                <LocaleButtonLink
                  href="/auth/b2b-register"
                  variant="primary"
                  size="md"
                >
                  {t("rejected.ctaReapply")}
                </LocaleButtonLink>
                <LocaleButtonLink href="/account/support?topic=BUSINESS" variant="secondary" size="md">
                  {t("rejected.ctaContact")}
                </LocaleButtonLink>
              </div>
            </div>
          </div>
        </StatusPanel>
      ) : (
        <StatusPanel type="warning" eyebrow={t("suspended.heading")}>
          <div className="flex items-start gap-3">
            <StatusIcon variant="exclamation" color={STATUS_ACCENT.warning} />
            <div className="flex flex-col gap-3">
              {status.rejectionReason && (
                <blockquote
                  style={{
                    borderInlineStart: "3px solid var(--color-shop-divider)",
                    paddingInlineStart: "0.75rem",
                    color: "var(--color-content-tertiary)",
                    fontSize: "var(--text-body-sm)",
                    fontStyle: "italic",
                    margin: 0,
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
                    {t("suspended.reasonLabel")}
                  </p>
                  {status.rejectionReason}
                </blockquote>
              )}
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {t("suspended.body")}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  alignItems: "center",
                }}
              >
                <LocaleButtonLink href="/account/support?topic=BUSINESS" variant="secondary" size="md">
                  {t("suspended.ctaContact")}
                </LocaleButtonLink>
              </div>
            </div>
          </div>
        </StatusPanel>
      )}

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
          {t("businessDetails.heading")}
        </p>

        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            padding: "0 1.25rem",
          }}
        >
          {[
            {
              key: "tradeLicense",
              label: t("businessDetails.tradeLicenseLabel"),
              value: status.tradeLicenseNo,
              mono: true,
              dir: "ltr" as const,
            },
            status.vatNumber
              ? {
                  key: "vat",
                  label: t("businessDetails.vatLabel"),
                  value: status.vatNumber,
                  mono: true,
                  dir: "ltr" as const,
                }
              : null,
            {
              key: "company",
              label: t("businessDetails.companyLabel"),
              value: status.companyNameEn,
              secondaryValue: status.companyNameAr,
            },
            status.contactName
              ? {
                  key: "contactName",
                  label: t("businessDetails.contactNameLabel"),
                  value: status.contactName,
                }
              : null,
            status.contactPhone
              ? {
                  key: "contactPhone",
                  label: t("businessDetails.contactPhoneLabel"),
                  value: status.contactPhone,
                  dir: "ltr" as const,
                }
              : null,
          ]
            .filter((row) => row !== null)
            .map((row, index, rows) => (
              <div
                key={row.key}
                style={{
                  padding: "0.875rem 0",
                  borderBottom:
                    index < rows.length - 1
                      ? "1px solid var(--color-shop-divider)"
                      : "none",
                  textAlign: "start",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {row.label}
                </p>
                <p
                  dir={row.dir}
                  style={{
                    fontFamily: row.mono ? "var(--font-mono)" : undefined,
                    fontSize: "var(--text-body)",
                    color: "var(--primitive-black)",
                    marginTop: "0.125rem",
                  }}
                >
                  {row.value}
                </p>
                {row.secondaryValue && (
                  <p
                    style={{
                      fontSize: "var(--text-body)",
                      color: "var(--primitive-black)",
                      marginTop: "0.125rem",
                    }}
                  >
                    {row.secondaryValue}
                  </p>
                )}
              </div>
            ))}
        </div>

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            marginTop: "0.5rem",
          }}
        >
          {t("businessDetails.hint")}
        </p>
      </div>

      {currentDocuments.length > 0 && (
        <B2BDocumentStrip
          documents={currentDocuments}
          heading={t("documents.currentHeading")}
        />
      )}
      {previousDocuments.length > 0 && (
        <B2BDocumentStrip
          documents={previousDocuments}
          heading={t("documents.previousHeading")}
          hint={t("documents.previousHint")}
          muted
          collapsible
        />
      )}

      {history.length > 0 && (
        <ReviewHistory entries={history} locale={locale} />
      )}
    </div>
  );
}
