"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useWishlistStore } from "@/lib/stores/wishlist-store";

export default function WishlistNavIcon() {
  const t = useTranslations("nav");
  const count = useWishlistStore((s) => s.skus.size);

  return (
    <Link
      href="/account/wishlist"
      aria-label={t("wishlist")}
      className="relative flex items-center justify-center transition-opacity duration-150 hover:opacity-70"
      style={{ color: "var(--color-content-primary)" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>

      {count > 0 && (
        <span
          className="absolute flex items-center justify-center text-[9px] font-bold leading-none"
          style={{
            top: "-6px",
            insetInlineEnd: "-6px",
            minWidth: "16px",
            height: "16px",
            padding: "0 3px",
            borderRadius: "9999px",
            backgroundColor: "var(--color-action-primary)",
            color: "var(--color-action-primary-fg)",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
