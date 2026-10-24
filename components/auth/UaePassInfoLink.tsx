"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

const UAE_PASS_SIGNUP_URL = "https://uaepass.ae/signup";

interface UaePassInfoLinkProps {
  align?: "center" | "start";
}

export default function UaePassInfoLink({
  align = "center",
}: UaePassInfoLinkProps) {
  const t = useTranslations("auth.uaePass");
  const [showInfo, setShowInfo] = useState(false);
  const reactId = useId();

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        gap: "0.625rem",
      }}
    >
      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        aria-expanded={showInfo}
        aria-controls={reactId}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "var(--text-body-sm)",
          color: "var(--color-auth-input-placeholder)",
        }}
      >
        {t("whatIs")}
        <InfoIcon />
      </button>

      {showInfo && (
        <p
          id={reactId}
          role="note"
          style={{
            position: "absolute",
            top: "100%",
            marginTop: "0.5rem",
            zIndex: "var(--z-dropdown)",
            width: "18rem",
            ...(align === "start"
              ? { insetInlineStart: 0 }
              : { insetInlineStart: 0, insetInlineEnd: 0, marginInline: "auto" }),
            textAlign: align === "start" ? "start" : "center",
            fontSize: "var(--text-body-sm)",
            lineHeight: 1.5,
            color: "var(--color-auth-label-text)",
            backgroundColor: "var(--color-auth-input-bg)",
            border: "1px solid var(--color-auth-divider)",
            borderRadius: "var(--radius-none)",
            padding: "0.625rem 0.75rem",
          }}
        >
          {t("tooltip")}
          <br />
          <a
            href={UAE_PASS_SIGNUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--color-auth-link)",
              fontWeight: "var(--font-semibold)",
              borderRadius: "var(--radius-none)",
            }}
          >
            {t("createAccount")}
          </a>
        </p>
      )}
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 11v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
