"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import { updateLegalTaxAction } from "@/lib/actions/settings";

interface Props {
  initialTax: { vatRate: number; storeTrn: string };
  initialLegal: {
    legalNameEn: string;
    legalNameAr: string;
    registeredAddressEn: string;
    registeredAddressAr: string;
    tradeLicenceNo: string;
    licensingAuthority: string;
    invoiceNote: string;
  };
}

type FieldErrors = Record<string, string | undefined>;

interface TextAreaFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  hint?: string;
  dir?: "ltr" | "rtl";
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
  hint,
  dir,
}: TextAreaFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? "var(--color-auth-input-border-focus)"
    : focused
      ? "var(--color-auth-input-border-focus)"
      : "var(--color-auth-input-border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-medium)",
          color: "var(--color-auth-label-text)",
        }}
      >
        {label}
      </label>

      <textarea
        id={id}
        dir={dir}
        rows={3}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "0.625rem 0.875rem",
          fontSize: "var(--text-body)",
          color: "var(--color-auth-input-text)",
          backgroundColor: "var(--color-auth-input-bg)",
          border: `1.5px solid ${borderColor}`,
          borderRadius: "var(--radius-none)",
          outline: "none",
          resize: "vertical",
          transition: "border-color 150ms",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      {error ? (
        <p
          role="alert"
          id={`${id}-error`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function LegalTaxForm({ initialTax, initialLegal }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [vatRateInput, setVatRateInput] = useState(
    String(initialTax.vatRate * 100),
  );
  const [storeTrn, setStoreTrn] = useState(initialTax.storeTrn);
  const [legal, setLegal] = useState(initialLegal);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savedTrn = initialTax.storeTrn.trim();
  const savedTrnInvalid = savedTrn !== "" && !/^\d{15}$/.test(savedTrn);

  function setLegalField(field: keyof typeof initialLegal, value: string) {
    setLegal((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field])
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setFieldErrors({});

    const parsed = parseFloat(vatRateInput);
    const vatRate = isNaN(parsed) ? 0 : parsed / 100;

    const result = await updateLegalTaxAction({ vatRate, storeTrn, ...legal });

    if (result.success) {
      toast.success("Legal and tax details saved.");
      router.refresh();
    } else if (result.errorCode === "NO_CHANGES") {
      toast.error("Nothing changed.");
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (messages[0]) fe[field] = messages[0];
      }
      setFieldErrors(fe);
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "0",
      }}
    >
      <div style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: "0 0 0.375rem",
          }}
        >
          Legal and tax details
        </h2>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-content-tertiary)",
            margin: "0 0 1.25rem",
          }}
        >
          Printed on every tax invoice. Changes show on invoices straight away,
          including reprints.
        </p>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input
            id="legal-name-en"
            label="Legal name (English)"
            type="text"
            value={legal.legalNameEn}
            onChange={(e) => setLegalField("legalNameEn", e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.legalNameEn}
            hint="As on the trade licence."
          />

          <Input
            id="legal-name-ar"
            label="Legal name (Arabic)"
            type="text"
            dir="rtl"
            value={legal.legalNameAr}
            onChange={(e) => setLegalField("legalNameAr", e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.legalNameAr}
            hint="Arabic invoices use the English name when this is empty."
          />

          <TextAreaField
            id="registered-address-en"
            label="Registered address (English)"
            value={legal.registeredAddressEn}
            onChange={(value) => setLegalField("registeredAddressEn", value)}
            disabled={isSubmitting}
            error={fieldErrors.registeredAddressEn}
            hint="As on the trade licence. The Store Profile address is used when empty."
          />

          <TextAreaField
            id="registered-address-ar"
            label="Registered address (Arabic)"
            dir="rtl"
            value={legal.registeredAddressAr}
            onChange={(value) => setLegalField("registeredAddressAr", value)}
            disabled={isSubmitting}
            error={fieldErrors.registeredAddressAr}
          />

          <Input
            id="trade-licence-no"
            label="Trade licence number"
            type="text"
            dir="ltr"
            value={legal.tradeLicenceNo}
            onChange={(e) => setLegalField("tradeLicenceNo", e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.tradeLicenceNo}
          />

          <Input
            id="licensing-authority"
            label="Licensing authority"
            type="text"
            value={legal.licensingAuthority}
            onChange={(e) => setLegalField("licensingAuthority", e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.licensingAuthority}
            hint="For example: Dubai DET."
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Input
              id="store-trn"
              label="TRN"
              type="text"
              dir="ltr"
              value={storeTrn}
              onChange={(e) => {
                setStoreTrn(e.target.value);
                if (fieldErrors.storeTrn)
                  setFieldErrors((fe) => ({ ...fe, storeTrn: undefined }));
              }}
              disabled={isSubmitting}
              error={fieldErrors.storeTrn}
              optional="(optional)"
              hint="15 digits. Invoices are titled Tax invoice only when a TRN is saved and VAT is above 0."
            />
            {savedTrnInvalid ? (
              <p
                style={{
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                  borderRadius: "0",
                  padding: "0.75rem",
                  fontSize: "0.8125rem",
                  margin: 0,
                }}
              >
                The saved TRN isn&apos;t 15 digits, so invoices print as
                receipts until it&apos;s corrected.
              </p>
            ) : null}
          </div>

          <Input
            id="vat-rate"
            label="VAT rate (%)"
            type="text"
            dir="ltr"
            value={vatRateInput}
            onChange={(e) => {
              setVatRateInput(e.target.value);
              if (fieldErrors.vatRate)
                setFieldErrors((fe) => ({ ...fe, vatRate: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.vatRate}
            hint="Applied to all orders. UAE standard is 5%."
          />

          <div className="sm:col-span-2">
            <TextAreaField
              id="invoice-note"
              label="Invoice footer note"
              value={legal.invoiceNote}
              onChange={(value) => setLegalField("invoiceNote", value)}
              disabled={isSubmitting}
              error={fieldErrors.invoiceNote}
              hint="Printed at the foot of every invoice, as written."
            />
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-shop-divider)",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={isSubmitting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "2.5rem",
            paddingInline: "1.25rem",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
            border: "none",
            borderRadius: "0",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
