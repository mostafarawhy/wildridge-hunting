"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 4000;

const typeStyles: Record<
  ToastType,
  { bg: string; border: string; text: string; icon: string }
> = {
  success: {
    bg: "var(--color-status-success-bg)",
    border: "var(--color-status-success-border)",
    text: "var(--color-status-success-text)",
    icon: "✓",
  },
  error: {
    bg: "var(--color-status-danger-bg)",
    border: "var(--color-status-danger-border)",
    text: "var(--color-status-danger-text)",
    icon: "✕",
  },
  info: {
    bg: "var(--color-status-info-bg)",
    border: "var(--color-status-info-border)",
    text: "var(--color-status-info-text)",
    icon: "i",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const styles = typeStyles[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        minWidth: "280px",
        maxWidth: "360px",
        padding: "0.875rem 1rem",
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: "var(--radius-none)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1.125rem",
          height: "1.125rem",
          fontSize: "0.625rem",
          fontWeight: "var(--font-bold)",
          flexShrink: 0,
          marginTop: "1px",
          border: `1.5px solid ${styles.text}`,
          borderRadius: "50%",
          color: styles.text,
        }}
      >
        {styles.icon}
      </span>

      <p
        style={{
          flex: 1,
          fontSize: "var(--text-body)",
          color: styles.text,
          lineHeight: "var(--leading-normal)",
          margin: 0,
        }}
      >
        {toast.message}
      </p>

      <button
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: "1.25rem",
          height: "1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: styles.text,
          opacity: 0.6,
          padding: 0,
          marginTop: "1px",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </motion.div>
  );
}

function useIsMounted() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("DOMContentLoaded", cb);
      return () => window.removeEventListener("DOMContentLoaded", cb);
    },
    () => true,
    () => false,
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const mounted = useIsMounted();

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        insetBlockStart: "1.25rem",
        insetInlineEnd: "1.25rem",
        zIndex: "var(--z-toast)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const ctx: ToastContextValue = {
    success: useCallback((m) => add("success", m), [add]),
    error: useCallback((m) => add("error", m), [add]),
    info: useCallback((m) => add("info", m), [add]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export default function Toast() {
  return null;
}
