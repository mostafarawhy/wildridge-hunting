"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  updateStaffRoleAction,
  setStaffActiveAction,
  resetStaffPasswordAction,
} from "@/lib/actions/staff";
import { can, STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import { generateTempPassword } from "@/lib/utils/temp-password";
import type { StaffRole } from "@/app/generated/prisma/client";

interface Props {
  staffId: string;
  staffName: string;
  currentRole: StaffRole;
  isActive: boolean;
  actingId: string;
  actingRole: StaffRole;
}

const modalFooter: React.CSSProperties = {
  borderTop: "1px solid var(--color-shop-divider, #e3e3e3)",
  padding: "1rem 1.5rem 1.25rem",
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
};

const cancelBtn = (isPending: boolean): React.CSSProperties => ({
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: isPending ? "not-allowed" : "pointer",
});

const submitBtn = (
  color: string,
  disabled: boolean,
): React.CSSProperties => ({
  padding: "0.5rem 1.125rem",
  fontSize: "var(--text-body)",
  backgroundColor: color,
  color: "#ffffff",
  border: `1px solid ${color}`,
  borderRadius: "0",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.6 : 1,
});

export default function StaffManageActions({
  staffId,
  staffName,
  currentRole,
  isActive,
  actingId,
  actingRole,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [editOpen, setEditOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<StaffRole>(currentRole);
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordError, setEditPasswordError] = useState<
    string | undefined
  >(undefined);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivatePasswordError, setDeactivatePasswordError] = useState<
    string | undefined
  >(undefined);

  const [reactivateOpen, setReactivateOpen] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTempPassword, setResetTempPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<
    string | undefined
  >(undefined);

  if (staffId === actingId) return null;
  if (actingRole !== "SUPER_ADMIN" && can(currentRole, "staff:manage"))
    return null;

  const assignableRoles = (Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).filter(
    (r) => actingRole === "SUPER_ADMIN" || !can(r, "staff:manage"),
  );

  const showPasswordField =
    can(currentRole, "staff:manage") || can(selectedRole, "staff:manage");

  function openEdit() {
    setSelectedRole(currentRole);
    setEditPassword("");
    setEditPasswordError(undefined);
    setEditOpen(true);
  }

  function closeEdit() {
    if (isPending) return;
    setEditOpen(false);
  }

  function handleEditSubmit() {
    startTransition(async () => {
      const result = await updateStaffRoleAction({
        staffId,
        role: selectedRole,
        confirmPassword: showPasswordField ? editPassword : "",
      });
      if (result.success) {
        toast.success("Role updated.");
        router.refresh();
        setEditOpen(false);
      } else {
        if (result.errorCode === "PASSWORD_CONFIRM_FAILED") {
          setEditPasswordError("Password confirmation failed.");
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function openDeactivate() {
    setDeactivatePassword("");
    setDeactivatePasswordError(undefined);
    setDeactivateOpen(true);
  }

  function closeDeactivate() {
    if (isPending) return;
    setDeactivateOpen(false);
  }

  function handleDeactivateSubmit() {
    startTransition(async () => {
      const result = await setStaffActiveAction({
        staffId,
        isActive: false,
        confirmPassword: deactivatePassword,
      });
      if (result.success) {
        toast.success("Staff member deactivated.");
        router.refresh();
        setDeactivateOpen(false);
      } else {
        if (result.errorCode === "PASSWORD_CONFIRM_FAILED") {
          setDeactivatePasswordError("Password confirmation failed.");
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function openReset() {
    setResetTempPassword(generateTempPassword());
    setResetConfirmPassword("");
    setResetPasswordError(undefined);
    setResetOpen(true);
  }

  function closeReset() {
    if (isPending) return;
    setResetOpen(false);
  }

  function handleResetSubmit() {
    startTransition(async () => {
      const result = await resetStaffPasswordAction({
        staffId,
        newPassword: resetTempPassword,
        confirmPassword: resetConfirmPassword,
      });
      if (result.success) {
        toast.success("Password reset. Share the new temporary password.");
        router.refresh();
        setResetOpen(false);
      } else {
        if (result.errorCode === "PASSWORD_CONFIRM_FAILED") {
          setResetPasswordError("Password confirmation failed.");
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await setStaffActiveAction({ staffId, isActive: true });
      if (result.success) {
        toast.success("Staff member reactivated.");
        router.refresh();
        setReactivateOpen(false);
      } else {
        toast.error(result.error);
        setReactivateOpen(false);
      }
    });
  }

  const actionBtn = (color: string): React.CSSProperties => ({
    background: "none",
    border: "none",
    padding: "0.125rem 0.25rem",
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-medium)",
    color,
    cursor: isPending ? "not-allowed" : "pointer",
    borderRadius: "0",
    opacity: isPending ? 0.5 : 1,
    whiteSpace: "nowrap",
  });

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={openEdit}
          disabled={isPending}
          style={actionBtn("#0b0b0b")}
        >
          Edit role
        </button>
        <button
          type="button"
          onClick={openReset}
          disabled={isPending}
          style={actionBtn("#0b0b0b")}
        >
          Reset password
        </button>
        {isActive ? (
          <button
            type="button"
            onClick={openDeactivate}
            disabled={isPending}
            style={actionBtn("#991b1b")}
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setReactivateOpen(true)}
            disabled={isPending}
            style={actionBtn("#166534")}
          >
            Reactivate
          </button>
        )}
      </div>

      <Modal
        open={editOpen}
        onClose={closeEdit}
        ariaLabel="Edit staff role"
        maxWidth={420}
      >
        <div>
          <div style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: "0 0 1.25rem",
              }}
            >
              Edit Role
            </h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
            >
              <Select
                id="edit-staff-role"
                label="Role"
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value as StaffRole);
                  setEditPasswordError(undefined);
                }}
                disabled={isPending}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>

              {showPasswordField && (
                <Input
                  id="edit-staff-confirm-password"
                  label="Your password"
                  hint="Confirm your own login password to authorize this role change."
                  type="password"
                  value={editPassword}
                  onChange={(e) => {
                    setEditPassword(e.target.value);
                    if (editPasswordError) setEditPasswordError(undefined);
                  }}
                  disabled={isPending}
                  error={editPasswordError}
                  required
                />
              )}
            </div>
          </div>

          <div style={modalFooter}>
            <button
              type="button"
              onClick={closeEdit}
              disabled={isPending}
              style={cancelBtn(isPending)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSubmit}
              disabled={isPending || selectedRole === currentRole}
              style={submitBtn("#0b0b0b", isPending || selectedRole === currentRole)}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deactivateOpen}
        onClose={closeDeactivate}
        ariaLabel={`Deactivate ${staffName}`}
        maxWidth={420}
      >
        <div>
          <div style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: "0 0 0.75rem",
              }}
            >
              Deactivate {staffName}
            </h3>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                lineHeight: "var(--leading-relaxed)",
                margin: "0 0 1.25rem",
              }}
            >
              {staffName} will be signed out and blocked from signing in. This
              can be reversed.
            </p>
            <Input
              id="deactivate-confirm-password"
              label="Your password"
              hint="Confirm your own login password to authorize this."
              type="password"
              value={deactivatePassword}
              onChange={(e) => {
                setDeactivatePassword(e.target.value);
                if (deactivatePasswordError)
                  setDeactivatePasswordError(undefined);
              }}
              disabled={isPending}
              error={deactivatePasswordError}
              required
            />
          </div>

          <div style={modalFooter}>
            <button
              type="button"
              onClick={closeDeactivate}
              disabled={isPending}
              style={cancelBtn(isPending)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivateSubmit}
              disabled={isPending}
              style={submitBtn("#991b1b", isPending)}
            >
              {isPending ? "Deactivating…" : "Deactivate"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onConfirm={handleReactivate}
        title="Reactivate Staff Member"
        message={`${staffName} will be able to sign in again. Are you sure?`}
        confirmLabel="Reactivate"
        cancelLabel="Cancel"
        isPending={isPending}
        destructive={false}
      />

      <Modal
        open={resetOpen}
        onClose={closeReset}
        ariaLabel={`Reset password for ${staffName}`}
        maxWidth={420}
      >
        <div>
          <div style={{ padding: "1.75rem 1.5rem 1.25rem" }}>
            <h3
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                margin: "0 0 0.75rem",
              }}
            >
              Reset Password
            </h3>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                lineHeight: "var(--leading-relaxed)",
                margin: "0 0 1.25rem",
              }}
            >
              A new temporary password will be set for {staffName}. They will be
              required to change it at their next login.
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
            >
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
                    type="text"
                    dir="ltr"
                    readOnly
                    value={resetTempPassword}
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
                      opacity: isPending ? 0.5 : 1,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(resetTempPassword)
                        .then(() => {
                          toast.success("Password copied");
                        });
                    }}
                    disabled={isPending}
                    style={{
                      flexShrink: 0,
                      padding: "0 0.875rem",
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-medium)",
                      color: "#0b0b0b",
                      backgroundColor: "#f3f4f6",
                      border: "1.5px solid var(--color-auth-input-border)",
                      borderRadius: "var(--radius-none)",
                      cursor: isPending ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <Input
                id="reset-staff-confirm-password"
                label="Your password"
                hint="Confirm your own login password to authorize this reset."
                type="password"
                value={resetConfirmPassword}
                onChange={(e) => {
                  setResetConfirmPassword(e.target.value);
                  if (resetPasswordError) setResetPasswordError(undefined);
                }}
                disabled={isPending}
                error={resetPasswordError}
                required
              />
            </div>
          </div>

          <div style={modalFooter}>
            <button
              type="button"
              onClick={closeReset}
              disabled={isPending}
              style={cancelBtn(isPending)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResetSubmit}
              disabled={isPending}
              style={submitBtn("#0b0b0b", isPending)}
            >
              {isPending ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
