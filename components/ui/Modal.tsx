"use client";

import { useEffect, useRef, useSyncExternalStore, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  closeOnBackdropClick?: boolean;
  ariaLabel: string;
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function Modal({
  open,
  onClose,
  children,
  maxWidth = 480,
  closeOnBackdropClick = true,
  ariaLabel,
}: ModalProps) {
  const isClient = useIsClient();

  if (!isClient) return null;

  return createPortal(
    <ModalInner
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      closeOnBackdropClick={closeOnBackdropClick}
      ariaLabel={ariaLabel}
    >
      {children}
    </ModalInner>,
    document.body,
  );
}

function ModalInner({
  open,
  onClose,
  children,
  maxWidth,
  closeOnBackdropClick,
  ariaLabel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        if (focusable.length === 1) {
          e.preventDefault();
          return;
        }
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={closeOnBackdropClick ? onClose : undefined}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 400,
            }}
            aria-hidden="true"
          />

          <motion.div
            key="modal-container"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            ref={dialogRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              padding: "1.5rem",
              overflowY: "auto",
              zIndex: 400,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: `${maxWidth}px`,
                backgroundColor: "var(--primitive-white)",
                boxShadow: "var(--shadow-modal)",
                position: "relative",
                pointerEvents: "auto",
                margin: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close dialog"
                onClick={onClose}
                style={{
                  position: "absolute",
                  top: "1rem",
                  insetInlineEnd: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-auth-label-text)",
                  opacity: 0.6,
                  transition: "opacity 150ms",
                  zIndex: 1,
                }}
                className="hover:opacity-100"
              >
                <CloseIcon />
              </button>

              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
