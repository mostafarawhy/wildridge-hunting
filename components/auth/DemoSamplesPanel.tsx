"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import { isDemoMode } from "@/lib/config/demo";

interface DemoSamplesPanelProps {
  attached: boolean;
  onUse: () => void;
  onUndo: () => void;
  disabled?: boolean;
}

export default function DemoSamplesPanel({
  attached,
  onUse,
  onUndo,
  disabled,
}: DemoSamplesPanelProps) {
  const t = useTranslations("demo.samples");

  if (!isDemoMode()) return null;

  const box = {
    backgroundColor: "var(--color-auth-input-bg)",
    border: "1px solid var(--color-auth-input-border)",
    borderRadius: 0,
    padding: "0.75rem 1rem",
  } as const;

  if (attached) {
    return (
      <div
        style={{
          ...box,
          borderInlineStart: "3px solid var(--color-positive)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <span
          className="font-medium"
          style={{ color: "var(--color-positive)" }}
        >
          {t("attached")}
        </span>
        <button
          type="button"
          onClick={onUndo}
          style={{
            textDecoration: "underline",
            color: "var(--color-action-primary)",
            minHeight: "44px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {t("undo")}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        ...box,
        borderInlineStart: "3px solid var(--color-action-primary)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <span
        className="text-body-sm font-medium"
        style={{ color: "var(--color-action-primary)" }}
      >
        {t("title")}
      </span>
      <p
        className="text-body-sm"
        style={{ color: "var(--color-auth-label-text)" }}
      >
        {t("hint")}
      </p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        fullWidth
        disabled={disabled}
        onClick={onUse}
      >
        {t("use")}
      </Button>
    </div>
  );
}
