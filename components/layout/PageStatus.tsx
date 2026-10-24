import { BRAND } from "@/lib/config/brand";
import type { CSSProperties, ReactNode } from "react";

interface PageStatusProps {
  eyebrow: string;
  title: string;
  body: string;
  action: ReactNode;
  secondary?: ReactNode;
  footnote?: ReactNode;
  standalone?: boolean;
}

const wordmarkStyle: CSSProperties = {
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-black)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-auth-label-text)",
  marginBottom: "2.5rem",
  textAlign: "center",
};

const eyebrowStyle: CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-auth-error-text)",
  marginBottom: "0.75rem",
};

const titleStyle: CSSProperties = {
  fontSize: "var(--text-heading)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-tight)",
  color: "var(--color-auth-label-text)",
  marginBottom: "0.25rem",
};

const bodyStyle: CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  marginBottom: "2rem",
};

const secondaryStyle: CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-label-text)",
  marginTop: "1.5rem",
  textAlign: "center",
};

const footnoteStyle: CSSProperties = {
  fontSize: "var(--text-label)",
  color: "var(--color-auth-input-placeholder)",
  marginTop: "2rem",
  paddingTop: "1.25rem",
  borderTop: "1px solid var(--color-auth-divider)",
  textAlign: "center",
};

export const statusLinkStyle: CSSProperties = {
  fontWeight: "var(--font-semibold)",
  color: "var(--color-auth-link)",
};

export default function PageStatus({
  eyebrow,
  title,
  body,
  action,
  secondary,
  footnote,
  standalone = false,
}: PageStatusProps) {
  return (
    <section
      style={{
        minHeight: standalone ? "100dvh" : "calc(100dvh - var(--spacing-header))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-auth-form-bg)",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <p style={wordmarkStyle}>{BRAND.name}</p>
        <p style={eyebrowStyle}>{eyebrow}</p>
        <h1 style={titleStyle}>{title}</h1>
        <p style={bodyStyle}>{body}</p>
        <div style={{ display: "flex", flexDirection: "column" }}>{action}</div>
        {secondary && <p style={secondaryStyle}>{secondary}</p>}
        {footnote && <p style={footnoteStyle}>{footnote}</p>}
      </div>
    </section>
  );
}
