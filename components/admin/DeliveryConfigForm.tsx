"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import { updateDeliveryConfigAction } from "@/lib/actions/settings";

interface Props {
  initial: { staleShippedDays: number };
}

interface FieldErrors {
  staleShippedDays?: string;
}

export default function DeliveryConfigForm({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [daysInput, setDaysInput] = useState(String(initial.staleShippedDays));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setFieldErrors({});

    const parsed = Number(daysInput.trim());
    const staleShippedDays = Number.isNaN(parsed) ? 0 : parsed;

    const result = await updateDeliveryConfigAction({ staleShippedDays });

    if (result.success) {
      toast.success("Delivery settings saved.");
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors) {
      const fe: FieldErrors = {};
      if (result.fieldErrors.staleShippedDays)
        fe.staleShippedDays = result.fieldErrors.staleShippedDays[0];
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
          Delivery confirmation
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <Input
            id="stale-shipped-days"
            label="Follow-up after (days)"
            type="text"
            dir="ltr"
            value={daysInput}
            onChange={(e) => {
              setDaysInput(e.target.value);
              if (fieldErrors.staleShippedDays)
                setFieldErrors((fe) => ({ ...fe, staleShippedDays: undefined }));
            }}
            disabled={isSubmitting}
            error={fieldErrors.staleShippedDays}
            hint="Shipped orders older than this are listed as Awaiting delivery confirmation. Whole days, 1 to 30."
          />
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
