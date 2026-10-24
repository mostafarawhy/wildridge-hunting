"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import UaePassInfoLink from "@/components/auth/UaePassInfoLink";
import { isUaePassEnabled } from "@/lib/env.client";
import { initiateUaePassLinkAction } from "@/lib/actions/verification";

interface Props {
  isLinked: boolean;
  locale: "en" | "ar" | "ru";
}

const sectionCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "var(--color-action-primary)",
  margin: 0,
};

const sectionHint: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-content-tertiary)",
  margin: 0,
};

const cardBase: React.CSSProperties = {
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "var(--radius-none)",
  padding: "1.25rem",
  backgroundColor: "#fff",
  textAlign: "start",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "0.625rem",
};

export default function UaePassLinkSection({ isLinked, locale }: Props) {
  const t = useTranslations("account.settings.uaePass");
  const router = useRouter();
  const enabled = isUaePassEnabled();

  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLink() {
    setPending(true);
    setErrorMessage(null);
    try {
      const result = await initiateUaePassLinkAction({ locale });
      if (result.success) {
        window.location.href = result.data.redirectUrl;
        return;
      }
      if (result.errorCode === "ALREADY_LINKED") {
        router.refresh();
        setPending(false);
        return;
      }
      if (result.errorCode === "UNAUTHENTICATED") {
        setErrorMessage(t("errors.sessionExpired"));
      } else {
        setErrorMessage(t("errors.generic"));
      }
      setPending(false);
    } catch {
      setErrorMessage(t("errors.generic"));
      setPending(false);
    }
  }

  if (!enabled) return null;

  return (
    <div style={sectionCard}>
      <div>
        <p style={sectionTitle}>{t("title")}</p>
        <p style={{ ...sectionHint, marginTop: "0.25rem" }}>{t("hint")}</p>
      </div>

      {isLinked ? (
        <div
          style={{
            ...cardBase,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "var(--primitive-black)",
                margin: 0,
              }}
            >
              {t("linkedTitle")}
            </p>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-content-tertiary)",
                marginTop: "0.25rem",
                marginBottom: 0,
              }}
            >
              {t("linkedBody")}
            </p>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
              padding: "0.1875rem 0.5rem",
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-black)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              backgroundColor: "transparent",
              border: "1px solid var(--primitive-green)",
              color: "var(--primitive-green)",
              borderRadius: "var(--radius-none)",
              whiteSpace: "nowrap",
            }}
          >
            {t("linkedBadge")}
          </span>
        </div>
      ) : (
        <div style={{ ...cardBase, opacity: pending ? 0.7 : 1 }}>
          <p
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-semibold)",
              color: "var(--primitive-black)",
              margin: 0,
            }}
          >
            {t("linkTitle")}
          </p>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              lineHeight: "var(--leading-relaxed)",
              margin: 0,
            }}
          >
            {t("linkBody")}
          </p>
          <button
            type="button"
            onClick={handleLink}
            disabled={pending}
            style={{
              display: "block",
              border: "none",
              background: "none",
              padding: 0,
              textAlign: "start",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            <Image
              src={`/uae-pass/continue-black-${locale === "ar" ? "ar" : "en"}.png`}
              alt={t("linkCta")}
              width={310}
              height={54}
              style={{
                height: "44px",
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
                minWidth: "140px",
                minHeight: "30px",
              }}
            />
          </button>
          {errorMessage && (
            <p
              role="alert"
              style={{
                color: "var(--color-status-danger)",
                fontSize: "var(--text-body-sm)",
                margin: 0,
              }}
            >
              {errorMessage}
            </p>
          )}
          <UaePassInfoLink align="start" />
        </div>
      )}
    </div>
  );
}
