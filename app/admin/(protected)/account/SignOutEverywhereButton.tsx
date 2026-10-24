"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { signOutEverywhereAction } from "@/lib/actions/staff";

export default function SignOutEverywhereButton({
  style,
}: {
  style: React.CSSProperties;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      const result = await signOutEverywhereAction();
      if (result.success) {
        window.location.assign("/admin/login?notice=signed-out-everywhere");
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error("Couldn't sign you out everywhere. Please try again.");
    }
    setPending(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" style={style} onClick={() => setOpen(true)}>
        Sign out everywhere
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
        title="Sign out everywhere?"
        message="This ends your session on every device, including this one. You'll need to sign in again."
        confirmLabel="Sign out everywhere"
        cancelLabel="Cancel"
        isPending={pending}
      />
    </>
  );
}
