"use client";

import Image from "next/image";
import BrandMark from "@/components/ui/BrandMark";
import { useTranslations } from "next-intl";
import { formatDisplayDate } from "@/lib/utils/date";

interface B2BCredentialCardProps {
  accountId: string;
  companyNameEn: string;
  companyNameAr: string | null;
  contactName: string | null;
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        textAlign: "start",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "var(--color-content-tertiary)",
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

export default function B2BCredentialCard({
  accountId,
  companyNameEn,
  companyNameAr,
  contactName,
  verifiedAt,
  expiresAt,
  locale,
}: B2BCredentialCardProps) {
  const t = useTranslations("account.b2b");

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
              {t("credential.eyebrow")}
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
              {t("credential.status")}
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
              src="/images/verification/b2b-holder.jpg"
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
            <Field label={t("credential.company")}>
              <span
                style={{
                  fontSize: "var(--text-ui)",
                  fontWeight: "var(--font-semibold)",
                  color: "var(--primitive-black)",
                }}
              >
                {companyNameEn}
              </span>
              {companyNameAr && (
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--primitive-black)",
                    marginTop: "0.125rem",
                  }}
                >
                  {companyNameAr}
                </span>
              )}
            </Field>

            {contactName !== null && (
              <Field label={t("credential.contact")}>
                <span
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--primitive-black)",
                  }}
                >
                  {contactName}
                </span>
              </Field>
            )}
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
          <Field label={t("credential.approvedOn")}>
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

          <Field label={t("credential.validUntil")}>
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

        <Rule />
        <Field label={t("credential.reference")}>
          <span
            dir="ltr"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-body-sm)",
              color: "var(--primitive-black)",
              wordBreak: "break-all",
            }}
          >
            {accountId}
          </span>
        </Field>
      </div>
    </div>
  );
}
