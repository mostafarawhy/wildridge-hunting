"use client";

import { isDemoMode } from "@/lib/config/demo";
import { safeRelativePath, stripLocalePrefix } from "@/lib/utils/safe-redirect";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { registerAction } from "@/lib/actions/auth";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";

interface RegisterFormCompactProps {
  onSuccess?: () => void;
  callbackUrl?: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export default function RegisterFormCompact({
  onSuccess,
  callbackUrl,
}: RegisterFormCompactProps) {
  const t = useTranslations("auth.register");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;

    if (!name.trim()) {
      errors.name = t("validation.nameRequired");
    } else if (name.trim().length > 100) {
      errors.name = t("validation.nameTooLong");
    }
    if (!email.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!emailRegex.test(email)) {
      errors.email = t("validation.emailInvalid");
    }
    if (!password) {
      errors.password = t("validation.passwordRequired");
    } else if (password.length < 8) {
      errors.password = t("validation.passwordTooShort");
    } else if (!passwordRegex.test(password)) {
      errors.password = t("validation.passwordWeak");
    }
    if (!confirmPassword) {
      errors.confirmPassword = t("validation.confirmPasswordRequired");
    } else if (confirmPassword !== password) {
      errors.confirmPassword = t("confirmPassword.mismatch");
    }
    if (!terms) {
      errors.terms = t("terms.required");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;

    setLoading(true);
    useAuthBusyStore.getState().begin("sign-in");
    let landed = false;
    try {
      const result = await registerAction({
        name: name.trim(),
        email,
        password,
        locale: locale as "en" | "ar" | "ru",
      });

      if (!result.success) {
        switch (result.errorCode) {
          case "EMAIL_TAKEN":
            setFormError(t("error.emailTaken"));
            break;
          case "VALIDATION_ERROR":
            setFormError(t("error.validation"));
            break;
          default:
            setFormError(t("error.generic"));
        }
        return;
      }

      onSuccess?.();
      startNavigationProgress();
      if (isDemoMode()) {
        landed = true;
        const safe = callbackUrl ? safeRelativePath(callbackUrl) : null;
        const dest = safe ? stripLocalePrefix(safe) : "/account";
        window.location.assign(`/${locale}${dest}`);
        return;
      }
      router.push(
        `/${locale}/auth/verify-email?sent=1${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`,
      );
    } catch {
      setFormError(t("error.generic"));
    } finally {
      if (!landed) {
        setLoading(false);
        useAuthBusyStore.getState().end();
      }
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
          id="register-name"
          type="text"
          label={t("name.label")}
          placeholder={t("name.placeholder")}
          value={name}
          onChange={setName}
          autoComplete="name"
          required
          error={fieldErrors.name}
        />

        <AuthInput
          id="register-email"
          type="email"
          label={t("email.label")}
          placeholder={t("email.placeholder")}
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          error={fieldErrors.email}
        />

        <AuthInput
          id="register-password"
          type="password"
          label={t("password.label")}
          placeholder={t("password.placeholder")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          hint={t("password.hint")}
          error={fieldErrors.password}
        />

        <AuthInput
          id="register-confirm-password"
          type="password"
          label={t("confirmPassword.label")}
          placeholder={t("confirmPassword.placeholder")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          required
          error={fieldErrors.confirmPassword}
        />

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <input
              id="register-terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => {
                setTerms(e.target.checked);
                if (e.target.checked && fieldErrors.terms) {
                  setFieldErrors((prev) => ({ ...prev, terms: undefined }));
                }
              }}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              aria-describedby={
                fieldErrors.terms ? "register-terms-error" : undefined
              }
            />

            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: "1rem",
                height: "1rem",
                marginTop: "0.125rem",
                border: fieldErrors.terms
                  ? "1.5px solid var(--color-auth-error-border)"
                  : "1.5px solid var(--color-auth-input-border)",
                backgroundColor: terms
                  ? "var(--color-action-primary)"
                  : "var(--color-auth-input-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 150ms, border-color 150ms",
              }}
            >
              {terms && <CheckmarkIcon />}
            </span>
            <span
              className="text-body-sm"
              style={{ color: "var(--color-auth-label-text)" }}
            >
              {t("terms.label")}
            </span>
          </label>
          {fieldErrors.terms && (
            <p
              id="register-terms-error"
              role="alert"
              className="text-body-sm"
              style={{
                color: "var(--color-auth-error-text)",
                marginTop: "0.375rem",
                marginInlineStart: "1.625rem",
              }}
            >
              {fieldErrors.terms}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          {loading ? t("submitting") : t("submitButton")}
        </Button>
      </div>
    </form>
  );
}

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
