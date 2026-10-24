"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useWishlistStore } from "@/lib/stores/wishlist-store";
import { toggleWishlistAction } from "@/lib/actions/wishlist";
import type { WishlistActionErrorCode } from "@/lib/actions/wishlist";
import { useToast } from "@/components/ui/Toast";

interface WishlistButtonProps {
  sku: string;
  size?: number;
}

export default function WishlistButton({
  sku,
  size = 20,
}: WishlistButtonProps) {
  const t = useTranslations("shop");
  const toast = useToast();
  const saved = useWishlistStore((s) => s.has(sku));
  const isAuth = useWishlistStore((s) => s.isAuthenticated);
  const add = useWishlistStore((s) => s.add);
  const remove = useWishlistStore((s) => s.remove);
  const inFlightRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (inFlightRef.current) return;

    if (!isAuth) {
      toast.info(t("wishlist_sign_in"));
      return;
    }

    inFlightRef.current = true;
    setIsPending(true);

    const wasSaved = saved;
    if (wasSaved) {
      remove(sku);
    } else {
      add(sku);
    }

    const result = await toggleWishlistAction(sku);

    if (!result.success) {
      if (wasSaved) {
        add(sku);
      } else {
        remove(sku);
      }
      toast.error(
        t(
          `wishlist_errors.${result.errorCode satisfies WishlistActionErrorCode}`,
        ),
      );
    }

    inFlightRef.current = false;
    setIsPending(false);
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={t(saved ? "wishlist_remove" : "wishlist_add")}
      onClick={handleClick}
      disabled={isPending}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        color: saved
          ? "var(--color-action-primary)"
          : "var(--color-content-tertiary)",
        opacity: isPending ? 0.6 : 1,
        transition: "color 0.15s, opacity 0.15s",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
