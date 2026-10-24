"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setShopModeAction } from "@/lib/actions/shop-mode";
import type { ShopMode } from "@/lib/utils/shop-mode";

interface ShopModeSwitchProps {
  mode: ShopMode;
}

export default function ShopModeSwitch({ mode }: ShopModeSwitchProps) {
  const t = useTranslations("nav");
  const [isPending, startTransition] = useTransition();

  function handleSwitch(next: ShopMode) {
    if (next === mode || isPending) return;
    startTransition(() => {
      setShopModeAction(next);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        padding: "3px",
        backgroundColor: "var(--color-shop-divider)",
        borderRadius: "var(--radius-none)",
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 150ms",
      }}
    >
      {(["PERSONAL", "BUSINESS"] as const).map((seg) => {
        const isActive = mode === seg;
        return (
          <button
            key={seg}
            type="button"
            aria-pressed={isActive}
            disabled={isPending || isActive}
            onClick={() => handleSwitch(seg)}
            className="text-eyebrow uppercase tracking-widest transition-colors duration-150"
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 0",
              borderRadius: "var(--radius-none)",
              border: "none",
              backgroundColor: isActive
                ? "var(--color-action-primary)"
                : "transparent",
              color: isActive
                ? "var(--color-action-primary-fg)"
                : "var(--color-auth-label-text)",
              fontWeight: isActive
                ? "var(--font-semibold)"
                : "var(--font-medium)",
              whiteSpace: "nowrap",
              cursor: isActive || isPending ? "default" : "pointer",
            }}
          >
            {seg === "BUSINESS"
              ? t("shop_mode_business")
              : t("shop_mode_personal")}
          </button>
        );
      })}
    </div>
  );
}
