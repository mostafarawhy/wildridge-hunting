"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FloatingInput,
  FloatingPhone,
  FloatingSelect,
  SectionHeading,
} from "./FormPrimitives";
import { useCheckoutForm } from "@/app/[locale]/checkout/CheckoutFormContext";
import {
  addAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/actions/address";
import type { CheckoutAddressProjection } from "@/lib/db/queries/checkout";
import type { CheckoutAddressInput } from "@/lib/validations/checkout";
import type { AddressActionErrorCode } from "@/lib/actions/address";
import { getCountryName } from "@/lib/data/countries";
import { getSubdivisions, getSubdivisionLabelKey } from "@/lib/data/subdivisions";
import {
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberWithError,
  type CountryCode,
} from "libphonenumber-js";

interface BillingDetailsSectionProps {
  addresses: CheckoutAddressProjection[];
  defaultAddressId: string | null;
  serviceableCountries: { code: string; name: string }[];
}

type Mode = "card" | "picker" | "new-form" | "edit-form";
type SubmitResult = { fieldErrors?: Record<string, string[]>; formErrorKey?: string };

function mapFirst(fe: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]]));
}

/* ─────────────────────────────────────────────────────────────────────────
 * AddressCard
 * ─────────────────────────────────────────────────────────────────────── */

function AddressCard({
  address,
  onChange,
  onAddNew,
}: {
  address: CheckoutAddressProjection;
  onChange: () => void;
  onAddNew: () => void;
}) {
  const t = useTranslations("checkout.billing");

  return (
    <div>
      <div className="relative border border-neutral-300 bg-white px-5 py-5">
        <span
          className="absolute top-5 end-5 inline-flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-neutral-500"
          aria-label="Default address"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900">
            <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {t("defaultBadge")}
        </span>

        <p className="text-[0.9375rem] font-semibold text-neutral-900 mb-2 pe-24">
          {address.fullName}
        </p>
        <address className="not-italic text-[0.8125rem] text-neutral-600 leading-7">
          <span>{address.addressLine1}</span>
          {address.addressLine2 && <span>, {address.addressLine2}</span>}
          <br />
          <span>
            {address.city}, {address.emirate}
            {address.postalCode && ` ${address.postalCode}`}
          </span>
          <br />
          <span>{getCountryName(address.country)}</span>
          <br />
          <span dir="ltr" className="inline-block tabular-nums">
            {address.phone}
          </span>
        </address>
      </div>

      <div className="flex gap-6 mt-4">
        <button
          type="button"
          onClick={onChange}
          className="text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] hover:text-neutral-900 transition-colors"
        >
          {t("change")}
        </button>
        <button
          type="button"
          onClick={onAddNew}
          className="text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] hover:text-neutral-900 transition-colors"
        >
          + {t("addNew")}
        </button>
      </div>

      <p className="text-[0.75rem] text-neutral-500 mt-3">
        {t("invoiceNote")}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * AddressPicker
 * ─────────────────────────────────────────────────────────────────────── */

function AddressPicker({
  addresses,
  initialSelectedId,
  onConfirm,
  onCancel,
  onAddNew,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  addresses: CheckoutAddressProjection[];
  initialSelectedId: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
  onAddNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  const t = useTranslations("checkout.billing");
  const [selected, setSelected] = useState(initialSelectedId);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDeleteClick(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    setActionError(null);
    const result = await deleteAddressAction(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!result.success) {
      setActionError(t(`errors.${result.errorCode as AddressActionErrorCode}`));
      return;
    }
    onDelete(id);
  }

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    setActionError(null);
    const result = await setDefaultAddressAction(id);
    setSettingDefaultId(null);
    if (!result.success) {
      setActionError(t(`errors.${result.errorCode as AddressActionErrorCode}`));
      return;
    }
    onSetDefault(id);
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.map((addr) => {
        const isActive = selected === addr.id;
        return (
          <div key={addr.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => setSelected(addr.id)}
              className={
                "text-start px-5 py-4 border bg-white flex items-start gap-3 transition-colors " +
                (isActive
                  ? "border-[var(--color-action-primary)]"
                  : "border-neutral-200 hover:border-neutral-400")
              }
            >
              <span
                className={
                  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors " +
                  (isActive ? "border-[var(--color-action-primary)]" : "border-neutral-300")
                }
              >
                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-action-primary)]" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[0.9375rem] font-semibold text-neutral-900">
                    {addr.fullName}
                  </p>
                  {addr.isDefault && (
                    <span className="text-[0.5625rem] font-bold tracking-[0.12em] uppercase text-neutral-500">
                      {t("defaultBadge")}
                    </span>
                  )}
                </div>
                <p className="text-[0.8125rem] text-neutral-600 leading-snug">
                  {addr.addressLine1}
                  {addr.addressLine2 && `, ${addr.addressLine2}`}
                  {" · "}
                  {addr.city}, {addr.emirate}
                </p>
              </div>
            </button>

            {isActive && (
              <div className="flex items-center gap-4 px-5 py-2.5 border border-t-0 border-[var(--color-action-primary)] bg-neutral-50">
                <button
                  type="button"
                  onClick={() => onEdit(addr.id)}
                  className="text-[0.75rem] text-neutral-700 underline underline-offset-[3px] hover:text-neutral-900 transition-colors"
                >
                  {t("editAddress")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(addr.id)}
                  disabled={deletingId === addr.id}
                  className="text-[0.75rem] text-neutral-700 underline underline-offset-[3px] hover:text-[var(--color-error)] transition-colors disabled:opacity-50"
                >
                  {deletingId === addr.id
                    ? t("deleting")
                    : confirmDeleteId === addr.id
                      ? t("confirmDelete")
                      : t("deleteAddress")}
                </button>
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    disabled={settingDefaultId === addr.id}
                    className="text-[0.75rem] text-neutral-700 underline underline-offset-[3px] hover:text-neutral-900 transition-colors disabled:opacity-50 ms-auto"
                  >
                    {settingDefaultId === addr.id
                      ? t("saving")
                      : t("setAsDefault")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {actionError && (
        <p className="text-[0.75rem] text-[var(--color-status-danger-text)]">
          {actionError}
        </p>
      )}

      <button
        type="button"
        onClick={onAddNew}
        className="self-start text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] hover:text-neutral-900 transition-colors mt-1"
      >
        + {t("addNew")}
      </button>

      <div className="flex gap-3 mt-3">
        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="h-12 px-8 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] transition-colors hover:bg-[var(--color-action-secondary-hover-bg)]"
        >
          {t("useThis")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-12 px-4 bg-transparent text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] transition-colors hover:text-neutral-900"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * AddressForm — controlled, used for both new and edit
 * ─────────────────────────────────────────────────────────────────────── */

interface AddressFormProps {
  initialValues?: Partial<CheckoutAddressInput> & { id?: string };
  serviceableCountries: { code: string; name: string }[];
  onSubmit: (values: CheckoutAddressInput) => Promise<SubmitResult | void>;
  onCancel?: () => void;
  isSubmitting: boolean;
}

function AddressForm({
  initialValues,
  serviceableCountries,
  onSubmit,
  onCancel,
  isSubmitting,
}: AddressFormProps) {
  const t = useTranslations("checkout.billing");
  const tErr = useTranslations();

  const [fields, setFields] = useState({
    fullName: initialValues?.fullName ?? "",
    phone: initialValues?.phone
      ? (() => {
          try {
            return parsePhoneNumberWithError(
              initialValues.phone!,
              initialValues.country as CountryCode,
            ).nationalNumber as string;
          } catch {
            return initialValues.phone!;
          }
        })()
      : "",
    addressLine1: initialValues?.addressLine1 ?? "",
    addressLine2: initialValues?.addressLine2 ?? "",
    city: initialValues?.city ?? "",
    emirate: initialValues?.emirate ?? "",
    postalCode: initialValues?.postalCode ?? "",
    country:
      initialValues?.country ??
      (serviceableCountries.length === 1 ? serviceableCountries[0].code : ""),
    label: initialValues?.label ?? "",
    saveToProfile: true as boolean,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function set(key: keyof typeof fields, value: string | boolean) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const FE = "checkout.billing.fieldErrors";

  const dialCode = (() => {
    try {
      return `+${getCountryCallingCode(fields.country as CountryCode)}`;
    } catch {
      return "";
    }
  })();

  const subs = getSubdivisions(fields.country);
  const subLabelKey = getSubdivisionLabelKey(fields.country);

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
        case "label":
          if (value.length > 40) next.label = `${FE}.labelLong`;
          else delete next.label;
          break;
      }
      return next;
    });
  }

  async function handleSubmit() {
    const res = await onSubmit({
      fullName: fields.fullName,
      phone: fields.phone,
      addressLine1: fields.addressLine1,
      addressLine2: fields.addressLine2 || undefined,
      city: fields.city,
      emirate: fields.emirate,
      postalCode: fields.postalCode || undefined,
      country: fields.country,
      label: fields.label || undefined,
      saveToProfile: true,
    });
    if (res?.fieldErrors) {
      setErrors(mapFirst(res.fieldErrors));
    } else if (res?.formErrorKey) {
      setFormError(t(res.formErrorKey as never));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FloatingInput
        label={t("fullName")}
        required
        type="text"
        autoComplete="name"
        value={fields.fullName}
        onChange={(e) => set("fullName", e.target.value)}
        onBlur={(e) => validateField("fullName", e.target.value)}
        error={errors.fullName ? tErr(errors.fullName as never) : undefined}
      />

      <FloatingSelect
        label={t("country")}
        required
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
      >
        <option value="" disabled>
          {t("countryPlaceholder")}
        </option>
        {serviceableCountries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </FloatingSelect>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FloatingPhone
          label={t("phone")}
          required
          dialCode={dialCode}
          value={fields.phone}
          onChange={(e) => set("phone", e.target.value)}
          onBlur={(e) => validateField("phone", e.target.value)}
          error={errors.phone ? tErr(errors.phone as never) : undefined}
        />
        {subs !== null ? (
          <FloatingSelect
            label={tErr(subLabelKey as never)}
            required
            value={fields.emirate}
            onChange={(e) => set("emirate", e.target.value)}
            onBlur={(e) => validateField("emirate", e.target.value)}
            error={errors.emirate ? tErr(errors.emirate as never) : undefined}
          >
            <option value="" disabled>
              {t("subdivisionPlaceholder")}
            </option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FloatingSelect>
        ) : (
          <FloatingInput
            label={tErr(subLabelKey as never)}
            required
            type="text"
            value={fields.emirate}
            onChange={(e) => set("emirate", e.target.value)}
            onBlur={(e) => validateField("emirate", e.target.value)}
            error={errors.emirate ? tErr(errors.emirate as never) : undefined}
          />
        )}
      </div>

      <FloatingInput
        label={t("line1")}
        required
        type="text"
        autoComplete="address-line1"
        value={fields.addressLine1}
        onChange={(e) => set("addressLine1", e.target.value)}
        onBlur={(e) => validateField("addressLine1", e.target.value)}
        error={
          errors.addressLine1 ? tErr(errors.addressLine1 as never) : undefined
        }
      />

      <FloatingInput
        label={t("line2")}
        optional={t("optional")}
        type="text"
        autoComplete="address-line2"
        value={fields.addressLine2}
        onChange={(e) => set("addressLine2", e.target.value)}
        onBlur={(e) => validateField("addressLine2", e.target.value)}
        error={
          errors.addressLine2 ? tErr(errors.addressLine2 as never) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FloatingInput
          label={t("city")}
          required
          type="text"
          autoComplete="address-level2"
          value={fields.city}
          onChange={(e) => set("city", e.target.value)}
          onBlur={(e) => validateField("city", e.target.value)}
          error={errors.city ? tErr(errors.city as never) : undefined}
        />
        <FloatingInput
          label={t("postalCode")}
          optional={t("optional")}
          type="text"
          autoComplete="postal-code"
          dir="ltr"
          value={fields.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          onBlur={(e) => validateField("postalCode", e.target.value)}
          error={
            errors.postalCode ? tErr(errors.postalCode as never) : undefined
          }
        />
      </div>

      {formError && (
        <p className="text-[0.75rem] text-[var(--color-status-danger-text)] mt-1">
          {formError}
        </p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-12 px-8 bg-transparent text-[var(--color-action-primary)] border-[1.5px] border-[var(--color-action-primary)] text-[0.6875rem] font-bold tracking-[0.14em] uppercase rtl:tracking-normal rtl:normal-case rtl:text-[0.875rem] transition-colors hover:bg-[var(--color-action-secondary-hover-bg)] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {isSubmitting && <span className="btn-spinner" />}
          {isSubmitting ? t("saving") : t("save")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-12 px-4 bg-transparent text-[0.8125rem] text-neutral-700 underline underline-offset-[3px] transition-colors hover:text-neutral-900 disabled:opacity-60"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * BillingDetailsSection — entry point
 * ─────────────────────────────────────────────────────────────────────── */

export default function BillingDetailsSection({
  addresses,
  defaultAddressId,
  serviceableCountries,
}: BillingDetailsSectionProps) {
  const t = useTranslations("checkout.billing");
  const router = useRouter();
  const {
    selectedAddressId,
    setSelectedAddressId,
    selectAddress,
    isResolvingShipping,
  } = useCheckoutForm();

  const hasSavedAddresses = addresses.length > 0;

  const [mode, setMode] = useState<Mode>(
    hasSavedAddresses ? "card" : "new-form",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAddress =
    addresses.find((a) => a.id === selectedAddressId) ??
    addresses.find((a) => a.id === defaultAddressId) ??
    addresses[0] ??
    null;

  if (selectedAddressId === null && activeAddress !== null) {
    setSelectedAddressId(activeAddress.id);
  }

  async function handleAddSubmit(
    values: CheckoutAddressInput,
  ): Promise<SubmitResult | void> {
    setIsSubmitting(true);
    const result = await addAddressAction({ ...values, saveToProfile: true });
    setIsSubmitting(false);
    if (!result.success) {
      if (result.fieldErrors) return { fieldErrors: result.fieldErrors };
      return { formErrorKey: `errors.${result.errorCode}` };
    }
    await selectAddress(result.data.addressId);
    setMode("card");
    router.refresh();
  }

  async function handleEditSubmit(
    values: CheckoutAddressInput,
  ): Promise<SubmitResult | void> {
    if (!editingId) return;
    setIsSubmitting(true);
    const result = await updateAddressAction({ id: editingId, ...values });
    setIsSubmitting(false);
    if (!result.success) {
      if (result.fieldErrors) return { fieldErrors: result.fieldErrors };
      return { formErrorKey: `errors.${result.errorCode}` };
    }
    router.refresh();
    await selectAddress(editingId);
    setMode("card");
    setEditingId(null);
  }

  function handlePickerDelete(deletedId: string) {
    if (selectedAddressId === deletedId) {
      const next = addresses.find((a) => a.id !== deletedId);
      if (next) {
        void selectAddress(next.id);
      } else {
        setSelectedAddressId(null);
      }
    }
    router.refresh();
    if (addresses.length <= 2) {
      setMode("card");
    }
  }

  const editingAddress = editingId
    ? addresses.find((a) => a.id === editingId)
    : null;

  return (
    <section className="mb-12">
      <SectionHeading
        title={t("title")}
        requiredHelper={
          mode === "new-form" || mode === "edit-form"
            ? t("requiredHelper")
            : undefined
        }
      />

      {mode === "new-form" && (
        <AddressForm
          key="new"
          serviceableCountries={serviceableCountries}
          onSubmit={handleAddSubmit}
          onCancel={hasSavedAddresses ? () => setMode("card") : undefined}
          isSubmitting={isSubmitting}
        />
      )}

      {mode === "edit-form" && editingAddress && (
        <AddressForm
          key={editingId ?? "new"}
          initialValues={
            editingAddress as Partial<CheckoutAddressInput> & { id?: string }
          }
          serviceableCountries={serviceableCountries}
          onSubmit={handleEditSubmit}
          onCancel={() => {
            setMode("picker");
            setEditingId(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {mode === "picker" && hasSavedAddresses && (
        <AddressPicker
          addresses={addresses}
          initialSelectedId={selectedAddressId ?? addresses[0]?.id ?? ""}
          onConfirm={(id) => {
            void selectAddress(id);
            setMode("card");
          }}
          onCancel={() => setMode("card")}
          onAddNew={() => setMode("new-form")}
          onEdit={(id) => {
            setEditingId(id);
            setMode("edit-form");
          }}
          onDelete={handlePickerDelete}
          onSetDefault={() => router.refresh()}
        />
      )}

      {mode === "card" && activeAddress && (
        <div
          className={
            isResolvingShipping
              ? "opacity-60 pointer-events-none transition-opacity"
              : undefined
          }
          aria-busy={isResolvingShipping ? "true" : undefined}
        >
          <AddressCard
            address={activeAddress}
            onChange={() => setMode(addresses.length > 1 ? "picker" : "new-form")}
            onAddNew={() => setMode("new-form")}
          />
        </div>
      )}
    </section>
  );
}
