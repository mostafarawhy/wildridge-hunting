"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  convertedOrderId: string | null;
  convertedOrderNumber: string | null;
  canViewOrders: boolean;
  canViewCustomer: boolean;
  canCreateTicket: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  href: string;
}

const itemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "start",
  padding: "0.5rem 0.875rem",
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  backgroundColor: "transparent",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export default function QuoteRowMenu({
  quoteId,
  quoteNumber,
  customerId,
  convertedOrderId,
  convertedOrderNumber,
  canViewOrders,
  canViewCustomer,
  canCreateTicket,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function handleDismiss() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.min(
      Math.max(rect.right - width, 8),
      window.innerWidth - width - 8,
    );
    const top =
      rect.bottom + 4 + height <= window.innerHeight - 8
        ? rect.bottom + 4
        : Math.max(8, rect.top - 4 - height);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
  }, [open]);

  function toggle() {
    setOpen((current) => !current);
  }

  const items: MenuItem[] = [
    { key: "open", label: "Open quote", href: `/admin/quotes/${quoteId}` },
  ];

  if (canViewOrders && convertedOrderId && convertedOrderNumber) {
    items.push({
      key: "order",
      label: `Open order ${convertedOrderNumber}`,
      href: `/admin/orders/${convertedOrderId}`,
    });
  }
  if (canViewCustomer) {
    items.push({
      key: "customer",
      label: "View customer",
      href: `/admin/customers/${customerId}`,
    });
  }
  if (canCreateTicket) {
    items.push({
      key: "ticket",
      label: "Create ticket",
      href: `/admin/tickets?quoteRequestId=${quoteId}`,
    });
  }

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-block" }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for quote ${quoteNumber}`}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          padding: 0,
          color: "#0b0b0b",
          backgroundColor: open ? "#f3f4f6" : "transparent",
          border: "none",
          borderRadius: "0",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = open
            ? "#f3f4f6"
            : "transparent";
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            visibility: "hidden",
            zIndex: 300,
            minWidth: "12rem",
            paddingBlock: "0.25rem",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              style={itemStyle}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </span>
  );
}
