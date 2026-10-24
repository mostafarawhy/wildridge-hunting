"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import { requestQuoteContactAction } from "@/lib/actions/quote";

type QuoteContactReason =
  | "PRICING"
  | "SHIPPING"
  | "QUANTITIES"
  | "PAYMENT_TERMS"
  | "OTHER";

const REASONS: QuoteContactReason[] = [
  "PRICING",
  "SHIPPING",
  "QUANTITIES",
  "PAYMENT_TERMS",
  "OTHER",
];

interface Props {
  open: boolean;
  onClose: () => void;
  quoteId: string;
}

export default function RequestQuoteContactModal({
  open,
  onClose,
  quoteId,
}: Props) {
  const t = useTranslations("account.quotes.requestContact");
  const tQuotes = useTranslations("account.quotes");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedReason, setSelectedReason] =
    useState<QuoteContactReason | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSelectReason(reason: QuoteContactReason) {
    const isEmptyOrStarter =
      message === "" ||
      (selectedReason !== null && message === t(`starters.${selectedReason}`));
    if (isEmptyOrStarter) {
      setMessage(t(`starters.${reason}`));
    }
    setSelectedReason(reason);
  }

  function handleSubmit() {
    if (!selectedReason || !message.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await requestQuoteContactAction({
        quoteId,
        reason: selectedReason,
        message: message.trim(),
      });
      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(tQuotes(`errors.${result.errorCode}`));
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

        <p
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-bold)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-content-tertiary)",
            marginBottom: "0.625rem",
          }}
        >
          {t("reasonLabel")}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          {REASONS.map((reason) => {
            const isActive = selectedReason === reason;
            return (
              <button
                key={reason}
                type="button"
                onClick={() => handleSelectReason(reason)}
                style={{
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--font-medium)",
                  padding: "0.5rem 0.875rem",
                  borderRadius: "var(--radius-none)",
                  border: isActive
                    ? "1px solid var(--color-action-primary)"
                    : "1px solid var(--color-auth-form-border)",
                  backgroundColor: isActive
                    ? "var(--color-action-primary)"
                    : "transparent",
                  color: isActive
                    ? "var(--color-action-primary-fg)"
                    : "var(--color-auth-label-text)",
                  cursor: "pointer",
                }}
              >
                {t(`reasons.${reason}`)}
              </button>
            );
          })}
        </div>

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
            disabled={isPending || !selectedReason || !message.trim()}
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
                isPending || !selectedReason || !message.trim()
                  ? "not-allowed"
                  : "pointer",
              opacity:
                isPending || !selectedReason || !message.trim() ? 0.6 : 1,
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
            {tQuotes("cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
