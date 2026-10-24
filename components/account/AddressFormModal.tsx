"use client";

import { useTranslations } from "next-intl";
import Modal from "@/components/ui/Modal";
import AddressFormContent, {
  type AddressFormContentResult,
} from "@/components/account/AddressFormContent";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import type { CheckoutAddressInput } from "@/lib/validations/checkout";

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  initial?: CustomerAddressProjection;
  serviceableCountries: { code: string; name: string }[];
  onSubmit: (
    values: CheckoutAddressInput,
  ) => Promise<AddressFormContentResult | void>;
  isSubmitting: boolean;
}

export default function AddressFormModal({
  open,
  onClose,
  mode,
  initial,
  serviceableCountries,
  onSubmit,
  isSubmitting,
}: Props) {
  const t = useTranslations("account.addresses");
  const title = mode === "add" ? t("addTitle") : t("editTitle");

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} maxWidth={520}>
      <AddressFormContent
        mode={mode}
        initial={initial}
        serviceableCountries={serviceableCountries}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        onClose={onClose}
      />
    </Modal>
  );
}
