"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { updateVerificationContentAction } from "@/lib/actions/settings";
import type { SettingValue } from "@/lib/settings/keys";

type VerificationContent = SettingValue<"verification_content">;
type Locale = "en" | "ar" | "ru";

interface Props {
  initial: VerificationContent;
}

const LOCALE_TABS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "English" },
  { locale: "ar", label: "Arabic" },
  { locale: "ru", label: "Russian" },
];

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "var(--color-auth-input-text)",
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1.5px solid var(--color-auth-input-border)",
  borderRadius: "var(--radius-none)",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "var(--color-auth-label-text)",
  marginBottom: "0.375rem",
};

interface PublishAttestationModalProps {
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function PublishAttestationModal({
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: PublishAttestationModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "2.5rem",
    paddingInline: "1.25rem",
    fontSize: "var(--text-body-sm)",
    fontWeight: "var(--font-bold)",
    letterSpacing: "var(--tracking-widest)",
    textTransform: "uppercase",
    border: "none",
    borderRadius: "0",
    cursor: isSubmitting ? "not-allowed" : "pointer",
    opacity: isSubmitting ? 0.6 : 1,
    transition: "opacity 150ms",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          width: "100%",
          maxWidth: "480px",
          padding: "2rem",
          margin: "1rem",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "#0b0b0b",
            marginBottom: "0.625rem",
            paddingInlineEnd: "2rem",
          }}
        >
          Publish Verification Content
        </h2>
        <p
          style={{
            fontSize: "var(--text-body)",
            color: "#6b6b6b",
            marginBottom: "1.25rem",
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          This content, including the acknowledgment text, becomes the
          binding customer-facing copy across all three languages once
          published.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            fontSize: "var(--text-body-sm)",
            color: "#0b0b0b",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: "0.1875rem" }}
          />
          I confirm this is customer-facing legal and compliance content,
          reviewed and approved for all three languages
        </label>

        {error && (
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#991b1b",
              marginTop: "1rem",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !confirmed}
            style={{
              ...btnBase,
              backgroundColor: "#166534",
              color: "#ffffff",
              cursor: isSubmitting || !confirmed ? "not-allowed" : "pointer",
              opacity: isSubmitting || !confirmed ? 0.5 : 1,
            }}
          >
            {isSubmitting ? "Publishing…" : "Publish"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerificationContentForm({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [content, setContent] = useState<VerificationContent>(initial);
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [publishOpen, setPublishOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const active = content[activeLocale];
  const dir = activeLocale === "ar" ? "rtl" : "ltr";

  function updateInstruction(
    field: keyof VerificationContent["en"]["instructions"],
    value: string,
  ) {
    setContent((prev) => ({
      ...prev,
      [activeLocale]: {
        ...prev[activeLocale],
        instructions: { ...prev[activeLocale].instructions, [field]: value },
      },
    }));
  }

  function updateAcknowledgment(value: string) {
    setContent((prev) => ({
      ...prev,
      [activeLocale]: { ...prev[activeLocale], acknowledgment: value },
    }));
  }

  async function handlePublish() {
    setIsSubmitting(true);
    setModalError(null);

    const result = await updateVerificationContentAction({
      content,
      attestation: true,
    });

    if (result.success) {
      toast.success("Verification content published.");
      setPublishOpen(false);
      router.refresh();
    } else if (result.errorCode === "VALIDATION_ERROR") {
      setModalError(result.error);
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
          Verification Content
        </h2>

        <div
          role="tablist"
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.25rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          {LOCALE_TABS.map((tab) => (
            <button
              key={tab.locale}
              type="button"
              role="tab"
              aria-selected={activeLocale === tab.locale}
              onClick={() => setActiveLocale(tab.locale)}
              style={{
                padding: "0.625rem 1rem",
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: activeLocale === tab.locale ? "#0b0b0b" : "#6b6b6b",
                backgroundColor: "transparent",
                border: "none",
                borderBottom:
                  activeLocale === tab.locale
                    ? "2px solid #0b0b0b"
                    : "2px solid transparent",
                marginBottom: "-1px",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor={`vc-general-${activeLocale}`} style={labelStyle}>
              General instructions
            </label>
            <textarea
              id={`vc-general-${activeLocale}`}
              dir={dir}
              value={active.instructions.general}
              onChange={(e) => updateInstruction("general", e.target.value)}
              rows={4}
              maxLength={4000}
              style={textareaStyle}
            />
          </div>

          <div>
            <label htmlFor={`vc-identity-${activeLocale}`} style={labelStyle}>
              Identity guidance
            </label>
            <textarea
              id={`vc-identity-${activeLocale}`}
              dir={dir}
              value={active.instructions.identity}
              onChange={(e) => updateInstruction("identity", e.target.value)}
              rows={3}
              maxLength={4000}
              style={textareaStyle}
            />
          </div>

          <div>
            <label
              htmlFor={`vc-proof-of-address-${activeLocale}`}
              style={labelStyle}
            >
              Proof-of-address guidance
            </label>
            <textarea
              id={`vc-proof-of-address-${activeLocale}`}
              dir={dir}
              value={active.instructions.proofOfAddress}
              onChange={(e) =>
                updateInstruction("proofOfAddress", e.target.value)
              }
              rows={3}
              maxLength={4000}
              style={textareaStyle}
            />
          </div>

          <div>
            <label htmlFor={`vc-photo-${activeLocale}`} style={labelStyle}>
              Photo guidance
            </label>
            <textarea
              id={`vc-photo-${activeLocale}`}
              dir={dir}
              value={active.instructions.photo}
              onChange={(e) => updateInstruction("photo", e.target.value)}
              rows={3}
              maxLength={4000}
              style={textareaStyle}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid var(--color-shop-divider)",
              paddingTop: "1rem",
              marginTop: "0.25rem",
            }}
          >
            <label htmlFor={`vc-acknowledgment-${activeLocale}`} style={labelStyle}>
              Acknowledgment (legal)
            </label>
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "#6b6b6b",
                marginBottom: "0.5rem",
              }}
            >
              This is the binding consent text shown to the customer before
              submission. Changes here take effect immediately on publish.
            </p>
            <textarea
              id={`vc-acknowledgment-${activeLocale}`}
              dir={dir}
              value={active.acknowledgment}
              onChange={(e) => updateAcknowledgment(e.target.value)}
              rows={4}
              maxLength={4000}
              style={textareaStyle}
            />
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
            setModalError(null);
            setPublishOpen(true);
          }}
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
            cursor: "pointer",
          }}
        >
          Publish
        </button>
      </div>

      {publishOpen && (
        <PublishAttestationModal
          isSubmitting={isSubmitting}
          error={modalError}
          onConfirm={() => {
            void handlePublish();
          }}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </div>
  );
}
