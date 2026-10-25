"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuoteStore } from "@/lib/stores/quote-store";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import QuoteItemRow from "./QuoteItemRow";
import AddressCard from "@/components/account/AddressCard";
import AddressFormContent, {
  type AddressFormContentResult,
} from "@/components/account/AddressFormContent";
import { submitQuoteAction } from "@/lib/actions/quote";
import { addAddressAction } from "@/lib/actions/address";
import type { CustomerAddressProjection } from "@/lib/db/queries/account";
import type { CheckoutAddressInput } from "@/lib/validations/checkout";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DemoEmailNote from "@/components/layout/DemoEmailNote";

interface QuoteSubmitModalProps {
  open: boolean;
  onClose: () => void;
  locale: string;
  initialAddresses: CustomerAddressProjection[];
  serviceableCountries: { code: string; name: string }[];
  note: string;
  onNoteChange: (v: string) => void;
}

type Step = "confirm" | "add-address" | "success";

export default function QuoteSubmitModal({
  open,
  onClose,
  locale,
  initialAddresses,
  serviceableCountries,
  note,
  onNoteChange,
}: QuoteSubmitModalProps) {
  const t = useTranslations("quote");
  const tAddr = useTranslations("account.addresses");
  const router = useRouter();
  const lines = useQuoteStore((s) => s.lines);
  const closeDrawer = useQuoteStore((s) => s.closeDrawer);
  const clear = useQuoteStore((s) => s.clear);

  const [step, setStep] = useState<Step>("confirm");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string | null>(null);

  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      startNavigationProgress("/account/quotes");
      router.push("/account/quotes");
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [step, router, onClose]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setStep("confirm");
      setSelectedAddressId(null);
      setError(null);
      setAddressError(null);
    }
  }

  async function handleSubmit() {
    if (!selectedAddressId) {
      setAddressError(t("confirm_modal.select_address_prompt"));
      return;
    }
    setAddressError(null);
    setError(null);
    setIsPending(true);
    try {
      const result = await submitQuoteAction(
        {
          items: lines.map((l) => ({
            productSku: l.productSku,
            quantity: l.quantity,
            addonIds: l.selectedAddons.map((a) => a.addonId),
          })),
          customerNote: note.trim() || undefined,
          addressId: selectedAddressId,
        },
      );
      if (result.success) {
        setQuoteNumber(result.data.quoteNumber);
        clear();
        setStep("success");
      } else {
        const key = `errors.${result.errorCode}`;
        setError(t.has(key) ? t(key) : result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleAddNew(
    values: CheckoutAddressInput,
  ): Promise<AddressFormContentResult | void> {
    setIsAddingAddress(true);
    const result = await addAddressAction({ ...values, saveToProfile: true });
    setIsAddingAddress(false);
    if (!result.success) {
      if (result.fieldErrors) return { fieldErrors: result.fieldErrors };
      return { formErrorKey: `account.addresses.errors.${result.errorCode}` };
    }
    const newAddress: CustomerAddressProjection = {
      id: result.data.addressId,
      label: values.label ?? null,
      fullName: values.fullName,
      phone: values.phone,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2 ?? null,
      city: values.city,
      emirate: values.emirate,
      postalCode: values.postalCode ?? null,
      country: values.country,
      isDefault: addresses.length === 0,
      createdAt: new Date().toISOString(),
    };
    setAddresses((prev) => [...prev, newAddress]);
    setSelectedAddressId(newAddress.id);
    setDirection(-1);
    setStep("confirm");
  }

  const title = t("confirm_modal.title");

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} maxWidth={560}>
      <div style={{ overflow: "hidden" }}>
      <AnimatePresence mode="wait" initial={false}>
        {step === "add-address" ? (
          <m.div
            key="add-address"
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
          >
            <AddressFormContent
              mode="add"
              serviceableCountries={serviceableCountries}
              onSubmit={handleAddNew}
              isSubmitting={isAddingAddress}
              onClose={() => {
                setDirection(-1);
                setStep("confirm");
              }}
            />
          </m.div>
        ) : step === "success" ? (
          <m.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="flex flex-col items-center justify-center gap-6 px-6 py-12 text-center"
            style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
          >
            <CheckIcon />
            <p
              className="text-body-lg font-bold"
              style={{ color: "var(--color-auth-label-text)" }}
            >
              {t("success_title")}
            </p>
            <p
              className="text-body"
              style={{ color: "var(--color-auth-input-placeholder)" }}
            >
              {t("success_body", { quoteNumber: quoteNumber ?? "" })}
            </p>
            <DemoEmailNote />
          </m.div>
        ) : (
          <m.div
            key="confirm"
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            style={{
              display: "flex",
              flexDirection: "column",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
            }}
          >
          <div
            style={{
              padding: "1.5rem 2rem",
              borderBottom: "1px solid var(--color-auth-divider)",
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
          </div>

          <ul
            className="flex flex-col"
            style={{ listStyle: "none", gap: 0 }}
            role="list"
          >
            {lines.map((line) => (
              <QuoteItemRow key={line.lineId} line={line} locale={locale} />
            ))}
          </ul>

          <div style={{ padding: "1.5rem 2rem" }}>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                closeDrawer();
                onClose();
                startNavigationProgress("/shop");
                router.push("/shop");
              }}
            >
              {t("confirm_modal.add_more_items")}
            </Button>
          </div>

          <div
            className="flex flex-col gap-1"
            style={{ padding: "1.5rem 2rem 0" }}
          >
            <label
              className="text-body-sm font-semibold"
              style={{ color: "var(--color-auth-label-text)" }}
            >
              {t("note_label")}
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t("note_placeholder")}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid var(--color-auth-input-border)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-auth-input-bg)",
                color: "var(--color-auth-input-text)",
                fontSize: "var(--text-body)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div
            style={{
              padding: "1.5rem 2rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span
                className="text-body-sm font-semibold"
                style={{ color: "var(--color-auth-label-text)" }}
              >
                {t("confirm_modal.ship_to_label")}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.1875rem 0.5rem",
                  fontSize: "var(--text-eyebrow)",
                  fontWeight: "var(--font-black)",
                  letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-auth-form-border)",
                  color: "var(--color-content-tertiary)",
                  borderRadius: "var(--radius-none)",
                  whiteSpace: "nowrap",
                }}
              >
                {t("confirm_modal.ship_to_required_tag")}
              </span>
            </div>
            <p
              className="text-body-sm"
              style={{ color: "var(--color-content-tertiary)", margin: 0 }}
            >
              {t("confirm_modal.ship_to_note")}
            </p>

            {addresses.length > 0 ? (
              <>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2"
                  style={{ gap: "1rem" }}
                >
                  {addresses.map((a) => (
                    <AddressCard
                      key={a.id}
                      address={a}
                      locale={locale}
                      selectable
                      isSelected={a.id === selectedAddressId}
                      onSelect={() => {
                        setSelectedAddressId(a.id);
                        setAddressError(null);
                      }}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onSetDefault={() => {}}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDirection(1);
                    setStep("add-address");
                  }}
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-medium)",
                    color: "var(--color-auth-label-text)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    alignSelf: "flex-start",
                  }}
                >
                  {t("confirm_modal.add_new_address")}
                </button>
              </>
            ) : (
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
                  {tAddr("empty")}
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setDirection(1);
                    setStep("add-address");
                  }}
                >
                  {tAddr("emptyCta")}
                </Button>
              </div>
            )}

            {addressError && (
              <p
                role="alert"
                className="text-body-sm"
                style={{ color: "var(--color-auth-error-text)", margin: 0 }}
              >
                {addressError}
              </p>
            )}
          </div>

          {error && (
            <p
              className="text-body-sm"
              style={{
                color: "var(--color-auth-error-text)",
                padding: "0 2rem",
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              padding: "1.5rem 2rem",
              display: "flex",
              gap: "0.75rem",
              borderTop: "1px solid var(--color-auth-divider)",
            }}
          >
            <Button
              variant="primary"
              size="lg"
              loading={isPending}
              onClick={handleSubmit}
            >
              {t("confirm_modal.submit_cta")}
            </Button>
            <Button variant="secondary" size="lg" onClick={onClose}>
              {t("confirm_modal.cancel_cta")}
            </Button>
          </div>
          </m.div>
        )}
      </AnimatePresence>
      </div>
    </Modal>
  );
}

function CheckIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-auth-success-text)" }}
    >
      <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M18 28l7 7 13-13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
