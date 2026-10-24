"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
  label?: string;
}

export default function CopyCodeButton({ code, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span aria-live="polite">
      <button
        type="button"
        aria-label={`Copy code ${code}`}
        onClick={(e) => void copy(e)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "var(--text-body)",
          color: "#0b0b0b",
          textDecoration: "underline",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied" : label}
      </button>
    </span>
  );
}
