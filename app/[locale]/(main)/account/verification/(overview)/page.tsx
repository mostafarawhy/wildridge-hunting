import { redirect } from "next/navigation";
import { isUaePassEnabled } from "@/lib/env.client";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import {
  getCustomerVerificationStatus,
  getOwnVerificationDocuments,
} from "@/lib/db/queries/verification";
import { getOwnVerificationHistory } from "@/lib/db/queries/review-history";
import { createSignedUrl } from "@/lib/services/storage";
import { getSetting } from "@/lib/db/queries/settings";
import { formatDisplayDate } from "@/lib/utils/date";
import VerifyStep from "@/components/verification/VerifyStep";
import CustomerDocumentStrip from "@/components/verification/CustomerDocumentStrip";
import VerificationDocumentRequestNotice from "@/components/verification/VerificationDocumentRequestNotice";
import ProvideVerificationDocumentsForm from "@/components/verification/ProvideVerificationDocumentsForm";
import { ReviewHistory } from "@/components/account";
import AccountHeaderRow from "@/components/account/AccountHeaderRow";
import type { VerificationStatusProjection } from "@/lib/db/queries/verification";

const BUCKET = "verification-docs";

interface Props {
  params: Promise<{ locale: "en" | "ar" | "ru" }>;
  searchParams: Promise<{ error?: string; success?: string; notice?: string }>;
}

// NOT_REQUIRED as a safe fallback projection when customer row exists
// but has no verification events — this means they haven't needed it yet
const NOT_REQUIRED_PROJECTION: VerificationStatusProjection = {
  status: "NOT_REQUIRED",
  verifiedAt: null,
  expiresAt: null,
  nearExpiry: false,
  latestEvent: null,
  openRequest: null,
};

export default async function AccountVerificationPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const { error, notice } = await searchParams;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const session = await auth();
  if (session?.user?.principal !== "customer") {
    redirect(
      `/${locale}/auth/login?callbackUrl=/${locale}/account/verification`,
    );
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const verificationStatus = await getCustomerVerificationStatus(
    session.user.id,
  );

  const projection: VerificationStatusProjection =
    verificationStatus ?? NOT_REQUIRED_PROJECTION;

  const ownDocuments = await Promise.all(
    (await getOwnVerificationDocuments(session.user.id)).map(async (d) => ({
      id: d.id,
      role: d.role,
      mimeType: d.mimeType,
      supersededAt: d.supersededAt,
      previewUrl: await createSignedUrl(BUCKET, d.storageKey, 300).catch(
        () => null,
      ),
    })),
  );

  const currentDocuments = ownDocuments.filter(
    (d) => d.supersededAt === null,
  );
  const previousDocuments = ownDocuments.filter(
    (d) => d.supersededAt !== null,
  );

  const verificationContent = (await getSetting("verification_content"))[
    locale
  ];

  const t = await getTranslations("account.verification");
  const tErr = await getTranslations("auth.uaePass.errors");

  const historyItemLabel: Record<string, string> = {
    IDENTITY: t("documents.identity"),
    PROOF_OF_ADDRESS: t("documents.proofOfAddress"),
    PHOTO: t("documents.photo"),
  };
  const history = (await getOwnVerificationHistory(session.user.id)).map(
    (entry) => ({
      ...entry,
      items: entry.items.map((item) => historyItemLabel[item] ?? item),
    }),
  );

  const uaePassEnabled = isUaePassEnabled();

  let errorMessage: string | null = null;
  if (uaePassEnabled && error) {
    if (error === "data_sharing_exited")
      errorMessage = tErr("dataSharingExited");
    else if (error === "data_sharing_error")
      errorMessage = tErr("dataSharingError");
    else errorMessage = tErr("generic");
  }

  let noticeMessage: string | null = null;
  if (uaePassEnabled && !error && notice === "uae_pass_manual_review") {
    noticeMessage = t("manualReviewNotice");
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Page header */}
      <AccountHeaderRow helpHref="/account/support?topic=ACCOUNT">
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
          {t("title")}
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

      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: "var(--color-auth-error-bg)",
            border: "1px solid var(--color-auth-error-border)",
            color: "var(--color-auth-error-text)",
            padding: "0.75rem 1rem",
            fontSize: "var(--text-body-sm)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {noticeMessage && (
        <div
          role="status"
          style={{
            backgroundColor: "var(--color-status-neutral-bg)",
            border: "1px solid var(--color-status-neutral-border)",
            color: "var(--color-status-neutral-text)",
            padding: "0.75rem 1rem",
            fontSize: "var(--text-body-sm)",
          }}
        >
          {noticeMessage}
        </div>
      )}

      {projection.openRequest && (
        <VerificationDocumentRequestNotice
          message={projection.openRequest.message}
          requestedAt={projection.openRequest.createdAt}
          locale={locale}
          scope={projection.openRequest.scope}
        >
          {projection.openRequest.scope === "DOCUMENTS" ? (
            <ProvideVerificationDocumentsForm
              roles={projection.openRequest.roles}
              locale={locale}
              verificationContent={verificationContent}
            />
          ) : null}
        </VerificationDocumentRequestNotice>
      )}

      {/* Verify step */}
      <VerifyStep
        verification={projection}
        locale={locale}
        holderName={session.user.name ?? session.user.email ?? null}
        verificationContent={verificationContent}
      />

      {projection.latestEvent?.declaredIdNumber && (
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
            {t("submittedDetails.heading")}
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
                key: "id",
                label: t("submittedDetails.idLabel"),
                value: projection.latestEvent.declaredIdNumber,
                mono: true,
                dir: "ltr" as const,
              },
              projection.latestEvent.declaredAddress
                ? {
                    key: "address",
                    label: t("submittedDetails.addressLabel"),
                    value: projection.latestEvent.declaredAddress,
                  }
                : null,
              {
                key: "submitted",
                label: t("submittedDetails.submittedLabel"),
                value: formatDisplayDate(projection.latestEvent.createdAt, locale),
              },
              projection.latestEvent.acknowledgedAt
                ? {
                    key: "declaration",
                    label: t("submittedDetails.declarationLabel"),
                    value: formatDisplayDate(
                      projection.latestEvent.acknowledgedAt,
                      locale,
                    ),
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
            {t("submittedDetails.hint")}
          </p>
        </div>
      )}

      {currentDocuments.length > 0 && (
        <CustomerDocumentStrip documents={currentDocuments} />
      )}
      {previousDocuments.length > 0 && (
        <CustomerDocumentStrip
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
