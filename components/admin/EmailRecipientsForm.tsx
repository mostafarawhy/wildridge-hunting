"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { addEmailRecipientAction, removeEmailRecipientAction } from "@/lib/actions/settings";

type Bucket = "sales" | "orders" | "support";

interface Props {
  initial: { sales: string[]; orders: string[]; support: string[] };
}

const BUCKETS: { key: Bucket; label: string; description: string }[] = [
  {
    key: "sales",
    label: "Sales",
    description: "B2B applications, renewals, document updates and quote requests",
  },
  { key: "orders", label: "Orders", description: "New orders" },
  {
    key: "support",
    label: "Support",
    description: "Tickets and customer contact requests",
  },
];

export default function EmailRecipientsForm({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [inputs, setInputs] = useState<Record<Bucket, string>>({
    sales: "",
    orders: "",
    support: "",
  });
  const [errors, setErrors] = useState<Record<Bucket, string | undefined>>({
    sales: undefined,
    orders: undefined,
    support: undefined,
  });
  const [pending, setPending] = useState<Record<Bucket, boolean>>({
    sales: false,
    orders: false,
    support: false,
  });
  const [removeTarget, setRemoveTarget] = useState<{ bucket: Bucket; email: string } | null>(
    null,
  );

  async function handleAdd(bucket: Bucket) {
    const email = inputs[bucket].trim();
    if (!email || pending[bucket]) return;

    setPending((p) => ({ ...p, [bucket]: true }));
    setErrors((e) => ({ ...e, [bucket]: undefined }));

    const result = await addEmailRecipientAction({ bucket, email });

    if (result.success) {
      setInputs((i) => ({ ...i, [bucket]: "" }));
      toast.success("Recipient added.");
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR" && result.fieldErrors?.email) {
      setErrors((e) => ({ ...e, [bucket]: result.fieldErrors!.email![0] }));
    } else {
      setErrors((e) => ({ ...e, [bucket]: result.error }));
    }

    setPending((p) => ({ ...p, [bucket]: false }));
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    const { bucket, email } = removeTarget;

    setPending((p) => ({ ...p, [bucket]: true }));

    const result = await removeEmailRecipientAction({ bucket, email });

    setPending((p) => ({ ...p, [bucket]: false }));
    setRemoveTarget(null);

    if (result.success) {
      toast.success("Recipient removed.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderRadius: "0",
      }}
    >
      <style>{`
        .palm-remove-btn { background: none; border: none; padding: 0; cursor: pointer; font-size: 13px; color: #6b6b6b; line-height: 1; transition: color 120ms; white-space: nowrap; flex-shrink: 0; }
        .palm-remove-btn:hover { color: #991b1b !important; }
        .palm-remove-btn:disabled { opacity: 0.4; cursor: default; }
      `}</style>

      <div style={{ padding: "1.5rem 1.5rem 1.25rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            margin: "0 0 1.25rem",
          }}
        >
          Notification Recipients
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {BUCKETS.map(({ key, label, description }) => {
            const list = initial[key];

            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    paddingBottom: "0.875rem",
                    borderBottom: "1px solid var(--color-shop-divider)",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--font-bold)",
                        color: "#0b0b0b",
                        margin: 0,
                      }}
                    >
                      {label}
                    </h3>
                    <p
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-content-tertiary)",
                        margin: "0.25rem 0 0",
                      }}
                    >
                      {description}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--color-auth-input-placeholder)" }}>
                    {list.length} recipient{list.length === 1 ? "" : "s"}
                  </span>
                </div>

                {list.length === 0 ? (
                  <p
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-content-tertiary)",
                      margin: 0,
                      borderInlineStart: "3px solid var(--color-status-warning)",
                      paddingInlineStart: "0.75rem",
                    }}
                  >
                    Nobody receives {label} notifications. Add at least one address.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {list.map((email) => (
                      <div
                        key={email}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          padding: "0.625rem 0",
                          borderBottom: "1px solid var(--color-shop-divider)",
                        }}
                      >
                        <span dir="ltr" style={{ fontSize: "var(--text-body)", color: "#0b0b0b", fontWeight: 500 }}>
                          {email}
                        </span>

                        <button
                          type="button"
                          className="palm-remove-btn"
                          aria-label={`Remove ${email}`}
                          disabled={pending[key]}
                          onClick={() => setRemoveTarget({ bucket: key, email })}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Input
                      id={`add-${key}-email`}
                      label={`Add ${label.toLowerCase()} recipient`}
                      type="email"
                      dir="ltr"
                      value={inputs[key]}
                      onChange={(e) => {
                        setInputs((i) => ({ ...i, [key]: e.target.value }));
                        if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleAdd(key);
                        }
                      }}
                      disabled={pending[key]}
                      error={errors[key]}
                      placeholder="name@example.com"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!inputs[key].trim() || pending[key]}
                    onClick={() => void handleAdd(key)}
                    style={{
                      padding: "0.625rem 1.125rem",
                      fontSize: "var(--text-body)",
                      backgroundColor:
                        !inputs[key].trim() || pending[key] ? "#e3e3e3" : "#0b0b0b",
                      color: !inputs[key].trim() || pending[key] ? "#9a9a9a" : "#ffffff",
                      border: "1px solid transparent",
                      cursor: !inputs[key].trim() || pending[key] ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      transition: "background-color 120ms, color 120ms",
                      whiteSpace: "nowrap",
                      alignSelf: "flex-end",
                      marginBottom: "0",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!removeTarget || !pending[removeTarget.bucket]) setRemoveTarget(null);
        }}
        onConfirm={() => void handleConfirmRemove()}
        title="Remove recipient"
        message={
          removeTarget
            ? `Remove "${removeTarget.email}" from this list? It will no longer receive these notifications.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        isPending={removeTarget ? pending[removeTarget.bucket] : false}
        destructive
      />
    </div>
  );
}
