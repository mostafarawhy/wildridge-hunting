"use client";

import Image from "next/image";
import BrandMark from "@/components/ui/BrandMark";
import { useTranslations } from "next-intl";
import { formatDisplayDate } from "@/lib/utils/date";

interface VerificationCredentialCardProps {
  eventId: string | null;
  provider: "SUMSUB" | "UAE_PASS" | "MANUAL_REVIEW";
  holderName: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  locale: "en" | "ar" | "ru";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "#6b6b6b",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Rule() {
  return (
    <div
      style={{
        height: "1px",
        backgroundColor: "var(--color-shop-divider)",
        margin: "1rem 0",
      }}
    />
  );
}

export default function VerificationCredentialCard({
  eventId,
  provider,
  holderName,
  verifiedAt,
  expiresAt,
  locale,
}: VerificationCredentialCardProps) {
  const t = useTranslations("checkout.verify.credential");

  const methodLabel =
    provider === "UAE_PASS" ? t("methodUaePass") : t("methodManual");

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "3px",
          backgroundColor: "var(--color-action-primary)",
        }}
      />
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BrandMark size={44} />
            <p
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "var(--color-action-primary)",
              }}
            >
              {t("eyebrow")}
            </p>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <circle cx="10" cy="10" r="10" fill="var(--primitive-green)" />
              <polyline
                points="5.5,10 8.5,13 14.5,7"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "var(--primitive-green)",
              }}
            >
              {t("status")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div
            style={{
              position: "relative",
              width: "110px",
              height: "110px",
              border: "1px solid var(--color-shop-divider)",
              borderRadius: "var(--radius-none)",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <Image
              src="/images/verification/id-holder.jpg"
              alt=""
              fill
              sizes="110px"
              className="object-cover object-top"
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              minWidth: 0,
            }}
          >
            {holderName !== null && (
              <Field label={t("holder")}>
                <span
                  style={{
                    fontSize: "var(--text-ui)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--primitive-black)",
                  }}
                >
                  {holderName}
                </span>
              </Field>
            )}

            <Field label={t("method")}>
              <span
                style={{
                  fontSize: "var(--text-body)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--primitive-black)",
                }}
              >
                {methodLabel}
              </span>
            </Field>
          </div>
        </div>

        <Rule />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <Field label={t("verified")}>
            <span
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--primitive-black)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {verifiedAt ? formatDisplayDate(verifiedAt, locale) : ""}
            </span>
          </Field>

          <Field label={t("validUntil")}>
            <span
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--primitive-black)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {expiresAt ? formatDisplayDate(expiresAt, locale) : ""}
            </span>
          </Field>
        </div>

        {eventId !== null && (
          <>
            <Rule />
            <Field label={t("reference")}>
              <span
                dir="ltr"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--primitive-black)",
                  wordBreak: "break-all",
                }}
              >
                {eventId}
              </span>
            </Field>
          </>
        )}
      </div>
    </div>
  );
}
