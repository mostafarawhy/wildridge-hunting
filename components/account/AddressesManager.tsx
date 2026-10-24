"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AddressCard from "@/components/account/AddressCard";
import AddressFormModal from "@/components/account/AddressFormModal";
import AccountHelpLink from "@/components/account/AccountHelpLink";
import type { AddressFormContentResult } from "@/components/account/AddressFormContent";
import {
  addAddressAction,
  updateAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/actions/address";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import type { CheckoutAddressInput } from "@/lib/validations/checkout";
import type { AddressActionErrorCode } from "@/lib/actions/address";

interface Props {
  addresses: CustomerAddressProjection[];
  locale: string;
  serviceableCountries: { code: string; name: string }[];
}

function EmptyIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="var(--color-auth-input-border)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 34V14L20 4l14 10v20" />
      <rect x="14" y="20" width="12" height="14" />
      <path d="M14 20h12" />
    </svg>
  );
}

export default function AddressesManager({
  addresses,
  locale,
  serviceableCountries,
}: Props) {
  const t = useTranslations("account.addresses");
  const toast = useToast();
  const router = useRouter();

  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingAddress, setEditingAddress] =
    useState<CustomerAddressProjection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<CustomerAddressProjection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  function errorMessage(code: AddressActionErrorCode) {
    return t(`errors.${code}`);
  }

  async function handleAddSubmit(
    values: CheckoutAddressInput,
  ): Promise<AddressFormContentResult | void> {
    setIsSubmitting(true);
    const result = await addAddressAction({ ...values, saveToProfile: true });
    setIsSubmitting(false);
    if (!result.success) {
      if (result.fieldErrors) return { fieldErrors: result.fieldErrors };
      return { formErrorKey: `account.addresses.errors.${result.errorCode}` };
    }
    toast.success(t("addressSaved"));
    setModalMode(null);
    router.refresh();
  }

  async function handleEditSubmit(
    values: CheckoutAddressInput,
  ): Promise<AddressFormContentResult | void> {
    if (!editingAddress) return;
    setIsSubmitting(true);
    const result = await updateAddressAction({
      id: editingAddress.id,
      ...values,
    });
    setIsSubmitting(false);
    if (!result.success) {
      if (result.fieldErrors) return { fieldErrors: result.fieldErrors };
      return { formErrorKey: `account.addresses.errors.${result.errorCode}` };
    }
    toast.success(t("addressSaved"));
    setModalMode(null);
    setEditingAddress(null);
    router.refresh();
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeletingId(deleteTarget.id);
    const result = await deleteAddressAction(deleteTarget.id);
    setIsDeleting(false);
    setDeletingId(null);
    setDeleteTarget(null);
    if (!result.success) {
      toast.error(errorMessage(result.errorCode));
      return;
    }
    toast.success(t("addressDeleted"));
    router.refresh();
  }

  async function handleSetDefault(address: CustomerAddressProjection) {
    setSettingDefaultId(address.id);
    const result = await setDefaultAddressAction(address.id);
    setSettingDefaultId(null);
    if (!result.success) {
      toast.error(errorMessage(result.errorCode));
      return;
    }
    toast.success(t("defaultUpdated"));
    router.refresh();
  }

  function openAdd() {
    setModalMode("add");
  }

  function openEdit(address: CustomerAddressProjection) {
    setEditingAddress(address);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingAddress(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-heading)",
              fontWeight: "var(--font-bold)",
              color: "var(--color-action-primary)",
              letterSpacing: "var(--tracking-tight)",
              lineHeight: "var(--leading-tight)",
              margin: 0,
            }}
          >
            {t("title")}
          </h1>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-content-tertiary)",
              marginTop: "0.25rem",
              marginBottom: 0,
            }}
          >
            {t("subtitle")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <AccountHelpLink href="/account/support" />
          {addresses.length > 0 && (
            <Button variant="primary" size="sm" onClick={openAdd}>
              {t("addAddress")}
            </Button>
          )}
        </div>
      </div>

      {addresses.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--color-auth-form-bg)",
            border: "1px solid var(--color-auth-form-border)",
            borderRadius: "var(--radius-none)",
            padding: "3rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            textAlign: "center",
          }}
        >
          <EmptyIcon />
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "var(--color-auth-label-text)",
              margin: 0,
            }}
          >
            {t("empty")}
          </p>
          <Button variant="primary" size="md" onClick={openAdd}>
            {t("emptyCta")}
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2"
          style={{ gap: "1rem" }}
        >
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              locale={locale}
              onEdit={() => openEdit(address)}
              onDelete={() => setDeleteTarget(address)}
              onSetDefault={() => handleSetDefault(address)}
              isSettingDefault={settingDefaultId === address.id}
              isDeleting={deletingId === address.id}
            />
          ))}
        </div>
      )}

      {modalMode !== null && (
        <AddressFormModal
          key={modalMode === "edit" ? `edit-${editingAddress?.id}` : "add"}
          open
          onClose={closeModal}
          mode={modalMode}
          initial={
            modalMode === "edit" ? (editingAddress ?? undefined) : undefined
          }
          serviceableCountries={serviceableCountries}
          onSubmit={modalMode === "edit" ? handleEditSubmit : handleAddSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmLabel={t("confirmDelete")}
        cancelLabel={t("cancel")}
        isPending={isDeleting}
        destructive
      />
    </div>
  );
}
