"use client";

import { useRef, useState } from "react";
import FadeImage from "@/components/ui/FadeImage";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import QuantitySelector from "@/components/ui/QuantitySelector";
import { useCartStore } from "@/lib/stores/cart-store";
import {
  updateCartItemQuantityAction,
  removeFromCartAction,
} from "@/lib/actions/cart";

import { formatAED, multiplyMoney } from "@/lib/utils/currency";
import { getImageUrl } from "@/lib/utils/images";
import type { CartLineProjection } from "@/lib/db/queries/cart";

interface CartItemRowProps {
  line: CartLineProjection;
  locale: string;
}

const QTY_SAVE_DELAY_MS = 400;

export default function CartItemRow({ line, locale }: CartItemRowProps) {
  const t = useTranslations("cart");
  const setCart = useCartStore((s) => s.setCart);
  const isPending = useCartStore((s) => s.isPending);
  const beginPending = useCartStore((s) => s.beginPending);
  const endPending = useCartStore((s) => s.endPending);
  const [rowError, setRowError] = useState<string | null>(null);
  const storeQty = useCartStore(
    (s) => s.cart?.items.find((i) => i.id === line.id)?.quantity,
  );
  const savedQty = storeQty ?? line.quantity;
  const [draft, setDraft] = useState<number | null>(null);
  const closeDrawer = useCartStore((s) => s.closeDrawer);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queuedQty = useRef<number | null>(null);
  const holdsPending = useRef(false);

  const shownQty = draft ?? savedQty;

  async function save(qty: number) {
    if (inFlight.current) {
      queuedQty.current = qty;
      return;
    }
    inFlight.current = true;
    let current = qty;
    try {
      while (true) {
        const result = await updateCartItemQuantityAction({
          cartItemId: line.id,
          quantity: current,
          locale: locale as "en" | "ar" | "ru",
        });
        if (result.success) {
          setCart(result.data);
          if (queuedQty.current !== null) {
            current = queuedQty.current;
            queuedQty.current = null;
            continue;
          }
          if (timer.current === null) setDraft(null);
        } else {
          queuedQty.current = null;
          if (timer.current === null) setDraft(null);
          setRowError(t(`errors.${result.errorCode}`));
        }
        break;
      }
    } finally {
      inFlight.current = false;
      if (
        timer.current === null &&
        queuedQty.current === null &&
        holdsPending.current
      ) {
        endPending();
        holdsPending.current = false;
      }
    }
  }

  function handleQtyChange(qty: number) {
    setRowError(null);
    setDraft(qty);
    if (!holdsPending.current) {
      beginPending();
      holdsPending.current = true;
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save(qty);
    }, QTY_SAVE_DELAY_MS);
  }

  async function handleRemove() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    queuedQty.current = null;
    setRowError(null);
    beginPending();
    try {
      const result = await removeFromCartAction({
        cartItemId: line.id,
        locale: locale as "en" | "ar" | "ru",
      });
      if (result.success) {
        setCart(result.data);
      } else {
        setRowError(t(`errors.${result.errorCode}`));
      }
    } finally {
      endPending();
      if (holdsPending.current) {
        endPending();
        holdsPending.current = false;
      }
    }
  }

  const imageUrl = line.productImageUrl
    ? getImageUrl(line.productImageUrl)
    : null;

  const unavailable = !line.available;
  const outOfStock = line.available && line.stockQuantity < 1;
  const flagged = unavailable || outOfStock;

  return (
    <li
      style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--color-auth-divider)",
        ...(flagged
          ? { borderInlineStart: "3px solid var(--color-action-primary)" }
          : {}),
      }}
    >
      <div className="flex gap-4">
        <div
          className="shrink-0 relative"
          style={{
            width: 80,
            height: 80,
            backgroundColor: "var(--color-auth-input-bg)",
            border: "1px solid var(--color-auth-input-border)",
            borderRadius: "var(--radius-none)",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <FadeImage
              src={imageUrl}
              alt={line.productName}
              fill
              className="object-contain p-1"
              sizes="80px"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ color: "var(--color-auth-input-placeholder)" }}
            >
              <PlaceholderIcon />
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <Link
            onClick={closeDrawer}
            href={`/shop/${line.categorySlug}/${line.productSlug}`}
            className="text-body font-semibold leading-snug hover:opacity-60 transition-opacity line-clamp-2"
            style={{ color: "var(--color-auth-label-text)" }}
          >
            {line.productName}
          </Link>

          {flagged && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--color-action-primary)",
                margin: 0,
              }}
            >
              {unavailable ? t("unavailable") : t("outOfStock")}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 mt-2">
            {!flagged && (
              <QuantitySelector
                value={shownQty}
                onChange={handleQtyChange}
                min={1}
                max={line.stockQuantity}
              />
            )}
            <span
              className="text-body font-bold"
              style={{
                color: "var(--color-auth-label-text)",
                ...(flagged ? { marginInlineStart: "auto" } : {}),
              }}
            >
              {formatAED(multiplyMoney(line.unitPriceAed, line.quantity))}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={t("remove")}
          className="shrink-0 flex items-start pt-0.5 cursor-pointer transition-opacity hover:opacity-50 disabled:opacity-25"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-error)",
          }}
        >
          <TrashIcon />
        </button>
      </div>

      {rowError && (
        <p
          className="text-body-sm mt-2"
          style={{ color: "var(--color-auth-error-text)" }}
        >
          {rowError}
        </p>
      )}
    </li>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points="3 6 5 6 21 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 6V4h6v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle
        cx="8.5"
        cy="8.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M21 15l-5-5L5 21"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
