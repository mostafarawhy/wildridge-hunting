"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import AuthInput from "@/components/auth/AuthInput";
import Button from "@/components/ui/Button";
import { isDemoMode } from "@/lib/config/demo";
import { staffDemoLoginAction, staffLoginAction } from "@/lib/actions/staff-auth";

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function StaffLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateClient(): boolean {
    const errors: FieldErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleDemoLogin() {
    setFormError(null);
    setLoading(true);
    try {
      const result = await staffDemoLoginAction();
      if (!result.success) {
        setFormError("Demo access is not available right now.");
        return;
      }
      startNavigationProgress("/admin");
      router.push("/admin");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validateClient()) return;

    setLoading(true);
    try {
      const result = await staffLoginAction({ email, password });

      if (!result.success) {
        switch (result.errorCode) {
          case "INVALID_CREDENTIALS":
            setFormError("Invalid email or password.");
            break;
          case "INACTIVE_ACCOUNT":
            setFormError("This account has been deactivated.");
            break;
          default:
            setFormError("Something went wrong. Please try again.");
        }
        return;
      }

      startNavigationProgress("/admin");
      router.push("/admin");
    } finally {
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
          id="staff-login-email"
          type="email"
          label="Email"
          placeholder="your@email.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          error={fieldErrors.email}
        />

        <AuthInput
          id="staff-login-password"
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          error={fieldErrors.password}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        {isDemoMode() && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={loading}
            onClick={handleDemoLogin}
          >
            Enter as demo staff
          </Button>
        )}
      </div>
    </form>
  );
}
