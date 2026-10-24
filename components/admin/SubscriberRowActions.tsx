"use client";

import { useState, useTransition } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { unsubscribeSubscriberAction } from "@/lib/actions/newsletter-admin";

interface Props {
  id: string;
}

export default function SubscriberRowActions({ id }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await unsubscribeSubscriberAction(id);
      if (!result.success) {
        setError(result.error);
      }
      setOpen(false);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "0.25rem",
      }}
    >
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "var(--text-body-sm)",
          color: "#991b1b",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Mark unsubscribed
      </button>
      {error && (
        <p
          role="alert"
          style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}
        >
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="Mark this subscriber unsubscribed?"
        message="They stay in this list as unsubscribed. This doesn't change Klaviyo, so unsubscribe them there too."
        confirmLabel="Mark unsubscribed"
        cancelLabel="Cancel"
        isPending={pending}
      />
    </div>
  );
}
