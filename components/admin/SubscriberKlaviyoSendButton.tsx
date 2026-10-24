"use client";

import { useState, useTransition } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { sendWaitingSubscribersToKlaviyoAction } from "@/lib/actions/newsletter-admin";
import { useSubscriberKlaviyoSendResult } from "@/components/admin/SubscriberKlaviyoSendResult";

interface Props {
  pendingCount: number;
}

export default function SubscriberKlaviyoSendButton({ pendingCount }: Props) {
  const [open, setOpen] = useState(false);
  const { setResult } = useSubscriberKlaviyoSendResult();
  const [pending, startTransition] = useTransition();
  const nothingToSend = pendingCount === 0;

  function handleConfirm() {
    startTransition(async () => {
      const result = await sendWaitingSubscribersToKlaviyoAction();
      if (!result.success) {
        setResult({ ok: false, error: result.error });
      } else {
        setResult({
          ok: true,
          sent: result.data.sent,
          failed: result.data.failed,
          error: result.data.error,
          at: new Date(),
        });
      }
      setOpen(false);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        disabled={pending || nothingToSend}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: "2.5rem",
          paddingInline: "1.25rem",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
          border: "none",
          borderRadius: "0",
          cursor: pending || nothingToSend ? "not-allowed" : "pointer",
          opacity: pending || nothingToSend ? 0.6 : 1,
        }}
      >
        {nothingToSend
          ? "Nothing to send to Klaviyo"
          : `Send ${pendingCount} to Klaviyo`}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title={`Send ${pendingCount} ${pendingCount === 1 ? "subscriber" : "subscribers"} to Klaviyo?`}
        message="People who signed up more than a day ago are added with the date they gave consent here, and Klaviyo sends them no confirmation email. Newer sign-ups are added the same way as a live sign-up."
        confirmLabel="Send to Klaviyo"
        cancelLabel="Cancel"
        isPending={pending}
        destructive={false}
      />
    </div>
  );
}
