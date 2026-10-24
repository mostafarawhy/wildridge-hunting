"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const commitButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  transition: "opacity 150ms",
  backgroundColor: "var(--color-action-primary)",
  color: "#ffffff",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

export default function AdminErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div
      style={{
        ...cardStyle,
        padding: "1.5rem",
        maxWidth: "36rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0b0b0b" }}>
        Something went wrong
      </h1>
      <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "#374151" }}>
        This page hit an error and couldn&apos;t load. Try again, or go back to the
        dashboard. If it keeps happening, send the reference below to the developer.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={retry} style={commitButtonStyle}>
          Try again
        </button>
        <Link
          href="/admin"
          style={{
            ...secondaryButtonStyle,
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "underline",
          }}
        >
          Back to dashboard
        </Link>
      </div>
      {error.digest && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b6b6b" }}>
          Reference: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
        </p>
      )}
    </div>
  );
}
