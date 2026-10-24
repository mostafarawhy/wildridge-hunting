"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { isDemoMode } from "@/lib/config/demo";
import {
  createDemoAccountAction,
  type DemoAccessKind,
} from "@/lib/actions/demo-access";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { signInLandingPath } from "@/lib/utils/auth-landing";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";

interface DemoAccessButtonsProps {
  callbackUrl?: string | null;
  onSuccess?: () => void;
}

export default function DemoAccessButtons({
  callbackUrl,
  onSuccess,
}: DemoAccessButtonsProps) {
  const t = useTranslations("demo.access");
  const locale = useLocale() as "en" | "ar" | "ru";
  const [pending, setPending] = useState<DemoAccessKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isDemoMode()) return null;

  async function enter(kind: DemoAccessKind) {
    setPending(kind);
    setError(null);
    useAuthBusyStore.getState().begin("sign-in");
    let landed = false;
    try {
      const result = await createDemoAccountAction(kind, locale);
      if (!result.success) {
        setError(
          result.errorCode === "RATE_LIMITED" ? t("rateLimited") : t("error"),
        );
        return;
      }
      landed = true;
      const landing = signInLandingPath(locale, callbackUrl);
      onSuccess?.();
      startNavigationProgress();
      window.location.assign(landing);
    } catch {
      setError(t("error"));
    } finally {
      if (!landed) {
        setPending(null);
        useAuthBusyStore.getState().end();
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginBottom: "0" }}>
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-input-placeholder)",
          margin: 0,
        }}
      >
        {t("hint")}
      </p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        loading={pending === "customer"}
        disabled={pending !== null}
        onClick={() => enter("customer")}
      >
        {t("customer")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        loading={pending === "business"}
        disabled={pending !== null}
        onClick={() => enter("business")}
      >
        {t("business")}
      </Button>
      {error && (
        <p
          role="alert"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBlock: "0.25rem 1.25rem",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: "var(--color-auth-divider)",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-input-placeholder)",
            whiteSpace: "nowrap",
          }}
        >
          {t("divider")}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: "var(--color-auth-divider)",
          }}
        />
      </div>
    </div>
  );
}
