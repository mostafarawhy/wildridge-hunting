"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import FileUploadField from "@/components/auth/FileUploadField";
import UaePassInfoLink from "@/components/auth/UaePassInfoLink";
import { isUaePassEnabled } from "@/lib/env.client";
import {
  submitManualVerificationAction,
  initiateUaePassAction,
} from "@/lib/actions/verification";
import type { VerificationActionErrorCode } from "@/lib/actions/verification";
import {
  ROLE_ALLOWED_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/utils/verification-limits";
import type { SettingValue } from "@/lib/settings/keys";

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

interface ManualFormErrors {
  identity?: string;
  identityType?: string;
  proofOfAddress?: string;
  proofOfAddressType?: string;
  photo?: string;
  declaredIdNumber?: string;
  declaredAddress?: string;
}

function ManualUploadForm({
  onSuccess,
  verificationContent,
  locale,
}: {
  onSuccess: () => void;
  verificationContent?: VerificationContent;
  locale: "en" | "ar" | "ru";
}) {
  const t = useTranslations("checkout.verify");
  const tForm = useTranslations("checkout.verify.manualForm");
  const router = useRouter();

  const [identityType, setIdentityType] = useState<
    (typeof ROLE_ALLOWED_TYPES.IDENTITY)[number] | ""
  >("");
  const [identity, setIdentity] = useState<File | null>(null);
  const [proofOfAddressType, setProofOfAddressType] = useState<
    (typeof ROLE_ALLOWED_TYPES.PROOF_OF_ADDRESS)[number] | ""
  >("");
  const [proofOfAddress, setProofOfAddress] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [declaredIdNumber, setDeclaredIdNumber] = useState("");
  const [declaredAddress, setDeclaredAddress] = useState("");
  const [notes, setNotes] = useState<string>("");
  const [errors, setErrors] = useState<ManualFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function errorMessage(code: VerificationActionErrorCode): string {
    switch (code) {
      case "FILE_TOO_LARGE":
        return tForm("fileUpload.tooLarge");
      case "INVALID_FILE_TYPE":
        return tForm("fileUpload.invalidType");
      case "DEMO_UPLOADS_DISABLED":
        return t("errors.DEMO_UPLOADS_DISABLED");
      case "DUPLICATE_PENDING":
        return t("errors.alreadyUnderReview");
      case "UNAUTHENTICATED":
        return t("errors.sessionExpired");
      default:
        return t("errors.submitFailed");
    }
  }

  function validateClient(): ManualFormErrors {
    const errs: ManualFormErrors = {};
    if (!identity) errs.identity = t("errors.identityRequired");
    if (!identityType) errs.identityType = t("errors.identityTypeRequired");
    if (!proofOfAddress)
      errs.proofOfAddress = t("errors.proofOfAddressRequired");
    if (!proofOfAddressType)
      errs.proofOfAddressType = t("errors.proofOfAddressTypeRequired");
    if (!photo) errs.photo = t("errors.photoRequired");
    if (!declaredIdNumber.trim())
      errs.declaredIdNumber = t("errors.idNumberRequired");
    if (!declaredAddress.trim())
      errs.declaredAddress = t("errors.addressRequired");
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const clientErrors = validateClient();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    if (
      !identity ||
      !proofOfAddress ||
      !photo ||
      !declaredIdNumber.trim() ||
      !declaredAddress.trim()
    )
      return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("identity", identity);
      fd.append("proofOfAddress", proofOfAddress);
      fd.append("photo", photo);
      fd.append("identityType", identityType);
      fd.append("proofOfAddressType", proofOfAddressType);
      fd.append("declaredIdNumber", declaredIdNumber.trim());
      fd.append("declaredAddress", declaredAddress.trim());
      if (notes.trim()) fd.append("notes", notes.trim());
      fd.append("locale", locale);
      fd.append("acknowledged", acknowledged ? "true" : "false");

      const result = await submitManualVerificationAction(fd);
      if (!result.success) {
        setServerError(errorMessage(result.errorCode));
        return;
      }
      router.refresh();
      onSuccess();
    } catch {
      setServerError(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    fontSize: "var(--text-body)",
    color: "var(--color-auth-input-text)",
    backgroundColor: "var(--color-auth-input-bg)",
    border: "1.5px solid var(--color-auth-input-border)",
    borderRadius: "var(--radius-none)",
    outline: "none",
    resize: "vertical",
  };

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

  const generalInstructions = verificationContent?.instructions.general.trim();
  const identityInstructions =
    verificationContent?.instructions.identity.trim();
  const proofOfAddressInstructions =
    verificationContent?.instructions.proofOfAddress.trim();
  const photoInstructions = verificationContent?.instructions.photo.trim();
  const acknowledgment = verificationContent?.acknowledgment.trim();

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {generalInstructions && (
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
                color: "var(--color-status-warning)",
              }}
            >
              {tForm("instructions.heading")}
            </p>
            <InstructionText text={verificationContent!.instructions.general} />
          </div>
        )}

        <div>
          <p
            className="text-body font-semibold"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {tForm("heading")}
          </p>
          <p
            className="text-body-sm"
            style={{
              color: "var(--color-content-tertiary)",
              marginTop: "0.25rem",
            }}
          >
            {tForm("headingHint")}
          </p>
        </div>

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

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Select
            id="manual-upload-identity-type"
            label={tForm("identity.typeLabel")}
            required
            value={identityType}
            onChange={(e) => {
              setIdentityType(
                e.target.value as (typeof ROLE_ALLOWED_TYPES.IDENTITY)[number],
              );
              if (errors.identityType)
                setErrors((p) => ({ ...p, identityType: undefined }));
            }}
            disabled={submitting}
            error={errors.identityType}
          >
            <option value="">{tForm("typePlaceholder")}</option>
            {ROLE_ALLOWED_TYPES.IDENTITY.map((type) => (
              <option key={type} value={type}>
                {tForm(`documentTypes.${type}`)}
              </option>
            ))}
          </Select>

          <FileUploadField
            id="manual-upload-identity"
            label={tForm("identity.label")}
            hint={tForm("identity.hint")}
            accept=".jpg,.jpeg,.png,.pdf"
            maxSizeBytes={MAX_FILE_SIZE_BYTES}
            required
            value={identity}
            onChange={(f) => {
              setIdentity(f);
              if (errors.identity)
                setErrors((p) => ({ ...p, identity: undefined }));
            }}
            error={errors.identity}
            dropOrClickLabel={tForm("fileUpload.dropOrClick")}
            removeLabel={tForm("fileUpload.remove")}
            invalidTypeError={tForm("fileUpload.invalidType")}
            tooLargeError={tForm("fileUpload.tooLarge")}
          />

          {identityInstructions && (
            <div
              style={{
                borderInlineStart: "3px solid var(--color-shop-divider)",
                paddingInlineStart: "0.75rem",
              }}
            >
              <InstructionText
                text={verificationContent!.instructions.identity}
              />
            </div>
          )}

          <div>
            <label htmlFor="manual-upload-id-number" style={labelStyle}>
              {tForm("identity.numberLabel")}
            </label>
            <input
              id="manual-upload-id-number"
              type="text"
              value={declaredIdNumber}
              onChange={(e) => {
                setDeclaredIdNumber(e.target.value.slice(0, 50));
                if (errors.declaredIdNumber)
                  setErrors((p) => ({ ...p, declaredIdNumber: undefined }));
              }}
              disabled={submitting}
              placeholder={tForm("identity.numberPlaceholder")}
              maxLength={50}
              style={{
                ...inputStyle,
                border: errors.declaredIdNumber
                  ? "1.5px solid var(--color-auth-error-border)"
                  : inputStyle.border,
              }}
            />
            {errors.declaredIdNumber && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {errors.declaredIdNumber}
              </p>
            )}
          </div>
        </div>

        <Divider />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Select
            id="manual-upload-proof-of-address-type"
            label={tForm("proofOfAddress.typeLabel")}
            required
            value={proofOfAddressType}
            onChange={(e) => {
              setProofOfAddressType(
                e.target
                  .value as (typeof ROLE_ALLOWED_TYPES.PROOF_OF_ADDRESS)[number],
              );
              if (errors.proofOfAddressType)
                setErrors((p) => ({ ...p, proofOfAddressType: undefined }));
            }}
            disabled={submitting}
            error={errors.proofOfAddressType}
          >
            <option value="">{tForm("typePlaceholder")}</option>
            {ROLE_ALLOWED_TYPES.PROOF_OF_ADDRESS.map((type) => (
              <option key={type} value={type}>
                {tForm(`documentTypes.${type}`)}
              </option>
            ))}
          </Select>

          <FileUploadField
            id="manual-upload-proof-of-address"
            label={tForm("proofOfAddress.label")}
            hint={tForm("proofOfAddress.hint")}
            accept=".jpg,.jpeg,.png,.pdf"
            maxSizeBytes={MAX_FILE_SIZE_BYTES}
            required
            value={proofOfAddress}
            onChange={(f) => {
              setProofOfAddress(f);
              if (errors.proofOfAddress)
                setErrors((p) => ({ ...p, proofOfAddress: undefined }));
            }}
            error={errors.proofOfAddress}
            dropOrClickLabel={tForm("fileUpload.dropOrClick")}
            removeLabel={tForm("fileUpload.remove")}
            invalidTypeError={tForm("fileUpload.invalidType")}
            tooLargeError={tForm("fileUpload.tooLarge")}
          />

          {proofOfAddressInstructions && (
            <div
              style={{
                borderInlineStart: "3px solid var(--color-shop-divider)",
                paddingInlineStart: "0.75rem",
              }}
            >
              <InstructionText
                text={verificationContent!.instructions.proofOfAddress}
              />
            </div>
          )}

          <div>
            <label htmlFor="manual-upload-address" style={labelStyle}>
              {tForm("proofOfAddress.addressLabel")}
            </label>
            <textarea
              id="manual-upload-address"
              value={declaredAddress}
              onChange={(e) => {
                setDeclaredAddress(e.target.value.slice(0, 200));
                if (errors.declaredAddress)
                  setErrors((p) => ({ ...p, declaredAddress: undefined }));
              }}
              disabled={submitting}
              placeholder={tForm("proofOfAddress.addressPlaceholder")}
              rows={2}
              maxLength={200}
              style={{
                ...textareaStyle,
                border: errors.declaredAddress
                  ? "1.5px solid var(--color-auth-error-border)"
                  : textareaStyle.border,
              }}
            />
            {errors.declaredAddress && (
              <p role="alert" className="text-body-sm" style={errorTextStyle}>
                {errors.declaredAddress}
              </p>
            )}
          </div>
        </div>

        <Divider />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <FileUploadField
            id="manual-upload-photo"
            label={tForm("photo.label")}
            hint={tForm("photo.hint")}
            accept=".jpg,.jpeg,.png"
            maxSizeBytes={MAX_FILE_SIZE_BYTES}
            required
            value={photo}
            onChange={(f) => {
              setPhoto(f);
              if (errors.photo) setErrors((p) => ({ ...p, photo: undefined }));
            }}
            error={errors.photo}
            dropOrClickLabel={tForm("fileUpload.dropOrClick")}
            removeLabel={tForm("fileUpload.remove")}
            invalidTypeError={tForm("fileUpload.invalidType")}
            tooLargeError={tForm("fileUpload.tooLarge")}
          />

          {photoInstructions && (
            <div
              style={{
                borderInlineStart: "3px solid var(--color-shop-divider)",
                paddingInlineStart: "0.75rem",
              }}
            >
              <InstructionText text={verificationContent!.instructions.photo} />
            </div>
          )}
        </div>

        <Divider />

        <div>
          <label
            htmlFor="manual-upload-notes"
            style={{
              display: "block",
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
              marginBottom: "0.375rem",
            }}
          >
            {tForm("notesLabel")}
          </label>
          <textarea
            id="manual-upload-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            disabled={submitting}
            placeholder={tForm("notesPlaceholder")}
            rows={3}
            style={textareaStyle}
          />
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              marginTop: "0.25rem",
              textAlign: "end",
            }}
          >
            {tForm("notesCharCount", { count: notes.length })}
          </p>
        </div>

        {acknowledgment && (
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
              {tForm("acknowledgment.heading")}
            </p>
            <div style={{ marginTop: "0.375rem" }}>
              <InstructionText
                text={verificationContent!.acknowledgment}
                color="var(--color-auth-label-text)"
                weight={500}
              />
            </div>
            <label
              htmlFor="manual-upload-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="manual-upload-acknowledged"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
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
                {tForm("acknowledgment.consentLabel")}
              </span>
            </label>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={submitting || (!!acknowledgment && !acknowledged)}
        >
          {submitting ? tForm("uploading") : tForm("submit")}
        </Button>
      </div>
    </form>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: "1px",
        backgroundColor: "var(--color-auth-divider)",
        marginTop: "0.25rem",
        marginBottom: "0.25rem",
      }}
    />
  );
}

export default function MethodSelector({
  locale,
  variant,
  verificationContent,
}: {
  locale: "en" | "ar" | "ru";
  variant: "checkout" | "account";
  verificationContent?: VerificationContent;
}) {
  const t = useTranslations("checkout.verify.methodSelector");
  const enabled = isUaePassEnabled();
  const [showManual, setShowManual] = useState(false);
  const [uaePassLoading, setUaePassLoading] = useState(false);
  const [uaePassError, setUaePassError] = useState<string | null>(null);
  const [uaePassHover, setUaePassHover] = useState(false);

  async function handleUaePass() {
    setUaePassLoading(true);
    setUaePassError(null);
    try {
      const callbackPath =
        variant === "checkout" ? "/checkout" : "/account/verification";
      const result = await initiateUaePassAction({ locale, callbackPath });
      if (!result.success) {
        setUaePassError(t("errors.generic"));
        setUaePassLoading(false);
        return;
      }
      window.location.href = result.data.redirectUrl;
    } catch {
      setUaePassError(t("errors.generic"));
      setUaePassLoading(false);
    }
  }

  const cardBase: React.CSSProperties = {
    border: "1px solid var(--color-shop-divider)",
    borderRadius: "var(--radius-none)",
    padding: "1.25rem",
    cursor: "pointer",
    backgroundColor: "#fff",
    textAlign: "start",
    transition: "border-color var(--duration-base) var(--ease-out)",
    width: "100%",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p
          style={{
            fontSize: "var(--text-ui)",
            fontWeight: "var(--font-semibold)",
            color: "var(--primitive-black)",
            marginBottom: "0.25rem",
          }}
        >
          {t("title")}
        </p>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
          }}
        >
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* UAE Pass card */}
        {enabled ? (
          <div
            style={{
              ...cardBase,
              flex: 1,
              cursor: "default",
              opacity: uaePassLoading ? 0.7 : 1,
              borderColor: uaePassHover
                ? "var(--color-action-primary)"
                : "var(--color-shop-divider)",
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
            }}
          >
            <button
              type="button"
              onClick={handleUaePass}
              disabled={uaePassLoading}
              onMouseEnter={() => setUaePassHover(true)}
              onMouseLeave={() => setUaePassHover(false)}
              onFocus={() => setUaePassHover(true)}
              onBlur={() => setUaePassHover(false)}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                background: "none",
                padding: 0,
                textAlign: "start",
                cursor: uaePassLoading ? "not-allowed" : "pointer",
              }}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-bold)",
                      color: "var(--primitive-white)",
                      backgroundColor: "var(--color-action-primary)",
                      padding: "1px 7px",
                      borderRadius: "var(--radius-none)",
                      letterSpacing: "var(--tracking-wide)",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("uaePass.badge")}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--primitive-black)",
                  }}
                >
                  {t("uaePass.title")}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-content-tertiary)",
                  }}
                >
                  {t("uaePass.subtitle")}
                </p>
                <span
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.375rem",
                    color: "var(--color-action-primary)",
                  }}
                >
                  <Image
                    src={`/uae-pass/continue-black-${locale === "ar" ? "ar" : "en"}.png`}
                    alt={t("uaePass.cta")}
                    width={310}
                    height={54}
                    style={{
                      height: "44px",
                      width: "auto",
                      maxWidth: "100%",
                      objectFit: "contain",
                      minWidth: "140px",
                      minHeight: "30px",
                    }}
                  />
                </span>
              </div>
            </button>

            <UaePassInfoLink align="start" />
          </div>
        ) : null}

        {/* Manual card */}
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          style={{
            ...cardBase,
            flex: 1,
            borderColor: showManual
              ? "var(--color-action-primary)"
              : "var(--color-shop-divider)",
          }}
          onMouseEnter={(e) => {
            if (!showManual)
              e.currentTarget.style.borderColor = "var(--color-action-primary)";
          }}
          onMouseLeave={(e) => {
            if (!showManual)
              e.currentTarget.style.borderColor = "var(--color-shop-divider)";
          }}
        >
          <div className="flex flex-col gap-2">
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--primitive-black)",
              }}
            >
              {t("manual.title")}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
              }}
            >
              {t("manual.subtitle")}
            </p>
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-bold)",
                color: "var(--color-action-primary)",
                letterSpacing: "var(--tracking-wide)",
                textTransform: "uppercase",
              }}
            >
              {t("manual.cta")}
            </span>
          </div>
        </button>
      </div>

      {uaePassError && (
        <p
          style={{
            color: "var(--color-status-danger)",
            fontSize: "var(--text-body-sm)",
          }}
        >
          {uaePassError}
        </p>
      )}

      {showManual && (
        <ManualUploadForm
          onSuccess={() => setShowManual(false)}
          verificationContent={verificationContent}
          locale={locale}
        />
      )}
    </div>
  );
}
