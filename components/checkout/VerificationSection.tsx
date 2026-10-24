"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SectionHeading } from "./FormPrimitives";
import type { VerificationProjection } from "@/lib/db/queries/checkout";
import VerificationCredentialCard from "@/components/verification/VerificationCredentialCard";
import VerificationRenewNotice from "@/components/verification/VerificationRenewNotice";
import VerificationStatusPanel from "@/components/verification/VerificationStatusPanel";

interface VerificationSectionProps {
  verification: VerificationProjection;
  locale: "en" | "ar" | "ru";
}

/* ─────────────────────────────────────────────────────────────────────────
 * Renders only when verification.required === true.
 * UAE Pass users land here with status APPROVED → green confirmation.
 * Manual reviewers see PENDING / REJECTED / EXPIRED states with CTAs.
 * ─────────────────────────────────────────────────────────────────────── */

export default function VerificationSection({
  verification,
  locale,
}: VerificationSectionProps) {
  const t = useTranslations("checkout.verification");

  if (!verification.required) return null;

  const { status, latestEvent } = verification;

  return (
    <section className="mb-12">
      <SectionHeading title={t("title")} />

      {status === "APPROVED" && (
        <div>
          <VerificationCredentialCard
            eventId={verification.credential?.eventId ?? null}
            provider={verification.credential?.provider ?? "MANUAL_REVIEW"}
            holderName={verification.holderName}
            verifiedAt={verification.verifiedAt}
            expiresAt={verification.expiresAt}
            locale={locale}
          />
          {verification.nearExpiry && (
            <VerificationRenewNotice href={`/${locale}/account/verification`} />
          )}
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-semibold)",
              color: "var(--primitive-green)",
            }}
          >
            {t("approved.body")}
          </p>
        </div>
      )}
      {status === "PENDING" && <PendingState />}
      {status === "REJECTED" && (
        <RejectedState
          locale={locale}
          rejectionReason={latestEvent?.rejectionReason ?? null}
        />
      )}
      {status === "EXPIRED" && <ExpiredState locale={locale} />}
      {(status === "NOT_REQUIRED" || !status) && (
        <RequiredState locale={locale} />
      )}
    </section>
  );
}

/* ───────── states ─────────────────────────────────────────────────────── */

function PendingState() {
  const t = useTranslations("checkout.verification");
  return (
    <VerificationStatusPanel type="warning" eyebrow={t("pending.title")}>
      <div className="flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0, marginTop: "1px" }}
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            stroke="var(--color-status-warning)"
            strokeWidth="1.5"
          />
          <polyline
            points="10,5 10,10.5 13.5,12.5"
            stroke="var(--color-status-warning)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="flex flex-col gap-1">
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
            }}
          >
            {t("pending.body")}
          </p>
        </div>
      </div>
    </VerificationStatusPanel>
  );
}

function RejectedState({
  locale,
  rejectionReason,
}: {
  locale: string;
  rejectionReason: string | null;
}) {
  const t = useTranslations("checkout.verification");
  return (
    <VerificationStatusPanel type="danger" eyebrow={t("rejected.title")}>
      <div className="flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0, marginTop: "1px" }}
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            stroke="var(--color-status-danger)"
            strokeWidth="1.5"
          />
          <line
            x1="6.5"
            y1="6.5"
            x2="13.5"
            y2="13.5"
            stroke="var(--color-status-danger)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="13.5"
            y1="6.5"
            x2="6.5"
            y2="13.5"
            stroke="var(--color-status-danger)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="flex flex-col gap-1.5">
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
            }}
          >
            {t("rejected.body")}
          </p>

          {rejectionReason && (
            <blockquote
              style={{
                borderInlineStart: "3px solid var(--color-status-danger-border)",
                paddingInlineStart: "0.75rem",
                color: "#6b6b6b",
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
                  color: "#6b6b6b",
                }}
              >
                {t("rejected.reasonLabel")}
              </p>
              {rejectionReason}
            </blockquote>
          )}

          <div className="mt-2">
            <Link
              href={`/${locale}/account/verification`}
              className="inline-flex items-center gap-1.5 h-11 px-5 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] hover:bg-[var(--color-action-secondary-hover-bg)] transition-colors"
            >
              {t("rejected.cta")}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="rtl:rotate-180"
              >
                <path
                  d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </VerificationStatusPanel>
  );
}

function ExpiredState({ locale }: { locale: string }) {
  const t = useTranslations("checkout.verification");
  return (
    <VerificationStatusPanel type="danger" eyebrow={t("expired.title")}>
      <div className="flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0, marginTop: "1px" }}
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            stroke="var(--color-status-danger)"
            strokeWidth="1.5"
          />
          <polyline
            points="10,5 10,10.5 13.5,12.5"
            stroke="var(--color-status-danger)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <div className="flex flex-col gap-1">
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
            }}
          >
            {t("expired.body")}
          </p>

          <div className="mt-2">
            <Link
              href={`/${locale}/account/verification`}
              className="inline-flex items-center gap-1.5 h-11 px-5 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] hover:bg-[var(--color-action-secondary-hover-bg)] transition-colors"
            >
              {t("expired.cta")}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="rtl:rotate-180"
              >
                <path
                  d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </VerificationStatusPanel>
  );
}

function RequiredState({ locale }: { locale: string }) {
  const t = useTranslations("checkout.verification");
  return (
    <VerificationStatusPanel type="danger" eyebrow={t("required.title")}>
      <div className="flex items-start gap-3">
        <svg
          width="22"
          height="24"
          viewBox="0 0 18 20"
          fill="none"
          className="shrink-0 mt-0.5"
        >
          <path
            d="M9 1L1.5 4.5V10C1.5 14 5 17.5 9 19C13 17.5 16.5 14 16.5 10V4.5L9 1Z"
            stroke="var(--color-action-primary)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M6 10L8 12L12 8"
            stroke="var(--color-action-primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex flex-col gap-1">
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
            }}
          >
            {t("required.body")}
          </p>

          <div className="mt-2">
            <Link
              href={`/${locale}/account/verification`}
              className="inline-flex items-center gap-1.5 h-11 px-5 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] hover:bg-[var(--color-action-secondary-hover-bg)] transition-colors"
            >
              {t("required.cta")}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="rtl:rotate-180"
              >
                <path
                  d="M2.5 6H9.5M6.5 3L9.5 6L6.5 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </VerificationStatusPanel>
  );
}
