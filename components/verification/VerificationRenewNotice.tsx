"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type VerificationRenewNoticeProps =
  | { href: string; onRenew?: never }
  | { onRenew: () => void; href?: never };

const ACTION_STYLE = {
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  color: "var(--color-action-primary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
} as const;

export default function VerificationRenewNotice(
  props: VerificationRenewNoticeProps,
) {
  const t = useTranslations("checkout.verify");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderTop: "none",
        borderInlineStart: "3px solid var(--color-status-warning)",
        borderRadius: "var(--radius-none)",
        padding: "0.625rem 1rem",
      }}
    >
      <p
        style={{
          fontSize: "var(--text-body-sm)",
          color: "var(--primitive-black)",
          margin: 0,
        }}
      >
        {t("approved.renewNotice")}
      </p>
      {props.href !== undefined ? (
        <Link
          href={props.href}
          style={{ ...ACTION_STYLE, textDecoration: "none" }}
        >
          {t("approved.renewCta")}
        </Link>
      ) : (
        <button type="button" onClick={props.onRenew} style={ACTION_STYLE}>
          {t("approved.renewCta")}
        </button>
      )}
    </div>
  );
}
