"use client";

import { useState } from "react";
import { getImportFileUrlAction } from "@/lib/actions/catalog-import";

interface Props {
  batchId: string;
  filename: string;
  variant: "button" | "compact";
}

function triggerBrowserDownload(url: string, filename: string): void {
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
}

const buttonStyle: React.CSSProperties = {
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
  cursor: "pointer",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
};

const compactStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2rem",
  paddingInline: 0,
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "transparent",
  color: "#0b0b0b",
  border: "none",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  borderRadius: "0",
  cursor: "pointer",
};

export default function ImportFileDownloadButton({ batchId, filename, variant }: Props) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setPending(true);
    setFailed(false);
    const result = await getImportFileUrlAction(batchId);
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    triggerBrowserDownload(result.data.url, filename);
  }

  if (failed) {
    return (
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Unavailable
      </span>
    );
  }

  const idleLabel = variant === "button" ? "Download original file" : "Download";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={variant === "button" ? buttonStyle : compactStyle}
    >
      {pending ? "Preparing…" : idleLabel}
    </button>
  );
}
