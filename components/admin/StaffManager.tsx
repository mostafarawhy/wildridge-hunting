"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StaffFilterBar from "@/components/admin/StaffFilterBar";
import StaffTable from "@/components/admin/StaffTable";
import StaffRolePermissionsPreview from "@/components/admin/StaffRolePermissionsPreview";
import { createStaffAction } from "@/lib/actions/staff";
import { can, STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import { generateTempPassword } from "@/lib/utils/temp-password";
import type { StaffRole } from "@/app/generated/prisma/client";
import type { AdminStaffListItemProjection } from "@/lib/db/queries/staff";

interface Props {
  rows: AdminStaffListItemProjection[];
  actingId: string;
  actingRole: StaffRole;
  activeRole: "ALL" | StaffRole;
  activeStatus: "ALL" | "ACTIVE" | "INACTIVE";
  query: string;
}

interface FormState {
  name: string;
  email: string;
  role: StaffRole;
  tempPassword: string;
  confirmPassword: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  confirmPassword?: string;
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


export default function StaffManager({
  rows,
  actingId,
  actingRole,
  activeRole,
  activeStatus,
  query,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const assignableRoles = (Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).filter(
    (r) => actingRole === "SUPER_ADMIN" || !can(r, "staff:manage"),
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: "SUPPORT",
    tempPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function openModal() {
    setForm({
      name: "",
      email: "",
      role: "SUPPORT",
      tempPassword: generateTempPassword(),
      confirmPassword: "",
    });
    setFieldErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (isSubmitting) return;
    setModalOpen(false);
  }

  async function handleSubmit() {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.email.trim()) errors.email = "Email is required.";
    if (!form.confirmPassword.trim())
      errors.confirmPassword = "Your password is required.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});

    const result = await createStaffAction({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      password: form.tempPassword,
      confirmPassword: form.confirmPassword,
    });

    if (result.success) {
      toast.success("Staff member created.");
      router.refresh();
      setModalOpen(false);
    } else {
      if (result.errorCode === "EMAIL_TAKEN") {
        setFieldErrors((fe) => ({
          ...fe,
          email: "A staff member with this email already exists.",
        }));
      } else if (result.errorCode === "PASSWORD_CONFIRM_FAILED") {
        setFieldErrors((fe) => ({
          ...fe,
          confirmPassword: "Password confirmation failed.",
        }));
      } else if (
        result.errorCode === "VALIDATION_ERROR" &&
        result.fieldErrors
      ) {
        const fe: FieldErrors = {};
        if (result.fieldErrors.name) fe.name = result.fieldErrors.name[0];
        if (result.fieldErrors.email) fe.email = result.fieldErrors.email[0];
        setFieldErrors(fe);
      } else {
        toast.error(result.error);
      }
    }

    setIsSubmitting(false);
  }

  return (
    <div>
      <AdminPageHeader
        title="Staff"
        subtitle="Manage staff accounts and roles"
        actions={
          <button type="button" onClick={openModal} style={ctaBtn}>
            + Add Staff
          </button>
        }
      />

      <StaffFilterBar
        activeRole={activeRole}
        activeStatus={activeStatus}
        query={query}
      />

      <StaffTable rows={rows} actingId={actingId} actingRole={actingRole} />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        ariaLabel="Add staff member"
        maxWidth={480}
      >
        <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 3rem)" }}>
          <div style={{ padding: "1.75rem 1.5rem 1rem", flexShrink: 0 }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: 0,
              }}
            >
              Add Staff
            </h3>
          </div>

          <div
            style={{
              padding: "0 1.5rem 1.25rem",
              overflowY: "auto",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
              }}
            >
              <Input
                id="staff-name"
                label="Name"
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }));
                  if (fieldErrors.name)
                    setFieldErrors((fe) => ({ ...fe, name: undefined }));
                }}
                disabled={isSubmitting}
                error={fieldErrors.name}
                required
              />

              <Input
                id="staff-email"
                label="Email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                  if (fieldErrors.email)
                    setFieldErrors((fe) => ({ ...fe, email: undefined }));
                }}
                disabled={isSubmitting}
                error={fieldErrors.email}
                required
              />

              <Select
                id="staff-role"
                label="Role"
                value={form.role}
                onChange={(e) => {
                  setForm((f) => ({ ...f, role: e.target.value as StaffRole }));
                }}
                disabled={isSubmitting}
                required
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>

              <StaffRolePermissionsPreview role={form.role} />

              {/* Temp password block */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-medium)",
                    color: "var(--color-auth-label-text)",
                  }}
                >
                  Temporary Password
                </span>
                <div style={{ display: "flex" }}>
                  <input
                    id="staff-temp-password"
                    type="text"
                    dir="ltr"
                    readOnly
                    value={form.tempPassword}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "0.625rem 0.875rem",
                      fontSize: "var(--text-body)",
                      color: "var(--color-auth-input-text)",
                      backgroundColor: "var(--color-auth-input-bg)",
                      border: "1.5px solid var(--color-auth-input-border)",
                      borderInlineEnd: "none",
                      borderRadius: "var(--radius-none)",
                      outline: "none",
                      opacity: isSubmitting ? 0.5 : 1,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(form.tempPassword)
                        .then(() => {
                          toast.success("Password copied");
                        });
                    }}
                    disabled={isSubmitting}
                    style={{
                      flexShrink: 0,
                      padding: "0 0.875rem",
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "#0b0b0b",
                      backgroundColor: "#f3f4f6",
                      border: "1.5px solid var(--color-auth-input-border)",
                      borderRadius: "var(--radius-none)",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Copy
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    margin: 0,
                  }}
                >
                  This is the new member&apos;s sign-in password. They&apos;ll
                  be required to change it at first login. Share it with them
                  securely — it won&apos;t be shown again.
                </p>
              </div>

              <Input
                id="staff-confirm-password"
                label="Your password"
                hint="Confirm your own login password to authorize this."
                type="password"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    confirmPassword: e.target.value,
                  }));
                  if (fieldErrors.confirmPassword)
                    setFieldErrors((fe) => ({
                      ...fe,
                      confirmPassword: undefined,
                    }));
                }}
                disabled={isSubmitting}
                error={fieldErrors.confirmPassword}
                required
              />
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
              {isSubmitting ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
