"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { subscribeNewsletterAction } from "@/lib/actions/newsletter";
import type { SubscribeNewsletterErrorCode } from "@/lib/actions/newsletter";
import { popupCtaClass, popupCtaStyle } from "@/components/layout/HomePopupView";
import type { HomePopupButtonColor } from "@/lib/utils/home-popup";
import DemoEmailNote from "@/components/layout/DemoEmailNote";

const POPUP_SIGNUP_CTA_CLASS = popupCtaClass.replace("mt-7", "mt-3");

interface PopupNewsletterFieldsProps {
  tone: "dark" | "light";
  placeholder: string;
  buttonLabel: string;
  buttonColor: HomePopupButtonColor;
  consentPrefix: string;
  privacyLink: ReactNode;
  consentSuffix: string;
  pending?: boolean;
  error?: string | null;
  inert?: boolean;
}

export function PopupNewsletterFields({
  tone,
  placeholder,
  buttonLabel,
  buttonColor,
  consentPrefix,
  privacyLink,
  consentSuffix,
  pending = false,
  error = null,
  inert = false,
}: PopupNewsletterFieldsProps) {
  const light = tone === "light";

  return (
    <div inert={inert}>
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder={placeholder}
        aria-label={placeholder}
        className={`h-12 w-full px-4 text-body-sm tracking-wide outline-none min-w-0 ${
          light
            ? "placeholder:text-[rgba(11,11,11,0.5)]"
            : "placeholder:text-[rgba(255,255,255,0.55)]"
        }`}
        style={{
          backgroundColor: light
            ? "var(--color-auth-input-bg)"
            : "rgba(255,255,255,0.06)",
          border: light
            ? "1px solid var(--color-auth-input-border)"
            : "1px solid rgba(255,255,255,0.25)",
          color: light ? "var(--primitive-black)" : "var(--primitive-white)",
        }}
      />
      <button
        type="submit"
        disabled={pending}
        className={POPUP_SIGNUP_CTA_CLASS}
        style={popupCtaStyle(buttonColor)}
      >
        {buttonLabel}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-3 text-label tracking-wide"
          style={{
            color: light ? "var(--color-error)" : "var(--color-error-on-dark)",
          }}
        >
          {error}
        </p>
      )}
      <p
        className="mt-3 text-label tracking-wide"
        style={{
          color: light ? "rgba(11,11,11,0.6)" : "rgba(255,255,255,0.55)",
        }}
      >
        {consentPrefix} {privacyLink}
        {". "}
        {consentSuffix}
      </p>
    </div>
  );
}

interface NewsletterFormProps {
  source: "HOME" | "POPUP";
  tone?: "section" | "dark" | "light";
  buttonLabel?: string;
  buttonColor?: HomePopupButtonColor;
  onSubscribed?: () => void;
}

export default function NewsletterForm({
  source,
  tone = "section",
  buttonLabel,
  buttonColor = "gold",
  onSubscribed,
}: NewsletterFormProps) {
  const t = useTranslations("newsletter");
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [errorCode, setErrorCode] =
    useState<SubscribeNewsletterErrorCode | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const website = String(data.get("website") ?? "");

    setErrorCode(null);
    startTransition(async () => {
      const result = await subscribeNewsletterAction({
        email,
        source,
        website,
      });
      if (result.success) {
        setDone(true);
        onSubscribed?.();
      } else {
        setErrorCode(result.errorCode);
      }
    });
  }

  if (done) {
    const successColor =
      tone === "light"
        ? "var(--primitive-black)"
        : tone === "dark"
          ? "var(--primitive-white)"
          : "var(--color-content-primary)";
    return (
      <div role="status" style={{ color: successColor }}>
        <p className="text-body-sm tracking-wide">{t("success")}</p>
        <DemoEmailNote />
      </div>
    );
  }

  const honeypot = (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      aria-hidden="true"
      autoComplete="off"
      defaultValue=""
      style={{
        position: "absolute",
        insetInlineStart: "-9999px",
        width: "1px",
        height: "1px",
        opacity: 0,
      }}
    />
  );

  const errorText = errorCode ? t(`errors.${errorCode}`) : null;

  if (tone !== "section") {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative mt-6"
      >
        <PopupNewsletterFields
          tone={tone}
          placeholder={tCommon("email_placeholder")}
          buttonLabel={buttonLabel || tCommon("subscribe")}
          buttonColor={buttonColor}
          consentPrefix={tHome("newsletter_legal_prefix")}
          privacyLink={
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-opacity duration-150 hover:opacity-70"
              style={{ color: "inherit" }}
            >
              {tHome("newsletter_legal_link")}
            </Link>
          }
          consentSuffix={tHome("newsletter_legal_suffix")}
          pending={pending}
          error={errorText}
        />
        {honeypot}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="relative">
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={tCommon("email_placeholder")}
          className="sm:flex-1 h-12 px-4 text-body-sm tracking-wide bg-transparent outline-none min-w-0 sm:[border-inline-end:none]"
          style={{
            border: "1px solid var(--color-border-default)",
            color: "var(--color-content-primary)",
          }}
          aria-label={tCommon("email_placeholder")}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full sm:w-auto px-7 text-label tracking-widest uppercase font-medium shrink-0 transition-opacity duration-150 hover:opacity-85"
          style={{
            backgroundColor: "var(--color-action-primary)",
            color: "var(--color-action-primary-fg)",
            border: "1px solid var(--color-action-primary)",
          }}
        >
          {tCommon("subscribe")}
        </button>
      </div>
      {honeypot}
      {errorText && (
        <p
          role="alert"
          className="mt-3 text-label tracking-wide"
          style={{ color: "var(--color-error-on-dark)" }}
        >
          {errorText}
        </p>
      )}
    </form>
  );
}
