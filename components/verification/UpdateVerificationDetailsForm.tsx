"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { updateVerificationDetailsAction } from "@/lib/actions/verification";
import type { SettingValue } from "@/lib/settings/keys";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

type VerificationContent = SettingValue<"verification_content">["en"];

function InstructionText({
  text,
  color = "var(--color-content-tertiary)",
  weight,
}: {
  text: string;
  color?: string;
  weight?: React.CSSProperties["fontWeight"];
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: "var(--text-body-sm)",
            color,
            fontWeight: weight,
            lineHeight: "var(--leading-relaxed)",
            marginTop: i === 0 ? 0 : "0.5rem",
            whiteSpace: "pre-line",
          }}
        >
          {p}
        </p>
      ))}
    </>
  );
}

interface FieldErrors {
  declaredIdNumber?: string;
  declaredAddress?: string;
}

interface Props {
  message: string;
  locale: "en" | "ar" | "ru";
  verificationContent: VerificationContent;
  initial: {
    declaredIdNumber: string | null;
    declaredAddress: string | null;
  };
}

export default function UpdateVerificationDetailsForm({
  message,
  locale,
  verificationContent,
  initial,
}: Props) {
  const t = useTranslations("account.verification.details");
  const router = useRouter();

  const [declaredIdNumber, setDeclaredIdNumber] = useState(
    initial.declaredIdNumber ?? "",
  );
  const [declaredAddress, setDeclaredAddress] = useState(
    initial.declaredAddress ?? "",
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgmentError, setAcknowledgmentError] = useState<
    string | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--text-body)",
    color: "var(--color-auth-input-text)",
    backgroundColor: "var(--color-auth-input-bg)",
    border: "1.5px solid var(--color-auth-input-border)",
    borderRadius: "var(--radius-none)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--text-body)",
    fontWeight: "var(--font-medium)",
    color: "var(--color-auth-label-text)",
    marginBottom: "0.375rem",
  };

  const errorTextStyle: React.CSSProperties = {
    color: "var(--color-auth-error-text)",
    marginTop: "0.375rem",
  };

  const acknowledgmentText = verificationContent.acknowledgment.trim();
  const initialIdNumber = (initial.declaredIdNumber ?? "").trim();
  const initialAddress = (initial.declaredAddress ?? "").trim();
  const idChanged = declaredIdNumber.trim() !== initialIdNumber;
  const addressChanged = declaredAddress.trim() !== initialAddress;

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: undefined };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const nextErrors: FieldErrors = {};
    if (!declaredIdNumber.trim()) {
      nextErrors.declaredIdNumber = t("validation.idRequired");
    }
    if (!declaredAddress.trim()) {
      nextErrors.declaredAddress = t("validation.addressRequired");
    }

    const ackError =
      acknowledgmentText.length > 0 && !acknowledged
        ? t("validation.acknowledgmentRequired")
        : null;

    setFieldErrors(nextErrors);
    setAcknowledgmentError(ackError);
    if (Object.keys(nextErrors).length > 0) return;

    if (!idChanged && !addressChanged) {
      setServerError(t("validation.noChanges"));
      return;
    }

    if (ackError) return;

    setSubmitting(true);
    const fd = new FormData();
    fd.append("locale", locale);
    fd.append("acknowledged", acknowledged ? "true" : "false");
    fd.append("declaredIdNumber", declaredIdNumber.trim());
    fd.append("declaredAddress", declaredAddress.trim());

    const result = await updateVerificationDetailsAction(fd);
    if (!result.success) {
      const key = `errors.${result.errorCode}`;
      setServerError(t.has(key) ? t(key) : result.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    startNavigationProgress();
    router.replace("/account/verification");
  }

  return (
    <form
      id="verification-update-details"
      onSubmit={handleSubmit}
      noValidate
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            padding: "1rem 1.25rem",
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
            {t("messageLabel")}
          </p>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--primitive-black)",
              marginTop: "0.375rem",
              whiteSpace: "pre-line",
            }}
          >
            {message}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="verification-details-declaredIdNumber" style={labelStyle}>
              {t("fields.declaredIdNumber.label")}
            </label>
            <input
              id="verification-details-declaredIdNumber"
              type="text"
              dir="ltr"
              value={declaredIdNumber}
              onChange={(e) => {
                setDeclaredIdNumber(e.target.value.slice(0, 50));
                clearFieldError("declaredIdNumber");
              }}
              disabled={submitting}
              maxLength={50}
              style={{
                ...inputStyle,
                fontFamily: "var(--font-mono)",
                border: fieldErrors.declaredIdNumber
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.declaredIdNumber && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.declaredIdNumber}
              </p>
            )}
            {idChanged && (
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.375rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {t("previousValue", { value: initialIdNumber })}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="verification-details-declaredAddress" style={labelStyle}>
              {t("fields.declaredAddress.label")}
            </label>
            <input
              id="verification-details-declaredAddress"
              type="text"
              value={declaredAddress}
              onChange={(e) => {
                setDeclaredAddress(e.target.value.slice(0, 200));
                clearFieldError("declaredAddress");
              }}
              disabled={submitting}
              maxLength={200}
              style={{
                ...inputStyle,
                border: fieldErrors.declaredAddress
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.declaredAddress && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.declaredAddress}
              </p>
            )}
            {addressChanged && (
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.375rem",
                }}
              >
                {t("previousValue", { value: initialAddress })}
              </p>
            )}
          </div>
        </div>

        {acknowledgmentText && (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
              padding: "1rem",
            }}
          >
            <p
              className="text-body-sm"
              style={{
                fontWeight: "var(--font-semibold)",
                color: "var(--color-auth-label-text)",
              }}
            >
              {t("acknowledgment.heading")}
            </p>
            <div style={{ marginTop: "0.375rem" }}>
              <InstructionText
                text={verificationContent.acknowledgment}
                color="var(--color-auth-label-text)"
                weight={500}
              />
            </div>
            <label
              htmlFor="verification-details-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="verification-details-acknowledged"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => {
                  setAcknowledged(e.target.checked);
                  if (e.target.checked) setAcknowledgmentError(null);
                }}
                disabled={submitting}
                style={{
                  marginTop: "0.2rem",
                  flexShrink: 0,
                  accentColor: "var(--color-action-primary)",
                }}
              />
              <span
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-auth-label-text)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {t("acknowledgment.consentLabel")}
              </span>
            </label>
            {acknowledgmentError && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {acknowledgmentError}
              </p>
            )}
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="text-body-sm"
            style={{
              backgroundColor: "var(--color-auth-error-bg)",
              border: "1px solid var(--color-auth-error-border)",
              color: "var(--color-auth-error-text)",
              padding: "0.75rem 1rem",
            }}
          >
            {serverError}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={submitting}
        >
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
