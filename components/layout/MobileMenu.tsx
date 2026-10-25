"use client";

import { BRAND } from "@/lib/config/brand";
import { useState } from "react";
import BrandMark from "@/components/ui/BrandMark";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSignOut } from "@/hooks/useSignOut";
import {
  IconOrders,
  IconWishlist,
  IconLoyalty,
} from "@/components/ui/icons";
import type { NavItem } from "./nav-types";

interface SessionUser {
  name: string | null;
  email: string | null;
}

interface MobileMenuProps {
  items: NavItem[];
  sessionUser: SessionUser | null;
  onClose?: () => void;
}

export default function MobileMenu({
  items,
  sessionUser,
  onClose,
}: MobileMenuProps) {
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const tShop = useTranslations("shop");
  const tAccountNav = useTranslations("account.nav");
  const signOut = useSignOut();
  const [openHref, setOpenHref] = useState<string | null>(null);

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex flex-col min-h-full"
      style={{
        backgroundColor: "var(--color-surface-sunken)",
        color: "var(--color-content-primary)",
      }}
    >
      <div
        className="flex items-center justify-between px-6 h-16"
        style={{ borderBottom: "1px solid var(--color-border-default)" }}
      >
        <Link
          href="/"
          onClick={onClose}
          className="flex shrink-0 items-center gap-[10px]"
          aria-label={tNav("aria_home")}
        >
          <BrandMark size={52} />
          <span
            dir="ltr"
            className="brand-wordmark brand-wordmark--nav"
            style={{ color: "var(--color-content-primary)" }}
          >
            {BRAND.wordmark}
          </span>
        </Link>
        <button
          type="button"
          aria-label={tShop("close")}
          onClick={onClose}
          className="transition-opacity hover:opacity-70"
          style={{ color: "var(--color-content-primary)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        {sessionUser ? (
          <>
            <div className="flex items-center justify-between gap-4 mb-3">
              {sessionUser.name ? (
                <p
                  className="text-body truncate"
                  style={{ color: "var(--color-content-secondary)" }}
                >
                  {sessionUser.name}
                </p>
              ) : (
                <span />
              )}
              <Link
                href="/account"
                onClick={onClose}
                className="shrink-0 text-body transition-opacity hover:opacity-70"
                style={{ color: "var(--color-brand-on-dark)" }}
              >
                {tAuth("account")}
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  href: "/account/orders" as const,
                  label: tAccountNav("orders"),
                  icon: <IconOrders size={20} />,
                },
                {
                  href: "/account/wishlist" as const,
                  label: tAccountNav("wishlist"),
                  icon: <IconWishlist size={20} />,
                },
                {
                  href: "/account/loyalty" as const,
                  label: tAccountNav("loyalty"),
                  icon: <IconLoyalty size={20} />,
                },
              ].map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  onClick={onClose}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[10px] text-label transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "var(--color-surface-overlay)",
                    color: "var(--color-content-primary)",
                  }}
                >
                  {tile.icon}
                  <span>{tile.label}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/auth/login"
                onClick={onClose}
                className="flex items-center justify-center w-full h-11 text-body font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid var(--color-brand-on-dark)",
                  color: "var(--color-brand-on-dark)",
                }}
              >
                {tAuth("signIn")}
              </Link>
              <Link
                href="/auth/register"
                onClick={onClose}
                className="flex items-center justify-center w-full h-11 text-body font-bold tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "var(--color-action-primary)",
                  color: "var(--color-action-primary-fg)",
                }}
              >
                {tAuth("register.title")}
              </Link>
            </div>
            <Link
              href="/account/wishlist"
              onClick={onClose}
              className="mt-2 flex h-11 items-center text-body transition-opacity hover:opacity-70"
              style={{ color: "var(--color-content-secondary)" }}
            >
              {tNav("wishlist")}
            </Link>
          </>
        )}
      </div>

      <ul className="flex flex-col" role="list">
        {items.map((item) => {
          const hasColumns = !!item.columns && item.columns.length > 0;
          const isOpen = openHref === item.href;
          return (
            <li
              key={item.href}
              style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
            >
              {hasColumns ? (
                <>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenHref(isOpen ? null : item.href)}
                    className="flex w-full items-center justify-between px-6 py-4 text-body tracking-widest uppercase text-start"
                    style={{ color: "var(--color-content-primary)" }}
                  >
                    <span>{item.label}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      {!isOpen && <path d="M12 5v14" />}
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="ps-10 pe-6 pb-3">
                      {item.columns?.map((col) => (
                        <div key={col.href}>
                          <Link
                            href={col.href}
                            onClick={onClose}
                            className="block py-2 text-body"
                            style={{ color: "var(--color-content-primary)" }}
                          >
                            {col.label}
                          </Link>
                          <ul role="list">
                            {col.links.map((link) => (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  onClick={onClose}
                                  className="block ps-4 py-1.5 text-body-sm"
                                  style={{
                                    color: "var(--color-content-tertiary)",
                                  }}
                                >
                                  {link.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="block py-2 text-body-sm"
                        style={{ color: "var(--color-brand-on-dark)" }}
                      >
                        {tNav("shop_all")}{" "}
                        <span
                          aria-hidden="true"
                          className="inline-block flip-rtl"
                        >
                          →
                        </span>
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center px-6 py-4 text-body tracking-widest uppercase"
                  style={{ color: "var(--color-content-primary)" }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {sessionUser && (
        <div
          className="mt-auto px-6 py-6 space-y-4"
          style={{
            borderTop: "1px solid var(--color-border-default)",
            paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="flex h-11 w-full items-center text-body text-start transition-opacity hover:opacity-70"
            style={{ color: "var(--color-content-secondary)" }}
          >
            {tAuth("logout")}
          </button>
        </div>
      )}
    </nav>
  );
}
