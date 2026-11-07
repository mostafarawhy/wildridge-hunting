"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import AuthInput from "@/components/auth/AuthInput";
import FileUploadField from "@/components/auth/FileUploadField";
import DemoSamplesPanel from "@/components/auth/DemoSamplesPanel";
import { DEMO_B2B_SAMPLES, DEMO_SAMPLES_FIELD } from "@/lib/config/demo";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { submitB2BRegistrationAction } from "@/lib/actions/b2b";
import { MAX_FILE_SIZE_BYTES, MAX_B2B_FILES } from "@/lib/utils/b2b-limits";
import type { SettingValue } from "@/lib/settings/keys";
import type { DocumentType } from "@/app/generated/prisma/client";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

type ChecklistDocumentType = "TRADE_LICENSE" | "VAT_CERTIFICATE" | "COMPANY_ID";

const CHECKLIST_ORDER: ChecklistDocumentType[] = [
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "COMPANY_ID",
];

interface Props {
  locale: "en" | "ar" | "ru";
  b2bContent: SettingValue<"b2b_content">["en"];
  requiredTypes: ChecklistDocumentType[];
  recommendedTypes: ChecklistDocumentType[];
}

interface FieldErrors {
  companyNameEn?: string;
  tradeLicenseNo?: string;
  vatNumber?: string;
  contactName?: string;
  contactPhone?: string;
}

type RegisterDocumentType = Extract<
  DocumentType,
  "TRADE_LICENSE" | "VAT_CERTIFICATE" | "COMPANY_ID" | "OTHER"
>;

const ALL_OPTIONAL_TYPES: RegisterDocumentType[] = [
  "VAT_CERTIFICATE",
  "COMPANY_ID",
  "OTHER",
];

const INSTRUCTION_KEY_BY_TYPE: Record<
  RegisterDocumentType,
  "tradeLicense" | "vatCertificate" | "companyId" | "other"
> = {
  TRADE_LICENSE: "tradeLicense",
  VAT_CERTIFICATE: "vatCertificate",
  COMPANY_ID: "companyId",
  OTHER: "other",
};

interface DocRow {
  key: string;
  type: RegisterDocumentType;
  file: File | null;
  number: string;
  label: string;
  locked: boolean;
}

interface RowErrors {
  file?: string;
  label?: string;
}

export default function B2BRegisterForm({
  locale,
  b2bContent,
  requiredTypes,
  recommendedTypes,
}: Props) {
  const t = useTranslations("auth.b2bRegister");
  const router = useRouter();

  const availableTypes = ALL_OPTIONAL_TYPES.filter(
    (type) => type === "OTHER" || !requiredTypes.includes(type),
  );
  const initialLockedTypes = CHECKLIST_ORDER.filter((type) =>
    requiredTypes.includes(type),
  );
  const initialRows: DocRow[] =
    initialLockedTypes.length === 0
      ? [
          {
            key: "1",
            type: availableTypes[0],
            file: null,
            number: "",
            label: "",
            locked: false,
          },
        ]
      : initialLockedTypes.map((type, i) => ({
          key: String(i + 1),
          type,
          file: null,
          number: "",
          label: "",
          locked: true,
        }));

  const keyCounterRef = useRef(initialRows.length + 1);
  function nextRowKey(): string {
    const key = String(keyCounterRef.current);
    keyCounterRef.current += 1;
    return key;
  }

  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyNameAr, setCompanyNameAr] = useState("");
  const [tradeLicenseNo, setTradeLicenseNo] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rows, setRows] = useState<DocRow[]>(() => initialRows);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgmentError, setAcknowledgmentError] = useState<
    string | null
  >(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useSamples, setUseSamples] = useState(false);

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

  const generalInstructions = b2bContent.instructions.general.trim();
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
          type: availableTypes[0],
          file: null,
          number: "",
          label: "",
          locked: false,
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

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const phoneRegex = /^(\+971\d{9}|0\d{9})$/;

    if (!companyNameEn.trim()) {
      errors.companyNameEn = t("validation.companyNameEnRequired");
    }
    if (!tradeLicenseNo.trim()) {
      errors.tradeLicenseNo = t("validation.tradeLicenseNoRequired");
    }
    if (requiredTypes.includes("VAT_CERTIFICATE") && !vatNumber.trim()) {
      errors.vatNumber = t("validation.vatNumberRequired");
    }
    if (!contactName.trim()) {
      errors.contactName = t("validation.contactNameRequired");
    }
    if (!contactPhone.trim()) {
      errors.contactPhone = t("validation.contactPhoneRequired");
    } else if (!phoneRegex.test(contactPhone.replace(/\s/g, ""))) {
      errors.contactPhone = t("validation.contactPhoneInvalid");
    }

    const nextRowErrors: Record<string, RowErrors> = {};
    for (const row of rows) {
      const rowErr: RowErrors = {};
      if (!useSamples && !row.file) rowErr.file = t("validation.fileRequired");
      if (row.type === "OTHER" && !row.label.trim())
        rowErr.label = t("validation.nameRequired");
      if (rowErr.file || rowErr.label) nextRowErrors[row.key] = rowErr;
    }

    const ackError =
      acknowledgmentText.length > 0 && !acknowledged
        ? t("validation.acknowledgmentRequired")
        : null;

    setFieldErrors(errors);
    setRowErrors(nextRowErrors);
    setAcknowledgmentError(ackError);
    return (
      Object.keys(errors).length === 0 &&
      Object.keys(nextRowErrors).length === 0 &&
      !ackError
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;

    const fd = new FormData();
    fd.append("companyNameEn", companyNameEn.trim());
    fd.append("companyNameAr", companyNameAr.trim());
    fd.append("tradeLicenseNo", tradeLicenseNo.trim());
    fd.append("vatNumber", vatNumber.trim());
    fd.append("contactName", contactName.trim());
    fd.append("contactPhone", contactPhone.replace(/\s/g, ""));
    fd.append("acknowledged", acknowledged ? "true" : "false");
    fd.append("locale", locale);
    fd.append("docCount", String(rows.length));
    if (useSamples) fd.append(DEMO_SAMPLES_FIELD, "true");
    rows.forEach((row, i) => {
      fd.append(`doc.${i}.type`, row.type);
      if (!useSamples && row.file) fd.append(`doc.${i}.file`, row.file);
      fd.append(`doc.${i}.number`, row.locked ? "" : row.number.trim());
      fd.append(`doc.${i}.label`, row.label.trim());
    });

    setLoading(true);
    const result = await submitB2BRegistrationAction(fd);

    if (!result.success) {
      const key = `errors.${result.errorCode}`;
      setFormError(t.has(key) ? t(key) : result.error);
      setLoading(false);
      return;
    }

    router.refresh();
    startNavigationProgress();
    router.replace("/account/b2b");
  }

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
              {t("instructions.heading")}
            </p>
            <InstructionText text={b2bContent.instructions.general} />
          </div>
        )}

        {formError && (
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
            {formError}
          </div>
        )}

        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            borderRadius: "0",
          }}
        >
          <div
            style={{
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
              {t("checklist.heading")}
            </span>
          </div>
          <div
            style={{
              padding: "1.25rem 0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {requiredTypes.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-content-inverse)",
                    margin: 0,
                  }}
                >
                  {t("checklist.required")}
                </p>
                {CHECKLIST_ORDER.filter((type) => requiredTypes.includes(type)).map((type) => (
                  <p
                    key={type}
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-inverse)",
                      margin: 0,
                      paddingInlineStart: "1rem",
                      position: "relative",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        insetInlineStart: 0,
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      ·
                    </span>
                    {t(`types.${type}`)}
                  </p>
                ))}
              </div>
            )}

            {recommendedTypes.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-content-inverse)",
                    margin: 0,
                  }}
                >
                  {t("checklist.recommended")}
                </p>
                {CHECKLIST_ORDER.filter((type) => recommendedTypes.includes(type)).map((type) => (
                  <p
                    key={type}
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-inverse)",
                      margin: 0,
                      paddingInlineStart: "1rem",
                      position: "relative",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        insetInlineStart: 0,
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      ·
                    </span>
                    {t(`types.${type}`)}
                  </p>
                ))}
              </div>
            )}

            {b2bContent.supportingDocuments.trim() && (
              <div
                style={{
                  borderInlineStart: "3px solid var(--color-shop-divider)",
                  paddingInlineStart: "0.75rem",
                }}
              >
                <InstructionText text={b2bContent.supportingDocuments} />
              </div>
            )}

            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                margin: 0,
              }}
            >
              {t("checklist.footnote")}
            </p>
          </div>
        </div>

        <SectionHeading label={t("sections.company")} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <AuthInput
            id="b2b-company-name-en"
            type="text"
            label={t("fields.companyNameEn.label")}
            placeholder={t("fields.companyNameEn.placeholder")}
            value={companyNameEn}
            onChange={(v) => {
              setCompanyNameEn(v);
              if (fieldErrors.companyNameEn)
                setFieldErrors((p) => ({ ...p, companyNameEn: undefined }));
            }}
            required
            error={fieldErrors.companyNameEn}
          />

          <AuthInput
            id="b2b-company-name-ar"
            type="text"
            label={t("fields.companyNameAr.label")}
            placeholder={t("fields.companyNameAr.placeholder")}
            value={companyNameAr}
            onChange={setCompanyNameAr}
            hint={t("fields.companyNameAr.optional")}
          />

          <AuthInput
            id="b2b-trade-license-no"
            type="text"
            label={t("fields.tradeLicenseNo.label")}
            placeholder={t("fields.tradeLicenseNo.placeholder")}
            value={tradeLicenseNo}
            onChange={(v) => {
              setTradeLicenseNo(v);
              if (fieldErrors.tradeLicenseNo)
                setFieldErrors((p) => ({ ...p, tradeLicenseNo: undefined }));
            }}
            required
            error={fieldErrors.tradeLicenseNo}
          />

          <AuthInput
            id="b2b-vat-number"
            type="text"
            label={t("fields.vatNumber.label")}
            placeholder={t("fields.vatNumber.placeholder")}
            value={vatNumber}
            onChange={(v) => {
              setVatNumber(v);
              if (fieldErrors.vatNumber)
                setFieldErrors((p) => ({ ...p, vatNumber: undefined }));
            }}
            hint={t("fields.vatNumber.optional")}
            error={fieldErrors.vatNumber}
          />
        </div>

        <Divider />
        <SectionHeading label={t("sections.documents")} />

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <DemoSamplesPanel
            attached={useSamples}
            onUse={() => {
              setUseSamples(true);
              setRowErrors((prev) =>
                Object.fromEntries(
                  Object.entries(prev).map(([key, err]) => [
                    key,
                    { ...err, file: undefined },
                  ]),
                ),
              );
            }}
            onUndo={() => setUseSamples(false)}
            disabled={loading}
          />

          {rows.map((row, index) => {
            const errors = rowErrors[row.key] ?? {};
            const instructionKey = INSTRUCTION_KEY_BY_TYPE[row.type];
            const instructions =
              b2bContent.instructions[instructionKey].trim();
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
                      textAlign: "start",
                    }}
                  >
                    {row.locked
                      ? `${rowLabel} — ${t(`types.${row.type}`)}`
                      : rowLabel}
                  </span>
                  {row.locked ? (
                    <span
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                      }}
                    >
                      {t("documents.required")}
                    </span>
                  ) : (
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
                  )}
                </div>

                <div
                  style={{
                    padding: "0.875rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {!row.locked && (
                    <Select
                      id={`b2b-register-type-${row.key}`}
                      label={t("documents.typeLabel")}
                      required
                      value={row.type}
                      onChange={(e) =>
                        updateRow(row.key, {
                          type: e.target.value as RegisterDocumentType,
                        })
                      }
                      disabled={loading}
                    >
                      {availableTypes.map((type) => (
                        <option key={type} value={type}>
                          {t(`types.${type}`)}
                        </option>
                      ))}
                    </Select>
                  )}

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
                    id={`b2b-register-file-${row.key}`}
                    sampleName={useSamples ? DEMO_B2B_SAMPLES[row.type].filename : undefined}
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
                        htmlFor={`b2b-register-name-${row.key}`}
                        style={labelStyle}
                      >
                        {t("documents.nameLabel")}
                      </label>
                      <input
                        id={`b2b-register-name-${row.key}`}
                        type="text"
                        value={row.label}
                        onChange={(e) => {
                          updateRow(row.key, {
                            label: e.target.value.slice(0, 100),
                          });
                          clearRowError(row.key, "label");
                        }}
                        disabled={loading}
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

                  {!row.locked && (
                    <div>
                      <label
                        htmlFor={`b2b-register-number-${row.key}`}
                        style={labelStyle}
                      >
                        {t("documents.numberLabel")}
                      </label>
                      <input
                        id={`b2b-register-number-${row.key}`}
                        type="text"
                        dir="ltr"
                        value={row.number}
                        onChange={(e) =>
                          updateRow(row.key, {
                            number: e.target.value.slice(0, 100),
                          })
                        }
                        disabled={loading}
                        placeholder={t("documents.numberPlaceholder")}
                        maxLength={100}
                        style={{
                          ...inputStyle,
                          fontFamily: "var(--font-mono)",
                        }}
                      />
                    </div>
                  )}
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
              disabled={loading}
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

        <Divider />
        <SectionHeading label={t("sections.contact")} />

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <AuthInput
            id="b2b-contact-name"
            type="text"
            label={t("fields.contactName.label")}
            placeholder={t("fields.contactName.placeholder")}
            value={contactName}
            onChange={(v) => {
              setContactName(v);
              if (fieldErrors.contactName)
                setFieldErrors((p) => ({ ...p, contactName: undefined }));
            }}
            required
            error={fieldErrors.contactName}
          />

          <AuthInput
            id="b2b-contact-phone"
            type="text"
            label={t("fields.contactPhone.label")}
            placeholder={t("fields.contactPhone.placeholder")}
            value={contactPhone}
            onChange={(v) => {
              setContactPhone(v);
              if (fieldErrors.contactPhone)
                setFieldErrors((p) => ({ ...p, contactPhone: undefined }));
            }}
            required
            error={fieldErrors.contactPhone}
          />
        </div>

        <Divider />

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
              htmlFor="b2b-register-acknowledged"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                marginTop: "0.75rem",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <input
                id="b2b-register-acknowledged"
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => {
                  setAcknowledged(e.target.checked);
                  if (e.target.checked) setAcknowledgmentError(null);
                }}
                disabled={loading}
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
              <p
                role="alert"
                className="text-body-sm"
                style={{
                  color: "var(--color-auth-error-text)",
                  marginTop: "0.375rem",
                }}
              >
                {acknowledgmentError}
              </p>
            )}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          {loading ? t("submitting") : t("submitButton")}
        </Button>
      </div>
    </form>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <p
      className="text-label font-bold tracking-widest uppercase"
      style={{ color: "var(--color-auth-input-placeholder)" }}
    >
      {label}
    </p>
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
