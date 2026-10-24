"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import { updateEmailIdentityAction } from "@/lib/actions/settings";

interface Props {
  initial: { fromName: string; replyTo: string };
  sendingAddress: string;
}

interface FieldErrors {
  fromName?: string;
  replyTo?: string;
}

export default function EmailIdentityForm({ initial, sendingAddress }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setFieldErrors({});

    const result = await updateEmailIdentityAction(form);

    if (result.success) {
      toast.success("Email identity saved.");
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.fromName) fe.fromName = result.fieldErrors.fromName[0];
      if (result.fieldErrors.replyTo) fe.replyTo = result.fieldErrors.replyTo[0];
      setFieldErrors(fe);
    } else {
      toast.error(result.error);
    }

    setIsSubmitting(false);
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "0",
      }}
    >
      <div style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: "0 0 1.25rem",
          }}
        >
          Email Identity
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <Input
            id="from-name"
            label="From name"
            type="text"
            value={form.fromName}
            onChange={(e) => {
              setForm((f) => ({ ...f, fromName: e.target.value }));
              if (fieldErrors.fromName)
                setFieldErrors((fe) => ({ ...fe, fromName: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.fromName}
            optional="(optional)"
            hint="Defaults to your store name if left blank."
          />

          <Input
            id="reply-to"
            label="Reply-to email"
            type="email"
            dir="ltr"
            value={form.replyTo}
            onChange={(e) => {
              setForm((f) => ({ ...f, replyTo: e.target.value }));
              if (fieldErrors.replyTo)
                setFieldErrors((fe) => ({ ...fe, replyTo: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.replyTo}
            optional="(optional)"
            hint="Defaults to your contact email if left blank."
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <span
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-medium)",
                color: "var(--color-auth-label-text)",
              }}
            >
              Sending address
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: "var(--text-body)",
                color: "var(--color-auth-input-text)",
              }}
            >
              {sendingAddress}
            </span>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#9a9a9a",
                margin: 0,
              }}
            >
              Set by the email provider configuration. Contact your developer to change.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-shop-divider)",
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={isSubmitting}
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
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
