"use client";

import { useState } from "react";

export default function CopyTextButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "#6b6b6b",
        textDecoration: "underline",
        fontSize: "var(--text-body-sm)",
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
