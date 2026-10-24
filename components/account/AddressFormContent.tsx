"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { getSubdivisions, getSubdivisionLabelKey } from "@/lib/data/subdivisions";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import type { CheckoutAddressInput } from "@/lib/validations/checkout";
import { isValidPhoneNumber, type CountryCode } from "libphonenumber-js";

export interface AddressFormContentResult {
  fieldErrors?: Record<string, string[]>;
  formErrorKey?: string;
}

interface Props {
  mode: "add" | "edit";
  initial?: CustomerAddressProjection;
  serviceableCountries: { code: string; name: string }[];
  onSubmit: (
    values: CheckoutAddressInput,
  ) => Promise<AddressFormContentResult | void>;
  isSubmitting: boolean;
  onClose: () => void;
}

function mapFirst(fe: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]]));
}

function buildInitialState(
  initial: CustomerAddressProjection | undefined,
  serviceableCountries: { code: string; name: string }[],
) {
  return {
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? "",
    emirate: initial?.emirate ?? "",
    postalCode: initial?.postalCode ?? "",
    label: initial?.label ?? "",
    country:
      initial?.country ??
      (serviceableCountries.length === 1 ? serviceableCountries[0].code : ""),
  };
}

export default function AddressFormContent({
  mode,
  initial,
  serviceableCountries,
  onSubmit,
  isSubmitting,
  onClose,
}: Props) {
  const t = useTranslations("account.addresses");
  const tErr = useTranslations();
  const [fields, setFields] = useState(() =>
    buildInitialState(initial, serviceableCountries),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const FE = "checkout.billing.fieldErrors";

  const subs = getSubdivisions(fields.country);
  const subLabelKey = getSubdivisionLabelKey(fields.country);

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validateField(name: string, value: string) {
    setErrors((prev) => {
      const next = { ...prev };
      switch (name) {
        case "fullName":
          if (value.length < 2) next.fullName = `${FE}.fullNameShort`;
          else if (value.length > 100) next.fullName = `${FE}.fullNameLong`;
          else delete next.fullName;
          break;
        case "country":
          if (!value) next.country = `${FE}.countryInvalid`;
          else delete next.country;
          break;
        case "phone":
          if (!value) next.phone = `${FE}.phoneRequired`;
          else if (!isValidPhoneNumber(value, fields.country as CountryCode))
            next.phone = `${FE}.phoneInvalid`;
          else delete next.phone;
          break;
        case "addressLine1":
          if (value.length < 5) next.addressLine1 = `${FE}.line1Short`;
          else if (value.length > 200) next.addressLine1 = `${FE}.line1Long`;
          else delete next.addressLine1;
          break;
        case "addressLine2":
          if (value.length > 200) next.addressLine2 = `${FE}.line2Long`;
          else delete next.addressLine2;
          break;
        case "city":
          if (value.length < 2) next.city = `${FE}.cityShort`;
          else if (value.length > 60) next.city = `${FE}.cityLong`;
          else delete next.city;
          break;
        case "emirate":
          if (!value) next.emirate = `${FE}.subdivisionRequired`;
          else if (subs && !subs.includes(value))
            next.emirate = `${FE}.subdivisionInvalid`;
          else delete next.emirate;
          break;
        case "postalCode":
          if (value.length > 20) next.postalCode = `${FE}.postalLong`;
          else delete next.postalCode;
          break;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await onSubmit({
      fullName: fields.fullName,
      phone: fields.phone,
      addressLine1: fields.addressLine1,
      addressLine2: fields.addressLine2 || undefined,
      city: fields.city,
      emirate: fields.emirate as CheckoutAddressInput["emirate"],
      postalCode: fields.postalCode || undefined,
      country: fields.country,
      label: fields.label || undefined,
      saveToProfile: true,
    });
    if (res?.fieldErrors) {
      setErrors(mapFirst(res.fieldErrors));
    } else if (res?.formErrorKey) {
      setFormError(tErr(res.formErrorKey as never));
    }
  }

  const title = mode === "add" ? t("addTitle") : t("editTitle");

  return (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <h2
        style={{
          fontSize: "var(--text-body-lg)",
          fontWeight: "var(--font-bold)",
          color: "var(--color-auth-label-text)",
          paddingInlineEnd: "2rem",
          margin: 0,
        }}
      >
        {title}
      </h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <Input
          id="addr-fullName"
          label={t("fullName")}
          value={fields.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          onBlur={(e) => validateField("fullName", e.target.value)}
          error={errors.fullName ? tErr(errors.fullName as never) : undefined}
          required
          autoComplete="name"
        />

        <Input
          id="addr-phone"
          label={t("phone")}
          value={fields.phone}
          onChange={(e) => set("phone", e.target.value)}
          onBlur={(e) => validateField("phone", e.target.value)}
          error={errors.phone ? tErr(errors.phone as never) : undefined}
          required
          type="tel"
          autoComplete="tel"
          dir="ltr"
        />

        <Input
          id="addr-line1"
          label={t("line1")}
          value={fields.addressLine1}
          onChange={(e) => set("addressLine1", e.target.value)}
          onBlur={(e) => validateField("addressLine1", e.target.value)}
          error={
            errors.addressLine1 ? tErr(errors.addressLine1 as never) : undefined
          }
          required
          autoComplete="address-line1"
        />

        <Input
          id="addr-line2"
          label={t("line2")}
          value={fields.addressLine2}
          onChange={(e) => set("addressLine2", e.target.value)}
          onBlur={(e) => validateField("addressLine2", e.target.value)}
          error={
            errors.addressLine2 ? tErr(errors.addressLine2 as never) : undefined
          }
          optional={t("optional")}
          autoComplete="address-line2"
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
          }}
        >
          <Input
            id="addr-city"
            label={t("city")}
            value={fields.city}
            onChange={(e) => set("city", e.target.value)}
            onBlur={(e) => validateField("city", e.target.value)}
            error={errors.city ? tErr(errors.city as never) : undefined}
            required
            autoComplete="address-level2"
          />
          <Input
            id="addr-postalCode"
            label={t("postalCode")}
            value={fields.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            onBlur={(e) => validateField("postalCode", e.target.value)}
            error={
              errors.postalCode ? tErr(errors.postalCode as never) : undefined
            }
            optional={t("optional")}
            autoComplete="postal-code"
            dir="ltr"
          />
        </div>

        <Select
          id="addr-country"
          label={t("country")}
          value={fields.country}
          onChange={(e) => {
            const v = e.target.value;
            setFields((prev) => ({ ...prev, country: v, emirate: "" }));
            setErrors((prev) => {
              const next = { ...prev };
              delete next.country;
              delete next.emirate;
              return next;
            });
          }}
          onBlur={(e) => validateField("country", e.target.value)}
          error={errors.country ? tErr(errors.country as never) : undefined}
          required
        >
          <option value="" disabled>
            {t("countryPlaceholder")}
          </option>
          {serviceableCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>

        {subs !== null ? (
          <Select
            id="addr-emirate"
            label={tErr(subLabelKey as never)}
            value={fields.emirate}
            onChange={(e) => set("emirate", e.target.value)}
            onBlur={(e) => validateField("emirate", e.target.value)}
            error={errors.emirate ? tErr(errors.emirate as never) : undefined}
            required
          >
            <option value="" disabled>
              {tErr("checkout.billing.subdivisionPlaceholder" as never)}
            </option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="addr-emirate"
            label={tErr(subLabelKey as never)}
            value={fields.emirate}
            onChange={(e) => set("emirate", e.target.value)}
            onBlur={(e) => validateField("emirate", e.target.value)}
            error={errors.emirate ? tErr(errors.emirate as never) : undefined}
            required
          />
        )}

        <Input
          id="addr-label"
          label={t("label")}
          value={fields.label}
          onChange={(e) => set("label", e.target.value)}
          optional={t("optional")}
          hint={t("labelHint")}
        />

        {formError && (
          <p
            role="alert"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
              margin: 0,
            }}
          >
            {formError}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.25rem" }}>
          <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
            {isSubmitting ? t("saving") : t("save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
