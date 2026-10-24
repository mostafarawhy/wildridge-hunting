"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDisplayDate } from "@/lib/utils/date";
import type { VerificationStatusProjection } from "@/lib/db/queries/verification";
import MethodSelector from "@/components/verification/MethodSelector";
import VerificationCredentialCard from "@/components/verification/VerificationCredentialCard";
import VerificationStatusPanel from "@/components/verification/VerificationStatusPanel";
import VerificationRenewNotice from "@/components/verification/VerificationRenewNotice";
import type { SettingValue } from "@/lib/settings/keys";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";

// ─── Props ────────────────────────────────────────────────────────────────────
interface VerifyStepProps {
  verification: VerificationStatusProjection;
  locale: "en" | "ar" | "ru";
  holderName: string | null;
  verificationContent?: SettingValue<"verification_content">["en"];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── Main VerifyStep component ────────────────────────────────────────────────

export default function VerifyStep({
  verification,
  locale,
  holderName,
  verificationContent,
}: VerifyStepProps) {
  const t = useTranslations("checkout.verify");
  const [showRenew, setShowRenew] = useState(false);

  const {
    status,
    verifiedAt,
    expiresAt,
    latestEvent,
    nearExpiry,
    expiryPassed,
  } = verification;

  // Canonical, timezone-aware date formatter (Asia/Dubai)
  const fmt = (iso: string | null) =>
    iso ? formatDisplayDate(iso, locale) : "";

  // APPROVED
  if (status === "APPROVED" && !showRenew) {
    return (
      <div>
        <VerificationCredentialCard
          eventId={latestEvent?.id ?? null}
          provider={latestEvent?.provider ?? "MANUAL_REVIEW"}
          holderName={holderName}
          verifiedAt={verifiedAt}
          expiresAt={expiresAt}
          locale={locale}
        />

        {nearExpiry && <VerificationRenewNotice onRenew={() => setShowRenew(true)} />}
      </div>
    );
  }

  // PENDING
  if (status === "PENDING") {
    const submittedAt = latestEvent?.createdAt ?? null;
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
            {submittedAt && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                  marginTop: "0.25rem",
                }}
              >
                {t("pending.submittedAt", { date: fmt(submittedAt) })}
              </p>
            )}
          </div>
        </div>
      </VerificationStatusPanel>
    );
  }

  // REJECTED
  if (status === "REJECTED") {
    return (
      <div className="flex flex-col gap-4">
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
              {latestEvent?.rejectionReason && (
                <blockquote
                  style={{
                    borderInlineStart:
                      "3px solid var(--color-status-danger-border)",
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
                  {latestEvent.rejectionReason}
                </blockquote>
              )}

              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#6b6b6b",
                }}
              >
                {t("rejected.body")}
              </p>

              {latestEvent?.reviewedAt && (
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                  }}
                >
                  {t("rejected.reviewedOn", {
                    date: fmt(latestEvent.reviewedAt),
                  })}
                </p>
              )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    alignItems: "center",
                  }}
                >
                  <LocaleButtonLink href="/account/support?topic=ACCOUNT" variant="secondary" size="md">
                    {t("rejected.ctaContact")}
                  </LocaleButtonLink>
                </div>
            </div>
          </div>
        </VerificationStatusPanel>

        <MethodSelector
          locale={locale}
          variant="account"
          verificationContent={verificationContent}
        />
      </div>
    );
  }

  // EXPIRED
  if (status === "EXPIRED") {
    return (
      <div className="flex flex-col gap-4">
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

              {expiresAt && expiryPassed && (
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                  }}
                >
                  {t("expired.expiredOn", { date: fmt(expiresAt) })}
                </p>
              )}
            </div>
          </div>
        </VerificationStatusPanel>

        <MethodSelector
          locale={locale}
          variant="account"
          verificationContent={verificationContent}
        />
      </div>
    );
  }

  return (
    <MethodSelector
      locale={locale}
      variant="account"
      verificationContent={verificationContent}
    />
  );
}
