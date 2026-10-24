"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  initiateUaePassLoginAction,
  type UaePassLoginMode,
} from "@/lib/actions/auth";
import { isUaePassEnabled } from "@/lib/env.client";
import UaePassInfoLink from "@/components/auth/UaePassInfoLink";

interface UaePassButtonProps {
  /** Where to redirect after successful UAE Pass login + verification. */
  callbackUrl: string;
  /** "sign-in" on the login page, "sign-up" on the register page — per UAE Pass button-usage guidelines. */
  mode: UaePassLoginMode;
}

function getAssetPath(mode: UaePassLoginMode, locale: string) {
  const slug = mode === "sign-in" ? "sign-in" : "sign-up";
  const localeSlug = locale === "ar" ? "ar" : "en";
  return `/uae-pass/${slug}-black-${localeSlug}.png`;
}

export default function UaePassButton({
  callbackUrl,
  mode,
}: UaePassButtonProps) {
  const locale = useLocale() as "en" | "ar" | "ru";
  const t = useTranslations("auth.uaePass");
  const enabled = isUaePassEnabled();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await initiateUaePassLoginAction({
        locale,
        callbackUrl,
        mode,
      });
      if (!result.success) {
        setError(t("errors.generic"));
        setLoading(false);
        return;
      }
      window.location.href = result.redirectUrl;
    } catch {
      setError(t("errors.generic"));
      setLoading(false);
    }
  }

  const ctaLabel = t(mode === "sign-in" ? "cta.signIn" : "cta.signUp");

  if (!enabled) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={ctaLabel}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          width: "100%",
          minWidth: "140px",
          minHeight: "30px",
          aspectRatio: "310 / 54",
          position: "relative",
          border: "none",
          background: "none",
          padding: 0,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "opacity var(--duration-base)",
        }}
      >
        <Image
          src={getAssetPath(mode, locale)}
          alt={ctaLabel}
          fill
          priority
          style={{ objectFit: "contain" }}
        />
      </button>

      <UaePassInfoLink />

      {error && (
        <p
          role="alert"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-auth-error-text)",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
