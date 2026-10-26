"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useCartStore } from "@/lib/stores/cart-store";
import { useQuoteStore, selectQuoteCount } from "@/lib/stores/quote-store";
import { useSearchStore } from "@/lib/stores/search-store";
import { useAuthBusyStore } from "@/lib/stores/auth-busy-store";
import { BRAND } from "@/lib/config/brand";
import BottomSheet from "@/components/ui/BottomSheet";
import LoggedInMenu from "@/components/auth/LoggedInMenu";
import type { ShopMode } from "@/lib/utils/shop-mode";

interface MobileTabBarProps {
  session: { name: string | null; email: string } | null;
  canUseBusinessMode: boolean;
  shopMode: ShopMode;
  isBusinessMode: boolean;
}

const subscribe = () => () => {};

export default function MobileTabBar({
  session,
  canUseBusinessMode,
  shopMode,
  isBusinessMode,
}: MobileTabBarProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const tShop = useTranslations("shop");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const searchOpen = useSearchStore((s) => s.open);
  const toggleSearch = useSearchStore((s) => s.toggle);
  const openCart = useCartStore((s) => s.openDrawer);
  const cartCount = useCartStore((s) => s.cart?.totals.itemCount ?? 0);
  const openQuote = useQuoteStore((s) => s.openDrawer);
  const quoteCount = useQuoteStore(selectQuoteCount);
  const pending = useAuthBusyStore((st) => st.pending);
  const [accountOpen, setAccountOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const isProductPage = segments.length === 3 && segments[0] === "shop";
  if (!mounted || isProductPage) return null;

  const homeActive = pathname === "/";
  const shopActive = pathname.startsWith("/shop");
  const accountActive = pathname.startsWith("/account") || accountOpen;
  const busy =
    (pending === "sign-in" && !session) || (pending === "sign-out" && !!session);

  function handleGuestClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("auth", "login");
    window.history.pushState(null, "", `${pathname}?${params.toString()}`);
  }

  return createPortal(
    <>
    <nav
      aria-label={t("aria_tabbar")}
      data-mobile-tabbar
      className="lg:hidden fixed bottom-0 flex items-stretch"
      style={{
        insetInline: 0,
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxSizing: "border-box",
        backgroundColor: "var(--primitive-white)",
        borderTop: "1px solid var(--color-shop-divider)",
        zIndex: "var(--z-sticky)",
      }}
    >
      <Link
        href="/"
        aria-current={homeActive ? "page" : undefined}
        className={cellClass}
        style={cellStyle(homeActive)}
      >
        <HomeIcon />
        <Label>{t("tab_home")}</Label>
      </Link>

      <Link
        href="/shop"
        aria-current={shopActive ? "page" : undefined}
        className={cellClass}
        style={cellStyle(shopActive)}
      >
        <ShopIcon />
        <Label>{t("tab_shop")}</Label>
      </Link>

      <button
        type="button"
        aria-label={t("search")}
        aria-expanded={searchOpen}
        onClick={toggleSearch}
        className={cellClass}
        style={cellStyle(false)}
      >
        <SearchGlyph />
        <Label>{t("search")}</Label>
      </button>

      {busy ? (
        <button
          type="button"
          disabled
          aria-busy="true"
          className={cellClass}
          style={cellStyle(false)}
        >
          <span
            aria-hidden="true"
            className="btn-spinner"
            style={{
              display: "inline-block",
              width: "20px",
              height: "20px",
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              marginInlineEnd: 0,
              flexShrink: 0,
            }}
          />
          <Label>{t("account")}</Label>
        </button>
      ) : session ? (
        <button
          type="button"
          aria-label={`${tAuth("account")}, ${session.name ?? session.email}`}
          aria-haspopup="dialog"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen(true)}
          className={cellClass}
          style={cellStyle(accountActive)}
        >
          <Image
            src={BRAND.accountAvatar}
            width={26}
            height={26}
            alt=""
            style={{ objectFit: "contain", display: "block" }}
          />
          <Label>{t("account")}</Label>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleGuestClick}
          className={cellClass}
          style={cellStyle(false)}
        >
          <AccountIcon />
          <Label>{t("account")}</Label>
        </button>
      )}

      {isBusinessMode ? (
        <button
          type="button"
          aria-label={t("aria_quote", { count: quoteCount })}
          onClick={openQuote}
          className={cellClass}
          style={cellStyle(false)}
        >
          <span className="relative flex">
            <QuoteGlyph />
            <Badge count={quoteCount} />
          </span>
          <Label>{t("tab_quote")}</Label>
        </button>
      ) : (
        <button
          type="button"
          aria-label={t("aria_cart", { count: cartCount })}
          onClick={openCart}
          className={cellClass}
          style={cellStyle(false)}
        >
          <span className="relative flex">
            <CartGlyph />
            <Badge count={cartCount} />
          </span>
          <Label>{t("cart")}</Label>
        </button>
      )}
    </nav>
    {session && (
      <BottomSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        ariaLabel={tAuth("account")}
        title={tAuth("account")}
        closeLabel={tShop("close")}
      >
        <LoggedInMenu
          session={session}
          onItemClick={() => setAccountOpen(false)}
          canUseBusinessMode={canUseBusinessMode}
          shopMode={shopMode}
          touch
        />
      </BottomSheet>
    )}
    </>,
    document.body,
  );
}

const cellClass =
  "flex flex-1 min-w-0 flex-col items-center justify-center gap-[3px] cursor-pointer transition-opacity duration-150 active:opacity-60";

function cellStyle(active: boolean) {
  return {
    color: active
      ? "var(--color-action-primary)"
      : "var(--color-content-tertiary)",
    background: "none",
    border: "none",
    padding: 0,
  };
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span
      className="max-w-full truncate"
      style={{ fontSize: "11px", lineHeight: 1.2 }}
    >
      {children}
    </span>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute flex items-center justify-center"
      style={{
        top: "-6px",
        insetInlineEnd: "-9px",
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
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Glyph({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Glyph>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Glyph>
  );
}

function ShopIcon() {
  return (
    <Glyph>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </Glyph>
  );
}

function SearchGlyph() {
  return (
    <Glyph>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M16.5 16.5 21 21" />
    </Glyph>
  );
}

function AccountIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Glyph>
  );
}

function CartGlyph() {
  return (
    <Glyph>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </Glyph>
  );
}

function QuoteGlyph() {
  return (
    <Glyph>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h8M8 9h2" />
    </Glyph>
  );
}
