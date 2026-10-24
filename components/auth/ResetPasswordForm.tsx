"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import { resetPasswordAction } from "@/lib/actions/password-reset";

interface ResetPasswordFormProps {
  token: string | null;
}

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("auth.passwordReset.reset");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function errorMessage(code: string): string {
    switch (code) {
      case "VALIDATION_ERROR":
        return t("error.validation");
      case "INVALID_TOKEN":
        return t("error.invalidToken");
      case "INACTIVE_ACCOUNT":
        return t("error.inactiveAccount");
      default:
        return t("error.generic");
    }
  }

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/;

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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;
    if (!token) return;

    setLoading(true);
    try {
      const result = await resetPasswordAction({ token, password });

      if (!result.success) {
        setFormError(errorMessage(result.errorCode));
        return;
      }

      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <p
          style={{
            fontSize: "var(--text-eyebrow)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-auth-error-text)",
            marginBottom: "0.75rem",
          }}
        >
          {t("missingToken.eyebrow")}
        </p>
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.25rem",
          }}
        >
          {t("missingToken.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          {t("missingToken.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <LocaleButtonLink href="/auth/forgot-password" variant="primary" size="lg">{t("missingToken.button")}</LocaleButtonLink>
        </div>

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-label-text)",
            marginTop: "1.5rem",
            textAlign: "center",
          }}
        >
          <Link
            href="/auth/login"
            style={{
              fontWeight: "var(--font-semibold)",
              color: "var(--color-auth-link)",
            }}
          >
            {t("backToLogin")}
          </Link>
        </p>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1
          style={{
            fontSize: "var(--text-heading)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.25rem",
          }}
        >
          {t("success.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          {t("success.subtitle")} {t("success.notice")}
        </p>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <LocaleButtonLink href="/auth/login" variant="primary" size="lg">{t("success.signInLink")}</LocaleButtonLink>
        </div>
      </>
    );
  }

  return (
    <>
      <h1
        style={{
          fontSize: "var(--text-heading)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--color-auth-label-text)",
          marginBottom: "0.25rem",
        }}
      >
        {t("title")}
      </h1>
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-input-placeholder)",
          marginBottom: "2rem",
        }}
      >
        {t("subtitle")}
      </p>

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
            id="reset-password"
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
            id="reset-confirm-password"
            type="password"
            label={t("confirmPassword.label")}
            placeholder={t("confirmPassword.placeholder")}
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
            {loading ? t("submitting") : t("submitButton")}
          </Button>
        </div>
      </form>

      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-label-text)",
          marginTop: "1.5rem",
          textAlign: "center",
        }}
      >
        <Link
          href="/auth/forgot-password"
          style={{
            fontWeight: "var(--font-semibold)",
            color: "var(--color-auth-link)",
          }}
        >
          {t("requestNewLink")}
        </Link>
      </p>
    </>
  );
}
