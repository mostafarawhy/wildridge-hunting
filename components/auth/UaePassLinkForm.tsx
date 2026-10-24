"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import { linkUaePassAccountAction } from "@/lib/actions/uae-pass-link";

interface UaePassLinkFormProps {
  token: string | null;
  notice: string | null;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function UaePassLinkForm({
  token,
  notice,
}: UaePassLinkFormProps) {
  const t = useTranslations("auth.uaePassLink");
  const tLogin = useTranslations("auth.login");

  const [step, setStep] = useState<"choice" | "credentials">("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  function errorMessage(code: string): string {
    switch (code) {
      case "VALIDATION_ERROR":
        return t("error.validation");
      case "CREDENTIALS_NOT_MATCHED":
        return t("error.credentials");
      case "INACTIVE_ACCOUNT":
        return t("error.inactiveAccount");
      case "NO_PASSWORD":
        return t("error.noPassword");
      case "ALREADY_LINKED":
        return t("error.alreadyLinked");
      case "TOO_MANY_ATTEMPTS":
        return t("error.tooManyAttempts");
      default:
        return t("error.generic");
    }
  }

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = tLogin("validation.emailRequired");
    } else if (!emailRegex.test(email)) {
      errors.email = tLogin("validation.emailInvalid");
    }
    if (!password) {
      errors.password = tLogin("validation.passwordRequired");
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
      const result = await linkUaePassAccountAction({ token, email, password });

      if (!result.success) {
        if (result.errorCode === "INVALID_TOKEN") {
          setLoading(false);
          setExpired(true);
          return;
        }
        setLoading(false);
        setFormError(errorMessage(result.errorCode));
        return;
      }

      window.location.href = result.data.callbackUrl;
    } catch {
      setFormError(t("error.generic"));
      setLoading(false);
    }
  }

  if (!token || expired) {
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
          {t("expired.eyebrow")}
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
          {t("expired.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "2rem",
          }}
        >
          {t("expired.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <LocaleButtonLink href="/auth/login" variant="primary" size="lg">
            {t("expired.button")}
          </LocaleButtonLink>
        </div>
      </>
    );
  }

  if (step === "choice") {
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
          {t("choice.title")}
        </h1>
        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginBottom: "1.5rem",
          }}
        >
          {notice === "existing"
            ? t("choice.existingNotice")
            : t("choice.subtitle")}
        </p>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-auth-label-text)",
            marginBottom: "1rem",
          }}
        >
          {t("choice.question")}
        </p>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setStep("credentials")}
          >
            {t("choice.hasAccount")}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => {
              setLoading(true);
              window.location.href = `/api/identity/uae-pass/link-create?token=${encodeURIComponent(token)}`;
            }}
            loading={loading}
            disabled={loading}
          >
            {loading ? t("choice.creating") : t("choice.noAccount")}
          </Button>
        </div>

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            marginTop: "1.5rem",
            textAlign: "center",
          }}
        >
          {t("choice.notice")}
        </p>
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
        {t("credentials.title")}
      </h1>
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-input-placeholder)",
          marginBottom: "2rem",
        }}
      >
        {t("credentials.subtitle")}
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
            id="uae-pass-link-email"
            type="email"
            label={tLogin("email.label")}
            placeholder={tLogin("email.placeholder")}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
            error={fieldErrors.email}
          />

          <div>
            <AuthInput
              id="uae-pass-link-password"
              type="password"
              label={tLogin("password.label")}
              placeholder={tLogin("password.placeholder")}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
              error={fieldErrors.password}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.5rem",
              }}
            >
              <Link
                href="/auth/forgot-password"
                className="text-body-sm"
                style={{
                  fontWeight: "var(--font-semibold)",
                  color: "var(--color-auth-link)",
                }}
              >
                {tLogin("forgotPassword")}
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {loading
              ? t("credentials.submitting")
              : t("credentials.submitButton")}
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
        <button
          type="button"
          onClick={() => {
            setStep("choice");
            setFormError(null);
            setFieldErrors({});
          }}
          disabled={loading}
          style={{
            fontWeight: "var(--font-semibold)",
            color: "var(--color-auth-link)",
            background: "none",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            padding: 0,
          }}
        >
          {t("credentials.back")}
        </button>
      </p>
    </>
  );
}
