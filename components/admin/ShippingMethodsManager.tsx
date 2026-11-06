"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/admin";
import {
  createShippingMethodAction,
  updateShippingMethodAction,
  toggleShippingMethodAction,
  deleteShippingMethodAction,
} from "@/lib/actions/shipping-method";
import type { AdminShippingMethodListItem } from "@/lib/db/queries/shipping";

interface Props {
  methods: AdminShippingMethodListItem[];
}

const ctaBtn: React.CSSProperties = {
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
  cursor: "pointer",
};

function CheckmarkIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: "1rem",
          height: "1rem",
          border: "1.5px solid var(--color-auth-input-border)",
          backgroundColor: checked
            ? "var(--color-action-primary)"
            : "var(--color-auth-input-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 150ms, border-color 150ms",
        }}
      >
        {checked && <CheckmarkIcon />}
      </span>
      <span style={{ fontSize: "var(--text-body)", color: "#0b0b0b" }}>
        {label}
      </span>
    </label>
  );
}

interface FormState {
  code: string;
  nameEn: string;
  nameAr: string;
  nameRu: string;
  displayOrder: string;
  isActive: boolean;
  freeShippingEligible: boolean;
}

const emptyForm: FormState = {
  code: "",
  nameEn: "",
  nameAr: "",
  nameRu: "",
  displayOrder: "0",
  isActive: true,
  freeShippingEligible: false,
};

export default function ShippingMethodsManager({ methods }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setModalMode("create");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEdit(m: AdminShippingMethodListItem) {
    setForm({
      code: m.code,
      nameEn: m.nameEn,
      nameAr: m.nameAr,
      nameRu: m.nameRu ?? "",
      displayOrder: String(m.displayOrder),
      isActive: m.isActive,
      freeShippingEligible: m.freeShippingEligible,
    });
    setEditingId(m.id);
    setModalMode("edit");
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setModalOpen(false);
  }

  async function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = "Code is required.";
    if (!form.nameEn.trim()) errors.nameEn = "English name is required.";
    if (!form.nameAr.trim()) errors.nameAr = "Arabic name is required.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const payload = {
      code: form.code.trim(),
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      nameRu: form.nameRu.trim() || undefined,
      displayOrder: form.displayOrder,
      isActive: form.isActive,
      freeShippingEligible: form.freeShippingEligible,
    };

    const result =
      modalMode === "create"
        ? await createShippingMethodAction(payload)
        : await updateShippingMethodAction(editingId!, payload);

    setIsSubmitting(false);

    if (result.success) {
      toast.success(
        modalMode === "create"
          ? "Delivery method created."
          : "Delivery method updated.",
      );
      router.refresh();
      setModalOpen(false);
      return;
    }

    if (result.errorCode === "CODE_TAKEN") {
      setFieldErrors((fe) => ({ ...fe, code: result.error }));
    } else if (result.fieldErrors) {
      const errs: Record<string, string> = {};
      for (const [k, msgs] of Object.entries(result.fieldErrors)) {
        if (msgs && msgs.length > 0) errs[k] = msgs[0];
      }
      setFieldErrors(errs);
    } else {
      toast.error(result.error);
    }
  }

  async function handleToggle(m: AdminShippingMethodListItem) {
    const result = await toggleShippingMethodAction(m.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeletePending(true);
    const result = await deleteShippingMethodAction(confirmDeleteId);
    setDeletePending(false);
    if (!result.success) {
      toast.error(result.error);
      setConfirmDeleteId(null);
      return;
    }
    toast.success("Delivery method deleted.");
    setConfirmDeleteId(null);
    router.refresh();
  }

  const columns = [
    {
      key: "code",
      header: "Code",
      render: (m: AdminShippingMethodListItem) => (
        <span dir="ltr">{m.code}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (m: AdminShippingMethodListItem) => m.nameEn,
    },
    {
      key: "freeShip",
      header: "Free shipping",
      render: (m: AdminShippingMethodListItem) =>
        m.freeShippingEligible ? (
          <span
            style={{
              display: "inline-block",
              padding: "0.125rem 0.5rem",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: "#1e40af",
              backgroundColor: "#dbeafe",
            }}
          >
            Free-ship
          </span>
        ) : (
          <span style={{ color: "#9a9a9a" }}>—</span>
        ),
    },
    {
      key: "rates",
      header: "Rates",
      align: "end" as const,
      render: (m: AdminShippingMethodListItem) => m.rateCount,
    },
    {
      key: "status",
      header: "Status",
      render: (m: AdminShippingMethodListItem) => (
        <span
          style={{
            display: "inline-block",
            padding: "0.125rem 0.5rem",
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-semibold)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            borderRadius: 0,
            color: m.isActive ? "#166534" : "#6b6b6b",
            backgroundColor: m.isActive ? "#dcfce7" : "#f3f4f6",
          }}
        >
          {m.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "end" as const,
      render: (m: AdminShippingMethodListItem) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => openEdit(m)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 13,
              color: "#6b6b6b",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              void handleToggle(m);
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 13,
              color: "#6b6b6b",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {m.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(m.id)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 13,
              color: "#991b1b",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: 0,
          }}
        >
          Delivery Methods
        </h2>
        <button type="button" onClick={openCreate} style={ctaBtn}>
          + Add method
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={methods}
        getRowKey={(m) => m.id}
        emptyMessage="No delivery methods yet."
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        ariaLabel={
          modalMode === "create"
            ? "Add delivery method"
            : "Edit delivery method"
        }
        maxWidth={480}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100dvh - 3rem)",
          }}
        >
          <div style={{ padding: "1.75rem 1.5rem 1rem", flexShrink: 0 }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              {modalMode === "create"
                ? "Add delivery method"
                : "Edit delivery method"}
            </h3>
          </div>

          <div
            style={{ padding: "0 1.5rem 1.25rem", overflowY: "auto", flex: 1 }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <div
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]"
                style={{
                  gap: "1rem",
                }}
              >
                <Input
                  id="smm-code"
                  label="Code"
                  hint="Uppercase letters, numbers, underscores only."
                  value={form.code}
                  dir="ltr"
                  required
                  onChange={(e) => {
                    setForm((f) => ({ ...f, code: e.target.value }));
                    if (fieldErrors.code)
                      setFieldErrors((fe) => {
                        const n = { ...fe };
                        delete n.code;
                        return n;
                      });
                  }}
                  disabled={isSubmitting}
                  error={fieldErrors.code}
                />
                <Input
                  id="smm-display-order"
                  label="Display Order"
                  value={form.displayOrder}
                  dir="ltr"
                  inputMode="numeric"
                  onChange={(e) => {
                    setForm((f) => ({ ...f, displayOrder: e.target.value }));
                    if (fieldErrors.displayOrder)
                      setFieldErrors((fe) => {
                        const n = { ...fe };
                        delete n.displayOrder;
                        return n;
                      });
                  }}
                  disabled={isSubmitting}
                  error={fieldErrors.displayOrder}
                />
              </div>

              <div
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr]"
                style={{
                  gap: "1rem",
                }}
              >
                <Input
                  id="smm-name-en"
                  label="Name (English)"
                  value={form.nameEn}
                  required
                  onChange={(e) => {
                    setForm((f) => ({ ...f, nameEn: e.target.value }));
                    if (fieldErrors.nameEn)
                      setFieldErrors((fe) => {
                        const n = { ...fe };
                        delete n.nameEn;
                        return n;
                      });
                  }}
                  disabled={isSubmitting}
                  error={fieldErrors.nameEn}
                />
                <Input
                  id="smm-name-ar"
                  label="Name (Arabic)"
                  value={form.nameAr}
                  required
                  onChange={(e) => {
                    setForm((f) => ({ ...f, nameAr: e.target.value }));
                    if (fieldErrors.nameAr)
                      setFieldErrors((fe) => {
                        const n = { ...fe };
                        delete n.nameAr;
                        return n;
                      });
                  }}
                  disabled={isSubmitting}
                  error={fieldErrors.nameAr}
                />
              </div>

              <Input
                id="smm-name-ru"
                label="Name (Russian)"
                value={form.nameRu}
                optional="optional"
                onChange={(e) => {
                  setForm((f) => ({ ...f, nameRu: e.target.value }));
                  if (fieldErrors.nameRu)
                    setFieldErrors((fe) => {
                      const n = { ...fe };
                      delete n.nameRu;
                      return n;
                    });
                }}
                disabled={isSubmitting}
                error={fieldErrors.nameRu}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <CheckboxField
                  id="smm-is-active"
                  label="Active"
                  checked={form.isActive}
                  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <CheckboxField
                  id="smm-free-shipping"
                  label="Eligible for free shipping"
                  checked={form.freeShippingEligible}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, freeShippingEligible: v }))
                  }
                />
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--color-shop-divider, #e3e3e3)",
              padding: "1rem 1.5rem 1.25rem",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1.125rem",
                fontSize: "var(--text-body)",
                background: "none",
                border: "none",
                borderRadius: "0",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                color: "#0b0b0b",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting}
              style={{
                padding: "0.5rem 1.125rem",
                fontSize: "var(--text-body)",
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                border: "1px solid #0b0b0b",
                borderRadius: "0",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting
                ? "Saving…"
                : modalMode === "create"
                  ? "Create"
                  : "Save changes"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => {
          if (!deletePending) setConfirmDeleteId(null);
        }}
        onConfirm={handleDelete}
        title="Delete delivery method"
        message="This method will be permanently deleted. Methods with rates cannot be deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isPending={deletePending}
        destructive
      />
    </div>
  );
}
