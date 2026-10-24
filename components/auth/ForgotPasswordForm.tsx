"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { requestPasswordResetAction } from "@/lib/actions/password-reset";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import DemoEmailNote from "@/components/layout/DemoEmailNote";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.passwordReset.request");
  const locale = useLocale();

  function errorMessage(code: string): string {
    switch (code) {
      case "VALIDATION_ERROR":
        return t("error.validation");
      default:
        return t("error.generic");
    }
  }

  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function validateClient(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let error: string | undefined;
    if (!email.trim()) {
      error = t("validation.emailRequired");
    } else if (!emailRegex.test(email)) {
      error = t("validation.emailInvalid");
    }
    setFieldError(error);
    return !error;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;

    setLoading(true);
    try {
      const result = await requestPasswordResetAction({
        email,
        locale: locale as "en" | "ar" | "ru",
      });

      if (!result.success) {
        setFormError(errorMessage(result.errorCode));
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <p
          style={{
            fontSize: "var(--text-eyebrow)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-auth-success-text)",
            marginBottom: "0.75rem",
          }}
        >
          {t("sent.eyebrow")}
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
          {t("sent.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          {t("sent.subtitle")} {t("sent.notice")}
        </p>
        <DemoEmailNote />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <LocaleButtonLink href="/auth/login" variant="primary" size="lg">
            {t("sent.backToLogin")}
          </LocaleButtonLink>
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
            id="forgot-password-email"
            type="email"
            label={t("email.label")}
            placeholder={t("email.placeholder")}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
            error={fieldError}
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
        {t("rememberedPrompt")}{" "}
        <Link
          href="/auth/login"
          style={{
            fontWeight: "var(--font-semibold)",
            color: "var(--color-auth-link)",
          }}
        >
          {t("loginLink")}
        </Link>
      </p>
    </>
  );
}
