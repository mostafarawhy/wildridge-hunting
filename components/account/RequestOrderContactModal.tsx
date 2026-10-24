"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import { requestOrderContactAction } from "@/lib/actions/orders";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

export default function RequestOrderContactModal({
  open,
  onClose,
  orderId,
}: Props) {
  const t = useTranslations("account.orders.contact");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!message.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await requestOrderContactAction({
        orderId,
        message: message.trim(),
      });
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(t(`errors.${result.errorCode}`));
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth={520} ariaLabel={t("title")}>
      <div style={{ padding: "2rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-auth-label-text)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: "0.625rem",
            marginTop: 0,
          }}
        >
          {t("title")}
        </h2>

        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            lineHeight: "var(--leading-relaxed)",
            marginBottom: "1.25rem",
          }}
        >
          {t("intro")}
        </p>

        <label
          style={{
            display: "block",
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-medium)",
            color: "var(--color-auth-label-text)",
            marginBottom: "0.375rem",
          }}
        >
          {t("messageLabel")}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("messagePlaceholder")}
          rows={5}
          style={{
            width: "100%",
            resize: "vertical",
            fontSize: "var(--text-body)",
            color: "var(--color-auth-label-text)",
            backgroundColor: "var(--color-auth-form-bg)",
            border: "1px solid var(--color-auth-form-border)",
            borderRadius: "var(--radius-none)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
          }}
        />

        {error && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
              marginBottom: "1rem",
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !message.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.75rem",
              paddingInline: "1.5rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: "var(--color-action-primary)",
              color: "var(--color-action-primary-fg)",
              borderRadius: "var(--radius-none)",
              border: "none",
              cursor:
                isPending || !message.trim() ? "not-allowed" : "pointer",
              opacity: isPending || !message.trim() ? 0.6 : 1,
            }}
          >
            {t("send")}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: "2.75rem",
              paddingInline: "1.5rem",
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              backgroundColor: "transparent",
              color: "var(--color-auth-label-text)",
              borderRadius: "var(--radius-none)",
              border: "1px solid var(--color-auth-form-border)",
              cursor: "pointer",
              transition:
                "border-color var(--duration-base) var(--ease-default)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-action-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor =
                "var(--color-auth-form-border)";
            }}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
