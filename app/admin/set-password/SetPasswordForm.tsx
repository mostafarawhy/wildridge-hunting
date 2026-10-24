"use client";

import { useState } from "react";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { setOwnPasswordAction } from "@/lib/actions/staff";

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
}

export default function SetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;
    if (!newPassword) {
      errors.newPassword = "Password is required.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters.";
    } else if (!passwordRegex.test(newPassword)) {
      errors.newPassword = "Password must contain at least one letter and one digit.";
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;

    setLoading(true);
    try {
      const result = await setOwnPasswordAction({ newPassword });

      if (!result.success) {
        switch (result.errorCode) {
          case "SAME_PASSWORD":
            setFieldErrors({ newPassword: "New password must be different from your temporary password." });
            break;
          case "VALIDATION_ERROR":
            if (result.fieldErrors?.newPassword) {
              setFieldErrors({ newPassword: result.fieldErrors.newPassword[0] });
            } else {
              setFormError("Something went wrong. Please try again.");
            }
            break;
          case "FORBIDDEN":
            setFormError(result.error);
            break;
          default:
            setFormError("Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      window.location.assign("/admin/login?notice=password-set");
      return;
    } catch {
      setFormError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

        <AuthInput
          id="set-password-new"
          type="password"
          label="New Password"
          placeholder="••••••••"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          required
          error={fieldErrors.newPassword}
        />

        <AuthInput
          id="set-password-confirm"
          type="password"
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          required
          error={fieldErrors.confirmPassword}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          {loading ? "Saving…" : "Set Password"}
        </Button>
      </div>
    </form>
  );
}
