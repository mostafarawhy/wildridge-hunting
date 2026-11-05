"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import FileUploadField from "@/components/auth/FileUploadField";
import { provideB2BDocumentsAction } from "@/lib/actions/document-request";
import { MAX_FILE_SIZE_BYTES, MAX_B2B_FILES } from "@/lib/utils/b2b-limits";
import type { SettingValue } from "@/lib/settings/keys";
import type { DocumentType } from "@/app/generated/prisma/client";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

type B2BContent = SettingValue<"b2b_content">["en"];

type ProvideDocumentType = Extract<
  DocumentType,
  "TRADE_LICENSE" | "VAT_CERTIFICATE" | "COMPANY_ID" | "OTHER"
>;

const ALL_TYPES: ProvideDocumentType[] = [
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "COMPANY_ID",
  "OTHER",
];

const INSTRUCTION_KEY_BY_TYPE: Record<
  ProvideDocumentType,
  "tradeLicense" | "vatCertificate" | "companyId" | "other"
> = {
  TRADE_LICENSE: "tradeLicense",
  VAT_CERTIFICATE: "vatCertificate",
  COMPANY_ID: "companyId",
  OTHER: "other",
};

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

interface DocRow {
  key: string;
  type: ProvideDocumentType;
  file: File | null;
  number: string;
  label: string;
}

interface RowErrors {
  file?: string;
  label?: string;
}

interface Props {
  accountId: string;
  locale: "en" | "ar" | "ru";
  b2bContent: B2BContent;
  requestedTypes: DocumentType[];
}

export default function B2BProvideDocumentsForm({
  accountId,
  locale,
  b2bContent,
  requestedTypes,
}: Props) {
  const t = useTranslations("account.b2b.provide");
  const router = useRouter();

  const requestedProvideTypes = requestedTypes.filter(
    (type): type is ProvideDocumentType =>
      (ALL_TYPES as DocumentType[]).includes(type),
  );
  const hasRequestedTypes = requestedProvideTypes.length > 0;
  const typeOptions: ProvideDocumentType[] = hasRequestedTypes
    ? requestedProvideTypes
    : ALL_TYPES;

  const initialRows: DocRow[] = hasRequestedTypes
    ? typeOptions.map((type, index) => ({
        key: String(index + 1),
        type,
        file: null,
        number: "",
        label: "",
      }))
    : [
        {
          key: "1",
          type: "TRADE_LICENSE",
          file: null,
          number: "",
          label: "",
        },
      ];

  const keyCounterRef = useRef(initialRows.length + 1);
  function nextRowKey(): string {
    const key = String(keyCounterRef.current);
    keyCounterRef.current += 1;
    return key;
  }

  const [rows, setRows] = useState<DocRow[]>(() => initialRows);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgmentError, setAcknowledgmentError] = useState<string | null>(
    null,
  );
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

  function updateRow(key: string, patch: Partial<DocRow>) {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function clearRowError(key: string, field: keyof RowErrors) {
    setRowErrors((prev) => {
      if (!prev[key]?.[field]) return prev;
      const next = { ...prev, [key]: { ...prev[key], [field]: undefined } };
      return next;
    });
  }

  function addRow() {
    setRows((prev) => {
      if (prev.length >= MAX_B2B_FILES) return prev;
      return [
        ...prev,
        {
          key: nextRowKey(),
          type: typeOptions[0],
          file: null,
          number: "",
          label: "",
        },
      ];
    });
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const nextErrors: Record<string, RowErrors> = {};
    for (const row of rows) {
      const rowErr: RowErrors = {};
      if (!row.file) rowErr.file = t("validation.fileRequired");
      if (row.type === "OTHER" && !row.label.trim())
        rowErr.label = t("validation.nameRequired");
      if (rowErr.file || rowErr.label) nextErrors[row.key] = rowErr;
    }
    const ackError =
      acknowledgmentText.length > 0 && !acknowledged
        ? t("validation.acknowledgmentRequired")
        : null;

    setRowErrors(nextErrors);
    setAcknowledgmentError(ackError);
    if (Object.keys(nextErrors).length > 0 || ackError) return;

    if (hasRequestedTypes) {
      const providedTypes = new Set(rows.map((row) => row.type));
      const missingType = typeOptions.find(
        (type) => !providedTypes.has(type),
      );
      if (missingType) {
        setServerError(
          t("validation.missingType", { type: t(`types.${missingType}`) }),
        );
        return;
      }
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("docCount", String(rows.length));
    fd.append("locale", locale);
    fd.append("acknowledged", acknowledged ? "true" : "false");
    rows.forEach((row, i) => {
      fd.append(`doc.${i}.type`, row.type);
      if (row.file) fd.append(`doc.${i}.file`, row.file);
      fd.append(`doc.${i}.number`, row.number.trim());
      fd.append(`doc.${i}.label`, row.label.trim());
    });

    const result = await provideB2BDocumentsAction(fd);
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
    <form
      id={`b2b-provide-documents-${accountId}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
        >
          {rows.map((row, index) => {
            const errors = rowErrors[row.key] ?? {};
            const instructionKey = INSTRUCTION_KEY_BY_TYPE[row.type];
            const instructions = b2bContent.instructions[instructionKey].trim();
            const rowLabel = t("documents.rowLabel", { index: index + 1 });

            return (
              <div
                key={row.key}
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
                      fontFamily: "var(--font-mono)",
                      textAlign: "start",
                    }}
                  >
                    {rowLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="text-body-sm hover:opacity-70 transition-opacity"
                    style={{
                      color: "var(--color-content-tertiary)",
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {t("documents.remove", { index: index + 1 })}
                  </button>
                </div>

                <div
                  style={{
                    padding: "0.875rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <Select
                    id={`b2b-provide-type-${row.key}`}
                    label={t("documents.typeLabel")}
                    required
                    value={row.type}
                    onChange={(e) =>
                      updateRow(row.key, {
                        type: e.target.value as ProvideDocumentType,
                      })
                    }
                    disabled={submitting}
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {t(`types.${type}`)}
                      </option>
                    ))}
                  </Select>

                  {instructions && (
                    <div
                      style={{
                        borderInlineStart: "3px solid var(--color-shop-divider)",
                        paddingInlineStart: "0.75rem",
                      }}
                    >
                      <InstructionText
                        text={b2bContent.instructions[instructionKey]}
                      />
                    </div>
                  )}

                  <FileUploadField
                    id={`b2b-provide-file-${row.key}`}
                    label={t("documents.fileLabel")}
                    hint={t("documents.fileHint")}
                    accept=".jpg,.jpeg,.png,.pdf"
                    maxSizeBytes={MAX_FILE_SIZE_BYTES}
                    required
                    value={row.file}
                    onChange={(f) => {
                      updateRow(row.key, { file: f });
                      clearRowError(row.key, "file");
                    }}
                    error={errors.file}
                    dropOrClickLabel={t("fileUpload.dropOrClick")}
                    removeLabel={t("fileUpload.remove")}
                    invalidTypeError={t("fileUpload.invalidType")}
                    tooLargeError={t("fileUpload.tooLarge")}
                  />

                  {row.type === "OTHER" && (
                    <div>
                      <label
                        htmlFor={`b2b-provide-name-${row.key}`}
                        style={labelStyle}
                      >
                        {t("documents.nameLabel")}
                      </label>
                      <input
                        id={`b2b-provide-name-${row.key}`}
                        type="text"
                        value={row.label}
                        onChange={(e) => {
                          updateRow(row.key, {
                            label: e.target.value.slice(0, 100),
                          });
                          clearRowError(row.key, "label");
                        }}
                        disabled={submitting}
                        placeholder={t("documents.namePlaceholder")}
                        maxLength={100}
                        style={{
                          ...inputStyle,
                          border: errors.label
                            ? "1.5px solid var(--color-auth-error-border)"
                            : inputStyle.border,
                        }}
                      />
                      {errors.label && (
                        <p
                          role="alert"
                          className="text-body-sm"
                          style={errorTextStyle}
                        >
                          {errors.label}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`b2b-provide-number-${row.key}`}
                      style={labelStyle}
                    >
                      {t("documents.numberLabel")}
                    </label>
                    <input
                      id={`b2b-provide-number-${row.key}`}
                      type="text"
                      dir="ltr"
                      value={row.number}
                      onChange={(e) =>
                        updateRow(row.key, {
                          number: e.target.value.slice(0, 100),
                        })
                      }
                      disabled={submitting}
                      placeholder={t("documents.numberPlaceholder")}
                      maxLength={100}
                      style={{
                        ...inputStyle,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          {rows.length < MAX_B2B_FILES && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={addRow}
              disabled={submitting}
            >
              {t("documents.add")}
            </Button>
          )}
          <span
            className="text-body-sm"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {t("documents.count", { used: rows.length, max: MAX_B2B_FILES })}
          </span>
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
                text={b2bContent.acknowledgment}
                color="var(--color-auth-label-text)"
                weight={500}
              />
            </div>
            <label
              htmlFor="b2b-provide-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="b2b-provide-acknowledged"
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
