"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import FileUploadField from "@/components/auth/FileUploadField";
import { updateB2BDetailsAction } from "@/lib/actions/document-request";
import { MAX_FILE_SIZE_BYTES } from "@/lib/validations/b2b";
import type { SettingValue } from "@/lib/settings/keys";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

type B2BContent = SettingValue<"b2b_content">["en"];

const PHONE_REGEX = /^(\+971\d{9}|0\d{9})$/;

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
  companyNameEn?: string;
  tradeLicenseNo?: string;
  contactName?: string;
  contactPhone?: string;
  licenseFile?: string;
}

interface Props {
  accountId: string;
  message: string;
  locale: "en" | "ar" | "ru";
  b2bContent: B2BContent;
  initial: {
    companyNameEn: string;
    companyNameAr: string | null;
    tradeLicenseNo: string;
    vatNumber: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
}

export default function B2BUpdateDetailsForm({
  accountId,
  message,
  locale,
  b2bContent,
  initial,
}: Props) {
  const t = useTranslations("account.b2b.details");
  const router = useRouter();

  const [companyNameEn, setCompanyNameEn] = useState(initial.companyNameEn);
  const [companyNameAr, setCompanyNameAr] = useState(
    initial.companyNameAr ?? "",
  );
  const [tradeLicenseNo, setTradeLicenseNo] = useState(initial.tradeLicenseNo);
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? "");
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(
    initial.contactPhone ?? "",
  );
  const [licenseFile, setLicenseFile] = useState<File | null>(null);

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

  const acknowledgmentText = b2bContent.acknowledgment.trim();
  const licenceChanged =
    tradeLicenseNo.trim().toLowerCase() !==
    initial.tradeLicenseNo.toLowerCase();
  const unchanged =
    companyNameEn.trim() === initial.companyNameEn.trim() &&
    companyNameAr.trim() === (initial.companyNameAr ?? "").trim() &&
    tradeLicenseNo.trim() === initial.tradeLicenseNo.trim() &&
    vatNumber.trim() === (initial.vatNumber ?? "").trim() &&
    contactName.trim() === (initial.contactName ?? "").trim() &&
    contactPhone.trim() === (initial.contactPhone ?? "").trim();

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
    if (!companyNameEn.trim()) {
      nextErrors.companyNameEn = t("validation.companyNameEnRequired");
    }
    if (!tradeLicenseNo.trim()) {
      nextErrors.tradeLicenseNo = t("validation.tradeLicenseNoRequired");
    }
    if (!contactName.trim()) {
      nextErrors.contactName = t("validation.contactNameRequired");
    }
    if (!contactPhone.trim()) {
      nextErrors.contactPhone = t("validation.contactPhoneRequired");
    } else if (!PHONE_REGEX.test(contactPhone.trim())) {
      nextErrors.contactPhone = t("validation.contactPhoneInvalid");
    }
    if (licenceChanged && !licenseFile) {
      nextErrors.licenseFile = t("validation.fileRequired");
    }

    const ackError =
      acknowledgmentText.length > 0 && !acknowledged
        ? t("validation.acknowledgmentRequired")
        : null;

    setFieldErrors(nextErrors);
    setAcknowledgmentError(ackError);
    if (Object.keys(nextErrors).length > 0) return;

    if (unchanged) {
      setServerError(t("validation.noChanges"));
      return;
    }

    if (ackError) return;

    setSubmitting(true);
    const fd = new FormData();
    fd.append("locale", locale);
    fd.append("acknowledged", acknowledged ? "true" : "false");
    fd.append("companyNameEn", companyNameEn.trim());
    fd.append("companyNameAr", companyNameAr.trim());
    fd.append("tradeLicenseNo", tradeLicenseNo.trim());
    fd.append("vatNumber", vatNumber.trim());
    fd.append("contactName", contactName.trim());
    fd.append("contactPhone", contactPhone.trim());
    if (licenseFile) fd.append("licenseFile", licenseFile);

    const result = await updateB2BDetailsAction(fd);
    if (!result.success) {
      const key = `errors.${result.errorCode}`;
      setServerError(t.has(key) ? t(key) : result.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    startNavigationProgress();
    router.replace("/account/b2b");
  }

  return (
    <form id={`b2b-update-details-${accountId}`} onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            borderInlineStart: "3px solid var(--color-shop-divider)",
            paddingInlineStart: "0.75rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            {t("consequence")}
          </p>
        </div>

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
            <label htmlFor="b2b-details-companyNameEn" style={labelStyle}>
              {t("fields.companyNameEn.label")}
            </label>
            <input
              id="b2b-details-companyNameEn"
              type="text"
              value={companyNameEn}
              onChange={(e) => {
                setCompanyNameEn(e.target.value.slice(0, 200));
                clearFieldError("companyNameEn");
              }}
              disabled={submitting}
              placeholder={t("fields.companyNameEn.placeholder")}
              maxLength={200}
              style={{
                ...inputStyle,
                border: fieldErrors.companyNameEn
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.companyNameEn && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.companyNameEn}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="b2b-details-companyNameAr" style={labelStyle}>
              {t("fields.companyNameAr.label")}{" "}
              <span
                style={{
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                ({t("fields.companyNameAr.optional")})
              </span>
            </label>
            <input
              id="b2b-details-companyNameAr"
              type="text"
              value={companyNameAr}
              onChange={(e) => setCompanyNameAr(e.target.value.slice(0, 200))}
              disabled={submitting}
              placeholder={t("fields.companyNameAr.placeholder")}
              maxLength={200}
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="b2b-details-tradeLicenseNo" style={labelStyle}>
              {t("fields.tradeLicenseNo.label")}
            </label>
            <input
              id="b2b-details-tradeLicenseNo"
              type="text"
              dir="ltr"
              value={tradeLicenseNo}
              onChange={(e) => {
                setTradeLicenseNo(e.target.value.slice(0, 100));
                clearFieldError("tradeLicenseNo");
              }}
              disabled={submitting}
              placeholder={t("fields.tradeLicenseNo.placeholder")}
              maxLength={100}
              style={{
                ...inputStyle,
                fontFamily: "var(--font-mono)",
                border: fieldErrors.tradeLicenseNo
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.tradeLicenseNo && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.tradeLicenseNo}
              </p>
            )}
            {licenceChanged && (
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-content-tertiary)",
                  marginTop: "0.375rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {t("previousValue", { value: initial.tradeLicenseNo })}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="b2b-details-vatNumber" style={labelStyle}>
              {t("fields.vatNumber.label")}{" "}
              <span
                style={{
                  color: "var(--color-content-tertiary)",
                  fontSize: "var(--text-body-sm)",
                }}
              >
                ({t("fields.vatNumber.optional")})
              </span>
            </label>
            <input
              id="b2b-details-vatNumber"
              type="text"
              dir="ltr"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value.slice(0, 100))}
              disabled={submitting}
              placeholder={t("fields.vatNumber.placeholder")}
              maxLength={100}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div>
            <label htmlFor="b2b-details-contactName" style={labelStyle}>
              {t("fields.contactName.label")}
            </label>
            <input
              id="b2b-details-contactName"
              type="text"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value.slice(0, 200));
                clearFieldError("contactName");
              }}
              disabled={submitting}
              placeholder={t("fields.contactName.placeholder")}
              maxLength={200}
              style={{
                ...inputStyle,
                border: fieldErrors.contactName
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.contactName && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.contactName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="b2b-details-contactPhone" style={labelStyle}>
              {t("fields.contactPhone.label")}
            </label>
            <input
              id="b2b-details-contactPhone"
              type="text"
              dir="ltr"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                clearFieldError("contactPhone");
              }}
              disabled={submitting}
              placeholder={t("fields.contactPhone.placeholder")}
              style={{
                ...inputStyle,
                border: fieldErrors.contactPhone
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {fieldErrors.contactPhone && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {fieldErrors.contactPhone}
              </p>
            )}
          </div>
        </div>

        {licenceChanged && (
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-shop-divider)",
              borderRadius: "0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.625rem 0.875rem",
                borderBottom: "1px solid var(--color-shop-divider)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-semibold)",
                  letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                  color: "var(--color-content-tertiary)",
                  textAlign: "start",
                }}
              >
                {t("documents.rowLabel")}
              </span>
            </div>

            <div
              style={{
                padding: "0.875rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                }}
              >
                <InstructionText text={t("documents.instruction")} />
              </div>

              <FileUploadField
                id="b2b-details-license-file"
                label={t("documents.fileLabel")}
                hint={t("documents.fileHint")}
                accept=".jpg,.jpeg,.png,.pdf"
                maxSizeBytes={MAX_FILE_SIZE_BYTES}
                required
                value={licenseFile}
                onChange={(f) => {
                  setLicenseFile(f);
                  clearFieldError("licenseFile");
                }}
                error={fieldErrors.licenseFile}
                dropOrClickLabel={t("fileUpload.dropOrClick")}
                removeLabel={t("fileUpload.remove")}
                invalidTypeError={t("fileUpload.invalidType")}
                tooLargeError={t("fileUpload.tooLarge")}
              />
            </div>
          </div>
        )}

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
                text={b2bContent.acknowledgment}
                color="var(--color-auth-label-text)"
                weight={500}
              />
            </div>
            <label
              htmlFor="b2b-details-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="b2b-details-acknowledged"
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
