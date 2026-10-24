"use client";

import { useEffect, useRef, ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  title: string;
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function BottomSheet(props: BottomSheetProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(<BottomSheetInner {...props} />, document.body);
}

function BottomSheetInner({
  open,
  onClose,
  ariaLabel,
  title,
  closeLabel,
  footer,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const backdropTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: [0, 0, 0.2, 1] as const };
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 390,
            }}
          />
          <motion.div
            key="sheet-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={panelTransition}
            style={{
              position: "fixed",
              bottom: 0,
              insetInline: 0,
              maxHeight: "85dvh",
              borderStartStartRadius: "14px",
              borderStartEndRadius: "14px",
              backgroundColor: "var(--color-auth-input-bg)",
              color: "var(--primitive-black)",
              display: "flex",
              flexDirection: "column",
              zIndex: 400,
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "36px",
                height: "4px",
                marginTop: "8px",
                marginInline: "auto",
                backgroundColor: "var(--color-shop-divider)",
                flexShrink: 0,
              }}
            />
            <div
              className="flex items-center justify-between"
              style={{ padding: "0.75rem 1rem", flexShrink: 0 }}
            >
              <span className="text-body font-semibold">{title}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex items-center justify-center cursor-pointer"
                style={{ width: "32px", height: "32px" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 1L13 13M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
            {footer && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
                  borderTop: "1px solid var(--color-shop-divider)",
                  flexShrink: 0,
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
