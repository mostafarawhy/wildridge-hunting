"use client";

import { useEffect, useRef, ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  ariaLabel: string;
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function Drawer({
  open,
  onClose,
  children,
  width = 420,
  ariaLabel,
}: DrawerProps) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <DrawerInner
      open={open}
      onClose={onClose}
      width={width}
      ariaLabel={ariaLabel}
    >
      {children}
    </DrawerInner>,
    document.body,
  );
}

function DrawerInner({
  open,
  onClose,
  children,
  width,
  ariaLabel,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const isRTL = document.documentElement.dir === "rtl";
  const slideFrom = isRTL ? "-100%" : "100%";

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

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 390,
            }}
          />
          <m.div
            key="drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              insetInlineEnd: 0,
              width: `min(${width}px, 100vw)`,
              backgroundColor: "var(--color-auth-form-bg)",
              borderInlineStart: "1px solid var(--color-auth-form-border)",
              display: "flex",
              flexDirection: "column",
              zIndex: 400,
              boxShadow: "-8px 0 48px rgba(0,0,0,0.4)",
              overflowY: "hidden",
            }}
          >
            {children}
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
