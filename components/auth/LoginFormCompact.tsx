"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { loginAction } from "@/lib/actions/auth";
import { resendEmailVerificationAction } from "@/lib/actions/email-verification";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";
import { signInLandingPath } from "@/lib/utils/auth-landing";

interface LoginFormCompactProps {
  callbackUrl?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginFormCompact({
  callbackUrl,
}: LoginFormCompactProps) {
  const t = useTranslations("auth.login");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = t("validation.emailRequired");
    } else if (!emailRegex.test(email)) {
      errors.email = t("validation.emailInvalid");
    }
    if (!password) {
      errors.password = t("validation.passwordRequired");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setUnverified(false);
    setResendState("idle");

    if (!validateClient()) return;

    setLoading(true);
    useAuthBusyStore.getState().begin("sign-in");
    let landed = false;
    try {
      const result = await loginAction({ email, password });

      if (!result.success) {
        switch (result.errorCode) {
          case "INVALID_CREDENTIALS":
            setFormError(t("error.invalidCredentials"));
            break;
          case "INACTIVE_ACCOUNT":
            setFormError(t("error.inactiveAccount"));
            break;
          case "EMAIL_NOT_VERIFIED":
            setFormError(t("error.emailNotVerified"));
            setUnverified(true);
            break;
          case "VALIDATION_ERROR":
            setFormError(t("error.validation"));
            break;
          default:
            setFormError(t("error.generic"));
        }
        return;
      }

      landed = true;
      startNavigationProgress();
      window.location.assign(signInLandingPath(locale, callbackUrl));
    } catch {
      setFormError(t("error.generic"));
    } finally {
      if (!landed) {
        setLoading(false);
        useAuthBusyStore.getState().end();
      }
    }
  }

  async function handleResend() {
    setResendState("sending");
    try {
      const result = await resendEmailVerificationAction({ email, password });
      if (!result.success) {
        setFormError(t("error.generic"));
        setResendState("idle");
        return;
      }
      setResendState("sent");
    } catch {
      setFormError(t("error.generic"));
      setResendState("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {resendState === "sent" ? (
          <div
            role="status"
            style={{
              backgroundColor: "var(--color-auth-success-bg)",
              border: "1px solid var(--color-auth-success-border)",
              color: "var(--color-auth-success-text)",
              padding: "0.75rem 1rem",
              fontSize: "var(--text-body-sm)",
            }}
          >
            {t("resend.sent")}
          </div>
        ) : (
          formError && (
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
          )
        )}

        {unverified && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === "sending"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-auth-link)",
              textAlign: "start",
              alignSelf: "flex-start",
            }}
          >
            {resendState === "sending"
              ? t("resend.sending")
              : t("resend.button")}
          </button>
        )}

        <AuthInput
          id="compact-login-email"
          type="email"
          label={t("email.label")}
          placeholder={t("email.placeholder")}
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          error={fieldErrors.email}
        />

        <div>
          <AuthInput
            id="compact-login-password"
            type="password"
            label={t("password.label")}
            placeholder={t("password.placeholder")}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
            error={fieldErrors.password}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <Link
              href="/auth/forgot-password"
              className="text-body-sm"
              style={{
                fontWeight: "var(--font-semibold)",
                color: "var(--color-auth-link)",
              }}
            >
              {t("forgotPassword")}
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
          {loading ? t("submitting") : t("submitButton")}
        </Button>
      </div>
    </form>
  );
}
