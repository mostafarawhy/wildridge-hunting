"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import FileUploadField from "@/components/auth/FileUploadField";
import { provideVerificationDocumentsAction } from "@/lib/actions/verification";
import {
  ROLE_ALLOWED_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validations/verification";
import type { VerificationDocumentRole } from "@/app/generated/prisma/enums";
import type { SettingValue } from "@/lib/settings/keys";

type VerificationContent = SettingValue<"verification_content">["en"];

interface Props {
  roles: VerificationDocumentRole[];
  locale: "en" | "ar" | "ru";
  verificationContent: VerificationContent;
}

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

const LABEL_KEY: Record<
  VerificationDocumentRole,
  "identity" | "proofOfAddress" | "photo"
> = {
  IDENTITY: "identity",
  PROOF_OF_ADDRESS: "proofOfAddress",
  PHOTO: "photo",
};

interface SlotState {
  file: File | null;
  type: string;
}

export default function ProvideVerificationDocumentsForm({
  roles,
  locale,
  verificationContent,
}: Props) {
  const t = useTranslations("checkout.verify.manualForm");
  const tp = useTranslations("account.verification.provide");
  const router = useRouter();

  const [slots, setSlots] = useState<Record<string, SlotState>>(() =>
    Object.fromEntries(
      roles.map((role) => [
        role,
        {
          file: null,
          type: role === "PHOTO" ? ROLE_ALLOWED_TYPES.PHOTO[0] : "",
        },
      ]),
    ),
  );
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgmentError, setAcknowledgmentError] = useState<string | null>(
    null,
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorTextStyle: React.CSSProperties = {
    color: "var(--color-auth-error-text)",
    marginTop: "0.375rem",
  };

  const acknowledgmentText = verificationContent.acknowledgment.trim();

  function updateSlot(role: string, patch: Partial<SlotState>) {
    setSlots((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, string> = {};
    for (const role of roles) {
      if (!slots[role]?.file) nextErrors[role] = tp("fileRequired");
    }
    const ackError =
      acknowledgmentText.length > 0 && !acknowledged
        ? tp("acknowledgmentRequired")
        : null;

    setFileErrors(nextErrors);
    setAcknowledgmentError(ackError);
    if (Object.keys(nextErrors).length > 0 || ackError) return;

    setSubmitting(true);
    const fd = new FormData();
    fd.append("locale", locale);
    fd.append("acknowledged", acknowledged ? "true" : "false");
    for (const role of roles) {
      fd.append("roles", role);
      const slot = slots[role];
      if (slot.file) fd.append(`doc.${role}.file`, slot.file);
      if (role !== "PHOTO") fd.append(`doc.${role}.type`, slot.type);
    }

    const result = await provideVerificationDocumentsAction(fd);
    if (!result.success) {
      const key = `errors.${result.errorCode}`;
      setServerError(tp.has(key) ? tp(key) : result.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-bold)",
            color: "var(--primitive-black)",
          }}
        >
          {tp("heading")}
        </p>

        {roles.map((role) => {
          const key = LABEL_KEY[role];
          const slot = slots[role];
          const allowedTypes = ROLE_ALLOWED_TYPES[role];

          return (
            <div
              key={role}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {role !== "PHOTO" && (
                <Select
                  id={`provide-documents-type-${role}`}
                  label={t(`${key}.typeLabel`)}
                  required
                  value={slot.type}
                  onChange={(e) => updateSlot(role, { type: e.target.value })}
                  disabled={submitting}
                >
                  <option value="">{t("typePlaceholder")}</option>
                  {allowedTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`documentTypes.${type}`)}
                    </option>
                  ))}
                </Select>
              )}

              {verificationContent.instructions[key].trim() && (
                <div
                  style={{
                    borderInlineStart: "3px solid var(--color-shop-divider)",
                    paddingInlineStart: "0.75rem",
                  }}
                >
                  <InstructionText text={verificationContent.instructions[key]} />
                </div>
              )}

              <FileUploadField
                id={`provide-documents-file-${role}`}
                label={t(`${key}.label`)}
                hint={t(`${key}.hint`)}
                accept={
                  role === "PHOTO" ? ".jpg,.jpeg,.png" : ".jpg,.jpeg,.png,.pdf"
                }
                maxSizeBytes={MAX_FILE_SIZE_BYTES}
                required
                value={slot.file}
                onChange={(f) => {
                  updateSlot(role, { file: f });
                  if (fileErrors[role]) {
                    setFileErrors((prev) => {
                      const next = { ...prev };
                      delete next[role];
                      return next;
                    });
                  }
                }}
                error={fileErrors[role]}
                dropOrClickLabel={t("fileUpload.dropOrClick")}
                removeLabel={t("fileUpload.remove")}
                invalidTypeError={t("fileUpload.invalidType")}
                tooLargeError={t("fileUpload.tooLarge")}
              />
            </div>
          );
        })}

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
              htmlFor="verification-provide-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="verification-provide-acknowledged"
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
          {submitting ? tp("submitting") : tp("submit")}
        </Button>
      </div>
    </form>
  );
}
