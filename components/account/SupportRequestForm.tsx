"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { formatShortDate } from "@/lib/utils/date";
import { SUPPORT_TOPICS, type SupportTopic } from "@/lib/utils/support-topics";
import { createSupportRequestAction } from "@/lib/actions/support";
import DemoEmailNote from "@/components/layout/DemoEmailNote";

interface RecordOption {
  id: string;
  number: string;
  createdAt: string;
}

interface Props {
  orders: { id: string; orderNumber: string; createdAt: string }[];
  quotes: { id: string; quoteNumber: string; createdAt: string }[];
  canQuote: boolean;
  hasBusinessAccount: boolean;
  prefillOrderId?: string;
  prefillQuoteId?: string;
  prefillTopic?: SupportTopic;
}

const sectionCard: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "var(--color-action-primary)",
  margin: 0,
};

export default function SupportRequestForm({
  orders,
  quotes,
  canQuote,
  hasBusinessAccount,
  prefillOrderId,
  prefillQuoteId,
  prefillTopic,
}: Props) {
  const t = useTranslations("account.support");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const availableTopics = SUPPORT_TOPICS.filter((topic) => {
    if (topic === "ORDER") return orders.length > 0;
    if (topic === "QUOTE") return canQuote;
    if (topic === "BUSINESS") return hasBusinessAccount;
    return true;
  });

  const initialTopic: SupportTopic | null =
    prefillOrderId && orders.length > 0
      ? "ORDER"
      : prefillQuoteId && canQuote
        ? "QUOTE"
        : prefillTopic && availableTopics.includes(prefillTopic)
          ? prefillTopic
          : null;

  const [topic, setTopic] = useState<SupportTopic | null>(initialTopic);
  const [orderId, setOrderId] = useState(prefillOrderId ?? "");
  const [quoteId, setQuoteId] = useState(prefillQuoteId ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    subject?: boolean;
    message?: boolean;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [existingTicketNumber, setExistingTicketNumber] = useState<
    string | null
  >(null);
  const [success, setSuccess] = useState<{ ticketNumber: string } | null>(
    null,
  );

  const orderOptions: RecordOption[] = orders.map((o) => ({
    id: o.id,
    number: o.orderNumber,
    createdAt: o.createdAt,
  }));
  const quoteOptions: RecordOption[] = quotes.map((q) => ({
    id: q.id,
    number: q.quoteNumber,
    createdAt: q.createdAt,
  }));

  function resetForm() {
    setTopic(null);
    setOrderId("");
    setQuoteId("");
    setSubject("");
    setMessage("");
    setFieldErrors({});
    setError(null);
    setExistingTicketNumber(null);
    setSuccess(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic) return;

    if (topic === "ORDER" && !orderId) {
      setError(t("errors.RECORD_REQUIRED"));
      return;
    }
    if (topic === "QUOTE" && !quoteId) {
      setError(t("errors.RECORD_REQUIRED"));
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const nextFieldErrors: { subject?: boolean; message?: boolean } = {};
    if (trimmedSubject.length < 3 || trimmedSubject.length > 120) {
      nextFieldErrors.subject = true;
    }
    if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
      nextFieldErrors.message = true;
    }
    if (nextFieldErrors.subject || nextFieldErrors.message) {
      setFieldErrors(nextFieldErrors);
      setError(t("errors.VALIDATION_ERROR"));
      return;
    }

    setFieldErrors({});
    setError(null);
    setExistingTicketNumber(null);

    startTransition(async () => {
      const result = await createSupportRequestAction({
        topic,
        orderId: topic === "ORDER" ? orderId : undefined,
        quoteId: topic === "QUOTE" ? quoteId : undefined,
        subject: trimmedSubject,
        message: trimmedMessage,
      });

      if (result.success) {
        setSuccess({ ticketNumber: result.data.ticketNumber });
        router.refresh();
        return;
      }

      setError(t(`errors.${result.errorCode}`));
      if (result.fieldErrors) {
        setFieldErrors({
          subject: result.fieldErrors.subject === "invalid",
          message: result.fieldErrors.message === "invalid",
        });
      }
      if (result.errorCode === "ALREADY_OPEN" && result.existingTicketNumber) {
        setExistingTicketNumber(result.existingTicketNumber);
      }
    });
  }

  if (success) {
    return (
      <div style={sectionCard}>
        <p style={sectionTitle}>{t("form.sentTitle")}</p>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "var(--color-content-tertiary)",
            margin: 0,
          }}
        >
          {t("form.sentBody")}
        </p>
        <DemoEmailNote />
        <p style={{ fontSize: "var(--text-body-sm)", margin: 0 }}>
          {t("form.sentRef")}:{" "}
          <span dir="ltr" style={{ fontWeight: "var(--font-semibold)" }}>
            {success.ticketNumber}
          </span>
        </p>
        <div>
          <Button type="button" variant="outline" size="md" onClick={resetForm}>
            {t("form.sendAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={sectionCard}>
      <p style={sectionTitle}>{t("form.title")}</p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
              marginBottom: "0.5rem",
            }}
          >
            {t("form.topicLabel")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("form.topicLabel")}
            style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
          >
            {availableTopics.map((availableTopic) => {
              const isActive = topic === availableTopic;
              return (
                <button
                  key={availableTopic}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setTopic(availableTopic)}
                  style={{
                    fontSize: "var(--text-body-sm)",
                    fontWeight: "var(--font-medium)",
                    padding: "0.5rem 0.875rem",
                    borderRadius: "var(--radius-none)",
                    border: isActive
                      ? "1px solid var(--color-action-primary)"
                      : "1px solid var(--color-auth-input-border)",
                    backgroundColor: "transparent",
                    color: isActive
                      ? "var(--color-action-primary)"
                      : "var(--color-auth-label-text)",
                    cursor: "pointer",
                  }}
                >
                  {t(`form.topics.${availableTopic}`)}
                </button>
              );
            })}
          </div>
        </div>

        {topic === "ORDER" && (
          <Select
            id="support-order"
            label={t("form.orderLabel")}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
          >
            <option value="">{t("form.recordPlaceholder")}</option>
            {orderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number} · {formatShortDate(o.createdAt, locale)}
              </option>
            ))}
          </Select>
        )}

        {topic === "QUOTE" && (
          <Select
            id="support-quote"
            label={t("form.quoteLabel")}
            value={quoteId}
            onChange={(e) => setQuoteId(e.target.value)}
            required
          >
            <option value="">{t("form.recordPlaceholder")}</option>
            {quoteOptions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.number} · {formatShortDate(q.createdAt, locale)}
              </option>
            ))}
          </Select>
        )}

        <Input
          id="support-subject"
          label={t("form.subjectLabel")}
          placeholder={t("form.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          error={fieldErrors.subject ? t("errors.subjectInvalid") : undefined}
          maxLength={120}
          required
        />

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
        >
          <label
            htmlFor="support-message"
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-medium)",
              color: "var(--color-auth-label-text)",
            }}
          >
            {t("form.messageLabel")}
          </label>
          <textarea
            id="support-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("form.messagePlaceholder")}
            rows={5}
            maxLength={2000}
            style={{
              width: "100%",
              resize: "vertical",
              fontSize: "var(--text-body)",
              color: "var(--color-auth-input-text)",
              backgroundColor: "var(--color-auth-input-bg)",
              border: "1.5px solid var(--color-auth-input-border)",
              borderRadius: "var(--radius-none)",
              padding: "0.625rem 0.875rem",
            }}
          />
          {fieldErrors.message && (
            <p
              role="alert"
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-auth-error-text)",
                margin: 0,
              }}
            >
              {t("errors.messageInvalid")}
            </p>
          )}
        </div>

        <div
          style={{
            borderInlineStart: "3px solid var(--color-shop-divider)",
            paddingInlineStart: "0.75rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-content-tertiary)",
              margin: 0,
            }}
          >
            {t("form.note")}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
              margin: 0,
            }}
          >
            {error}
            {existingTicketNumber && (
              <>
                {" "}
                {t("form.sentRef")}:{" "}
                <span dir="ltr">{existingTicketNumber}</span>
              </>
            )}
          </p>
        )}

        <div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isPending}
            disabled={!topic}
          >
            {isPending ? t("form.sending") : t("form.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
