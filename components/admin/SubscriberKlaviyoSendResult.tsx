"use client";

import { createContext, useContext, useState } from "react";

export type KlaviyoSendResult =
  | { ok: true; sent: number; failed: number; error: string | null; at: Date }
  | { ok: false; error: string };

interface ContextValue {
  result: KlaviyoSendResult | null;
  setResult: (result: KlaviyoSendResult | null) => void;
}

const SubscriberKlaviyoSendResultContext = createContext<ContextValue | null>(
  null,
);

export function SubscriberKlaviyoSendResultProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [result, setResult] = useState<KlaviyoSendResult | null>(null);
  return (
    <SubscriberKlaviyoSendResultContext.Provider value={{ result, setResult }}>
      {children}
    </SubscriberKlaviyoSendResultContext.Provider>
  );
}

export function useSubscriberKlaviyoSendResult(): ContextValue {
  const value = useContext(SubscriberKlaviyoSendResultContext);
  if (!value) {
    throw new Error(
      "useSubscriberKlaviyoSendResult must be used inside SubscriberKlaviyoSendResultProvider",
    );
  }
  return value;
}

const SUCCESS = "#166534";
const DANGER = "#991b1b";

function noun(n: number): string {
  return n === 1 ? "subscriber" : "subscribers";
}

function formatTime(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
}

function describe(result: KlaviyoSendResult): {
  heading: string;
  body: string;
  error: string | null;
  success: boolean;
} {
  if (!result.ok) {
    return {
      heading: "Nothing was sent",
      body: result.error,
      error: null,
      success: false,
    };
  }
  const { sent, failed, error, at } = result;
  if (failed === 0 && sent > 0) {
    return {
      heading: `Sent ${sent} ${noun(sent)} to Klaviyo`,
      body: `Klaviyo accepted the import at ${formatTime(at)} (Dubai). They now show Sent in the table.`,
      error: null,
      success: true,
    };
  }
  if (sent === 0 && failed > 0) {
    return {
      heading: `Klaviyo refused ${failed} ${noun(failed)}`,
      body: "They stay Failed. Fix the cause, then send again.",
      error,
      success: false,
    };
  }
  if (sent > 0 && failed > 0) {
    return {
      heading: `Sent ${sent}, Klaviyo refused ${failed}`,
      body: `The ${sent} now show Sent. The ${failed} stay Failed. Fix the cause, then send again.`,
      error,
      success: false,
    };
  }
  return {
    heading: "Nothing was sent",
    body: "Those subscribers unsubscribed before the send finished.",
    error: null,
    success: false,
  };
}

export default function SubscriberKlaviyoSendResult() {
  const { result, setResult } = useSubscriberKlaviyoSendResult();
  if (!result) return null;

  const { heading, body, error, success } = describe(result);
  const tone = success ? SUCCESS : DANGER;

  return (
    <div
      role={success ? "status" : "alert"}
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e3e3e3",
        borderLeft: `3px solid ${tone}`,
        borderRadius: "0",
        padding: "0.875rem 1rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-semibold)",
            color: tone,
          }}
        >
          {heading}
        </p>
        <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          {body}
        </p>
        {typeof error === "string" && error.length > 0 && (
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.375rem 0.5rem",
              backgroundColor: "#f7f6f4",
              border: "1px solid #e2ddd8",
              fontSize: "var(--text-body-sm)",
              color: "#0b0b0b",
              overflowWrap: "anywhere",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {error}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setResult(null)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          textDecoration: "underline",
          color: "#0b0b0b",
          fontSize: "var(--text-body-sm)",
          cursor: "pointer",
          marginLeft: "auto",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
