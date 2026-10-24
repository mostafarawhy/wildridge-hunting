"use client";

import { useCartStore } from "@/lib/stores/cart-store";
import { useTranslations } from "next-intl";

export default function CartIconBadge() {
  const t = useTranslations("nav");
  const openDrawer = useCartStore((s) => s.openDrawer);
  const itemCount = useCartStore((s) => s.cart?.totals.itemCount ?? 0);

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={t("aria_cart", { count: itemCount })}
      className="relative cursor-pointer transition-opacity duration-150 hover:opacity-70"
      style={{
        background: "none",
        border: "none",
        color: "var(--color-content-primary)",
        padding: 0,
      }}
    >
      <CartIcon />
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute flex items-center justify-center"
          style={{
            top: "-6px",
            insetInlineEnd: "-7px",
            minWidth: "16px",
            height: "16px",
            padding: "0 3px",
            backgroundColor: "var(--color-action-primary)",
            color: "var(--color-action-primary-fg)",
            fontSize: "var(--text-badge)",
            fontWeight: "var(--font-bold)",
            borderRadius: "var(--radius-full)",
            lineHeight: 1,
          }}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
