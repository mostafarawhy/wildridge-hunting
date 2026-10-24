"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { transitionOrderAction } from "@/lib/actions/orders";
import {
  CANCELLABLE_STATUSES,
  ORDER_STATUS_LABELS,
  RETURNABLE_STATUSES,
} from "@/lib/utils/order-status";
import type { OrderStatus } from "@/lib/db/queries/order";

interface Props {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  owedAed: number;
  canManage: boolean;
  canMarkPaid: boolean;
  canViewCustomer: boolean;
  canCreateTicket: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
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

export default function OrderRowMenu({
  orderId,
  orderNumber,
  status,
  customerId,
  owedAed,
  canManage,
  canMarkPaid,
  canViewCustomer,
  canCreateTicket,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmTo, setConfirmTo] = useState<
    "CONFIRMED" | "PROCESSING" | null
  >(null);
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

  const base = `/admin/orders/${orderId}`;
  const items: MenuItem[] = [
    { key: "open", label: "Open order", href: base },
    {
      key: "copy",
      label: "Copy order number",
      onSelect: () => {
        navigator.clipboard
          .writeText(orderNumber)
          .then(() => toast.success("Order number copied."))
          .catch(() => toast.error("Could not copy the order number."));
      },
    },
  ];

  if (canManage && status === "PAID") {
    items.push({
      key: "confirm",
      label: "Confirm order…",
      onSelect: () => setConfirmTo("CONFIRMED"),
    });
  }
  if (canManage && status === "CONFIRMED") {
    items.push({
      key: "process",
      label: "Start processing…",
      onSelect: () => setConfirmTo("PROCESSING"),
    });
  }
  if (canMarkPaid && status === "AWAITING_MANUAL_PAYMENT") {
    items.push({
      key: "pay",
      label: "Record payment…",
      href: `${base}?do=pay`,
    });
  }
  if (canManage && status === "SHIPPED") {
    items.push({
      key: "deliver",
      label: "Mark delivered…",
      href: `${base}?do=deliver`,
    });
  }
  if (canMarkPaid && owedAed > 0) {
    items.push({
      key: "refund",
      label: "Record refund…",
      href: `${base}?do=refund`,
    });
  }
  if (canManage && CANCELLABLE_STATUSES.includes(status)) {
    items.push({
      key: "cancel",
      label: "Cancel order…",
      href: `${base}?do=cancel`,
      danger: true,
    });
  }
  if (canManage && RETURNABLE_STATUSES.includes(status)) {
    items.push({
      key: "return",
      label: "Record a return…",
      href: `${base}?do=return`,
    });
  }
  if (canViewCustomer) {
    items.push({
      key: "customer",
      label: "Customer page",
      href: `/admin/customers/${customerId}`,
    });
  }
  if (canCreateTicket) {
    items.push({
      key: "ticket",
      label: "Create ticket",
      href: `/admin/tickets?orderId=${orderId}`,
    });
  }

  function handleConfirm() {
    if (!confirmTo) return;
    const toStatus = confirmTo;
    setConfirmTo(null);
    startTransition(async () => {
      const result = await transitionOrderAction({
        orderId,
        expectedStatus: status,
        toStatus,
      });
      if (result.success) {
        toast.success(`Order moved to ${ORDER_STATUS_LABELS[toStatus]}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
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
        aria-label={`Actions for order ${orderNumber}`}
        disabled={isPending}
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
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.6 : 1,
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
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  ...itemStyle,
                  color: item.danger ? "#991b1b" : "#0b0b0b",
                }}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                style={{
                  ...itemStyle,
                  color: item.danger ? "#991b1b" : "#0b0b0b",
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}

      {confirmTo && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmTo(null)}
          onConfirm={handleConfirm}
          title={confirmTo === "CONFIRMED" ? "Confirm Order" : "Start Processing"}
          message={
            confirmTo === "CONFIRMED"
              ? `This will mark order ${orderNumber} as confirmed.`
              : `This will mark order ${orderNumber} as being processed.`
          }
          confirmLabel={
            confirmTo === "CONFIRMED" ? "Confirm order" : "Start processing"
          }
          cancelLabel="Cancel"
          isPending={isPending}
          destructive={false}
        />
      )}
    </span>
  );
}
