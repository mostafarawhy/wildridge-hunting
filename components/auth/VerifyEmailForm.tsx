"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import { LocaleButtonLink } from "@/components/ui/ButtonLink";
import { confirmEmailVerificationAction } from "@/lib/actions/email-verification";

interface VerifyEmailFormProps {
  token: string | null;
  sent: boolean;
  callbackUrl: string | null;
}

export default function VerifyEmailForm({
  token,
  sent,
  callbackUrl,
}: VerifyEmailFormProps) {
  const t = useTranslations("auth.emailVerification");

  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const loginHref = callbackUrl
    ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/login";

  function errorMessage(code: string): string {
    switch (code) {
      case "INVALID_TOKEN":
        return t("error.invalidToken");
      case "VALIDATION_ERROR":
        return t("error.validation");
      default:
        return t("error.generic");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!token) return;

    setLoading(true);
    try {
      const result = await confirmEmailVerificationAction({ token });

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

          <div style={{ display: "flex", flexDirection: "column" }}>
            <LocaleButtonLink href={loginHref} variant="primary" size="lg">
              {t("sent.backToLogin")}
            </LocaleButtonLink>
          </div>
        </>
      );
    }

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
          <LocaleButtonLink href={loginHref} variant="primary" size="lg">
            {t("missingToken.button")}
          </LocaleButtonLink>
        </div>
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
          {t("success.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <LocaleButtonLink href={loginHref} variant="primary" size="lg">
            {t("success.signInLink")}
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
        {t("confirm.title")}
      </h1>
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-input-placeholder)",
          marginBottom: "2rem",
        }}
      >
        {t("confirm.subtitle")}
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {loading ? t("confirm.submitting") : t("confirm.submitButton")}
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
          href={loginHref}
          style={{
            fontWeight: "var(--font-semibold)",
            color: "var(--color-auth-link)",
          }}
        >
          {t("sent.backToLogin")}
        </Link>
      </p>
    </>
  );
}
