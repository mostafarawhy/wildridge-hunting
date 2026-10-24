"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isPending?: boolean;
  destructive?: boolean;
  requireTypedConfirm?: boolean;
  typedConfirmText?: string;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isPending = false,
  destructive = true,
  requireTypedConfirm = false,
  typedConfirmText = "DELETE",
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    setTyped("");
  }

  const confirmBlocked =
    requireTypedConfirm && typed.trim() !== typedConfirmText;

  return (
    <Modal open={open} onClose={onClose} ariaLabel={title} maxWidth={400}>
      <div style={{ padding: "2rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-auth-label-text)",
            marginBottom: requireTypedConfirm ? "1rem" : "1.5rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {message}
        </p>
        {requireTypedConfirm && (
          <div style={{ marginBottom: "1.5rem" }}>
            <Input
              id="confirm-typed-input"
              label={`Type ${typedConfirmText} to confirm`}
              type="text"
              dir="ltr"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || confirmBlocked}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              height: "2.5rem",
              paddingInline: "1.25rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: destructive
                ? "var(--color-error)"
                : "var(--color-action-primary)",
              color: "var(--primitive-white)",
              border: "none",
              borderRadius: "var(--radius-none)",
              cursor: isPending || confirmBlocked ? "not-allowed" : "pointer",
              opacity: isPending || confirmBlocked ? 0.6 : 1,
              transition: "opacity 150ms",
            }}
          >
            {isPending && (
              <span
                className="btn-spinner"
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "0.875em",
                  height: "0.875em",
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            )}
            {confirmLabel}
          </button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
