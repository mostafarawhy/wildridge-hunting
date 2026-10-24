"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StarOutlineIcon } from "@/components/ui/icons";
import { formatAED } from "@/lib/utils/currency";
import { useCartStore } from "@/lib/stores/cart-store";
import type { CartProjection } from "@/lib/db/queries/cart";

const BURST_OFFSETS = [
  { x: 20, y: 0 },
  { x: 14, y: 14 },
  { x: 0, y: 20 },
  { x: -14, y: 14 },
  { x: -20, y: 0 },
  { x: -14, y: -14 },
  { x: 0, y: -20 },
  { x: 14, y: -14 },
];

interface CartSummaryProps {
  cart: CartProjection;
  locale: string;
  surface: "drawer" | "page";
}

export default function CartSummary({ cart, locale, surface }: CartSummaryProps) {
  const t = useTranslations("cart");
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const isAuthenticated = useCartStore((s) => s.isAuthenticated);
  const drawerOpen = useCartStore((s) => s.open);
  const isPending = useCartStore((s) => s.isPending);
  const isEmpty = cart.items.length === 0;
  const hasBlockedLines = cart.totals.blocked;
  const blocked = isEmpty || isPending || hasBlockedLines;
  const prefersReduced = useReducedMotion() ?? false;
  const visible = surface === "page" ? true : drawerOpen;

  const {
    grandTotalAed,
    freeShippingEnabled,
    freeShippingThresholdAed,
    freeShippingEligible,
    freeShippingRemainingAed,
  } = cart.totals;

  const [prevEligible, setPrevEligible] = useState<boolean | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);

  if (prevEligible !== freeShippingEligible) {
    setPrevEligible(freeShippingEligible);
    if (prevEligible === false && freeShippingEligible) {
      setJustUnlocked(true);
    } else if (!freeShippingEligible) {
      setJustUnlocked(false);
    }
  }

  if (justUnlocked && visible && prefersReduced) {
    setJustUnlocked(false);
  }

  const progressPct =
    freeShippingThresholdAed > 0
      ? Math.min(100, (grandTotalAed / freeShippingThresholdAed) * 100)
      : 100;

  const cartLocale = locale as "en" | "ar" | "ru";

  const checkoutHref = isAuthenticated
    ? "/checkout"
    : `/auth/login?callbackUrl=${encodeURIComponent("/checkout")}`;

  return (
    <div
      className="shrink-0 flex flex-col gap-4 px-6 py-5"
      style={{
        borderTop: "1px solid var(--color-auth-divider)",
        backgroundColor: "var(--color-auth-form-bg)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-body-sm tracking-widest uppercase"
          style={{ color: "var(--color-auth-label-text)" }}
        >
          {t("subtotal")}
        </span>
        <span
          className="text-body-lg font-bold"
          style={{ color: "var(--color-auth-label-text)" }}
        >
          {formatAED(grandTotalAed)}
        </span>
      </div>

      <p
        className="text-body-sm -mt-2"
        style={{ color: "var(--color-content-tertiary)", margin: 0 }}
      >
        {t("taxAtCheckout")}
      </p>

      {/* ─── Free-shipping progress ──────────────────────────────────────────── */}
      {freeShippingEnabled && (
        <div className="flex flex-col gap-1.5">
          {!freeShippingEligible && (
            <>
              <div
                style={{
                  height: 3,
                  backgroundColor: "var(--color-auth-input-border)",
                  borderRadius: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    backgroundColor: "var(--color-accent)",
                    borderRadius: 0,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <span
                className="text-body-sm"
                style={{ color: "var(--color-auth-label-text)" }}
              >
                {t.rich("addForFreeShipping", {
                  amt: () => (
                    <span dir="ltr">
                      {formatAED(freeShippingRemainingAed, cartLocale)}
                    </span>
                  ),
                })}
              </span>
            </>
          )}
          {freeShippingEligible && (
            <div style={{ position: "relative", overflow: "visible" }}>
              <motion.div
                key={justUnlocked && visible && !prefersReduced ? "burst" : "static"}
                initial={
                  !justUnlocked || !visible || prefersReduced
                    ? false
                    : { opacity: 0, scale: 0.88, y: 3 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                className="flex items-center gap-1.5 text-body-sm font-medium"
                style={{ color: "var(--color-positive)" }}
              >
                <motion.svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <motion.path
                    d="M2 7L5.5 10.5L12 3.5"
                    stroke="var(--color-positive)"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={
                      !justUnlocked || !visible || prefersReduced
                        ? { pathLength: 1 }
                        : { pathLength: 0 }
                    }
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.32, ease: "easeInOut", delay: 0.06 }}
                  />
                </motion.svg>
                <span>{t("freeShippingUnlocked")}</span>
              </motion.div>

              {justUnlocked && visible &&
                !prefersReduced &&
                BURST_OFFSETS.map((off, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    initial={{ opacity: 0.9, scale: 1, x: 0, y: 0 }}
                    animate={{ opacity: 0, scale: 0.4, x: off.x, y: off.y }}
                    transition={{
                      duration: 0.55,
                      ease: "easeOut",
                      delay: i * 0.015,
                    }}
                    onAnimationComplete={
                      i === BURST_OFFSETS.length - 1
                        ? () => setJustUnlocked(false)
                        : undefined
                    }
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: 5,
                      height: 5,
                      marginTop: -2.5,
                      marginLeft: -2.5,
                      borderRadius: "50%",
                      backgroundColor: "var(--color-positive-dot)",
                      pointerEvents: "none",
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {cart.loyalty.points > 0 && (
        <div
          className="flex items-center text-body-sm"
          style={{ gap: "0.375rem", color: "var(--color-auth-label-text)" }}
        >
          <span style={{ color: "var(--color-accent)", display: "flex" }}>
            <StarOutlineIcon size={15} />
          </span>
          <span>
            {t.rich("pointsEarn", {
              points: cart.loyalty.points.toLocaleString("en-US"),
              b: (c) => (
                <span dir="ltr" className="font-semibold">
                  {c}
                </span>
              ),
            })}
          </span>
        </div>
      )}

      {hasBlockedLines && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-action-primary)",
            margin: 0,
          }}
        >
          {t("blockedNote")}
        </p>
      )}

      <Link
        href={checkoutHref}
        aria-disabled={blocked}
        tabIndex={blocked ? -1 : undefined}
        onClick={(e) => {
          if (blocked) {
            e.preventDefault();
            return;
          }
          closeDrawer();
        }}
        className="w-full flex items-center justify-center h-12 text-label tracking-widest uppercase font-bold transition-colors"
        style={{
          backgroundColor: blocked
            ? "var(--color-auth-input-border)"
            : "var(--color-action-primary)",
          color: "var(--color-auth-form-bg)",
          pointerEvents: blocked ? "none" : "auto",
          opacity: blocked ? 0.6 : 1,
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          if (!blocked)
            e.currentTarget.style.backgroundColor =
              "var(--color-action-primary-hover)";
        }}
        onMouseLeave={(e) => {
          if (!blocked)
            e.currentTarget.style.backgroundColor =
              "var(--color-action-primary)";
        }}
      >
        {t("checkout")}
      </Link>
    </div>
  );
}
