"use client";

import { useTranslations, useLocale } from "next-intl";
import { useCartStore } from "@/lib/stores/cart-store";
import Drawer from "@/components/ui/Drawer";
import CartItemRow from "./CartItemRow";
import CartSummary from "./CartSummary";
import Button from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";

export default function CartDrawer() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const open = useCartStore((s) => s.open);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const cart = useCartStore((s) => s.cart);
  const isEmpty = !cart || cart.items.length === 0;
  const router = useRouter();

  return (
    <Drawer
      open={open}
      onClose={closeDrawer}
      width={440}
      ariaLabel={t("title")}
    >
      <div
        className="flex items-center justify-between px-6 py-5 shrink-0"
        style={{
          borderBottom: "1px solid var(--color-auth-divider)",
          backgroundColor: "var(--color-auth-form-bg)",
        }}
      >
        <h2
          className="text-ui font-bold tracking-widest uppercase"
          style={{ color: "var(--color-auth-label-text)" }}
        >
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close cart"
          className="flex items-center justify-center w-8 h-8 cursor-pointer transition-opacity hover:opacity-50"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-auth-input-placeholder)",
          }}
        >
          <CloseIcon />
        </button>
      </div>

      <div data-slot="shipping-progress" />

      {isEmpty ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-12"
          style={{ backgroundColor: "var(--color-auth-form-bg)" }}
        >
          <BagEmptyIcon />
          <p
            className="text-body-lg"
            style={{ color: "var(--color-auth-input-placeholder)" }}
          >
            {t("empty")}
          </p>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              closeDrawer();
              startNavigationProgress("/shop");
              router.push("/shop");
            }}
          >
            {t("emptyCta")}
          </Button>
        </div>
      ) : (
        <>
          <ul
            className="flex-1 overflow-y-auto flex flex-col"
            style={{ gap: 0, backgroundColor: "var(--color-auth-form-bg)" }}
            role="list"
          >
            {cart.items.map((line) => (
              <CartItemRow key={line.id} line={line} locale={locale} />
            ))}
          </ul>
          <CartSummary cart={cart} locale={locale} surface="drawer" />
        </>
      )}
    </Drawer>
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

function BagEmptyIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-auth-input-border)" }}
    >
      <rect
        x="10"
        y="18"
        width="36"
        height="30"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M20 18v-4a8 8 0 0116 0v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="30"
        x2="36"
        y2="30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}
