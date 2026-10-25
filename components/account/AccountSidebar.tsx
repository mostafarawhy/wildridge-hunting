"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSignOut } from "@/hooks/useSignOut";
import { IconOrders, IconWishlist, IconLoyalty } from "@/components/ui/icons";

interface Props {
  hasB2BAccount: boolean;
  userName: string;
  userEmail: string;
  badges: Record<string, number>;
}

interface NavItem {
  key: string;
  href: string;
  icon: React.ReactNode;
}

function IconOverview() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="5" height="5" rx="0.5" />
      <rect x="8" y="1" width="5" height="5" rx="0.5" />
      <rect x="1" y="8" width="5" height="5" rx="0.5" />
      <rect x="8" y="8" width="5" height="5" rx="0.5" />
    </svg>
  );
}

function IconQuotes() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 1h5l3 3v9a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5V1.5A.5.5 0 013 1z" />
      <path d="M8 1v3h3" />
      <path d="M4.5 7.5h5M4.5 10h3" />
    </svg>
  );
}

function IconAddresses() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12V4.5L7 1l6 3.5V12" />
      <rect x="5" y="7" width="4" height="5" />
    </svg>
  );
}

function IconVerification() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="5" r="3" />
      <path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
    </svg>
  );
}

function IconCoupons() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 5.5L5.5 1h5.5a2 2 0 012 2v5.5L8.5 13 1 5.5z" />
      <circle cx="9.5" cy="4.5" r="1" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="6" />
      <circle cx="7" cy="7" r="2.5" />
      <path d="M2.76 2.76l2.2 2.2M11.24 2.76l-2.2 2.2M2.76 11.24l2.2-2.2M11.24 11.24l-2.2-2.2" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.5 2.5l1 1M10.5 10.5l1 1M11.5 2.5l-1 1M3.5 10.5l-1 1" />
    </svg>
  );
}

function IconBusiness() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="12" height="9" rx="0.5" />
      <path d="M4 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M1 8h12" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3H2.5A1.5 1.5 0 001 4.5v5A1.5 1.5 0 002.5 11H5" />
      <path d="M9 10l3-3-3-3M12 7H5" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1 1l12 12M13 1L1 13" />
    </svg>
  );
}

function NavBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          marginInlineStart: "auto",
          flexShrink: 0,
          minWidth: "1.25rem",
          padding: "0.125rem 0.375rem",
          fontSize: "var(--text-body-sm)",
          fontWeight: "var(--font-semibold)",
          lineHeight: 1.2,
          textAlign: "center",
          color: "#1e40af",
          backgroundColor: "#dbeafe",
          borderRadius: "0",
        }}
      >
        {count}
      </span>
      <span
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        {label}
      </span>
    </>
  );
}

function NavLink({
  item,
  active,
  onClick,
  badge,
  badgeLabel,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
  badge: number;
  badgeLabel: string;
}) {
  return (
    <Link
      href={item.href as "/account"}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.5625rem 1rem",
        fontSize: "var(--text-body)",
        fontWeight: active ? "var(--font-semibold)" : "var(--font-medium)",
        color: active ? "var(--color-content-inverse)" : "var(--color-content-tertiary)",
        borderInlineStart: `2px solid ${active ? "var(--color-action-primary)" : "transparent"}`,
        backgroundColor: active ? "color-mix(in srgb, var(--color-action-primary) 5%, transparent)" : "transparent",
        textDecoration: "none",
        transition: "color 150ms, background-color 150ms",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "var(--color-content-inverse)";
          (e.currentTarget as HTMLElement).style.backgroundColor = "#f5f5f5";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "var(--color-content-tertiary)";
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
        }
      }}
    >
      {item.icon}
      <span>{item.key}</span>
      <NavBadge count={badge} label={badgeLabel} />
    </Link>
  );
}

export default function AccountSidebar({
  hasB2BAccount,
  userName,
  userEmail,
  badges,
}: Props) {
  const t = useTranslations("account.nav");
  const pathname = usePathname();
  const signOut = useSignOut();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const baseItems: NavItem[] = [
    { key: t("overview"), href: "/account", icon: <IconOverview /> },
    { key: t("orders"), href: "/account/orders", icon: <IconOrders /> },
    ...(hasB2BAccount
      ? [{ key: t("quotes"), href: "/account/quotes", icon: <IconQuotes /> }]
      : []),
    { key: t("wishlist"), href: "/account/wishlist", icon: <IconWishlist /> },
    {
      key: t("addresses"),
      href: "/account/addresses",
      icon: <IconAddresses />,
    },
    {
      key: t("verification"),
      href: "/account/verification",
      icon: <IconVerification />,
    },
    { key: t("loyalty"), href: "/account/loyalty", icon: <IconLoyalty /> },
    { key: t("coupons"), href: "/account/coupons", icon: <IconCoupons /> },
    ...(hasB2BAccount
      ? [{ key: t("b2b"), href: "/account/b2b", icon: <IconBusiness /> }]
      : []),
    { key: t("support"), href: "/account/support", icon: <IconSupport /> },
    { key: t("settings"), href: "/account/settings", icon: <IconSettings /> },
  ];

  function isActive(href: string) {
    if (href === "/account") return pathname === "/account";
    return pathname.startsWith(href);
  }

  const activeItem = baseItems.find((i) => isActive(i.href));

  const renderNavContent = (onLinkClick?: () => void) => (
    <>
      {baseItems.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(item.href)}
          onClick={onLinkClick}
          badge={badges[item.href] ?? 0}
          badgeLabel={t("needsAttention")}
        />
      ))}
      <div
        style={{
          height: "1px",
          backgroundColor: "var(--color-shop-divider)",
          margin: "0.5rem 0",
        }}
      />
      <div>
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            width: "100%",
            padding: "0.5625rem 1rem",
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-medium)",
            color: "var(--color-content-tertiary)",
            background: "none",
            border: "none",
            borderInlineStart: "2px solid transparent",
            cursor: "pointer",
            textAlign: "start",
            transition: "color 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--color-action-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--color-content-tertiary)";
          }}
        >
          <IconLogout />
          <span>{t("logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside
        className="hidden lg:flex"
        style={{
          width: "var(--spacing-sidebar)",
          flexShrink: 0,
          flexDirection: "column",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          borderRadius: "var(--radius-none)",
          alignSelf: "flex-start",
          position: "sticky",
          top: "calc(var(--spacing-header) + 1.5rem)",
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid var(--color-shop-divider)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "var(--color-content-tertiary)",
              marginBottom: "0.25rem",
            }}
          >
            {t("title")}
          </p>
          <p
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-content-inverse)",
              marginBottom: "0.125rem",
            }}
          >
            {userName}
          </p>
          <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)" }}>
            {userEmail}
          </p>
        </div>
        <nav aria-label={t("title")} style={{ padding: "0.5rem 0" }}>
          {renderNavContent()}
        </nav>
      </aside>

      <div
        className="flex lg:hidden"
        style={{
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
          marginBottom: "1rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "var(--color-content-tertiary)",
              marginBottom: "0.125rem",
            }}
          >
            {t("title")}
          </p>
          <p
            style={{
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-semibold)",
              color: "var(--color-content-inverse)",
            }}
          >
            {activeItem?.key ?? t("overview")}
          </p>
        </div>
        <button
          aria-label="Open account navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.25rem",
            height: "2.25rem",
            background: "none",
            border: "1px solid var(--color-shop-divider)",
            cursor: "pointer",
            color: "var(--color-content-tertiary)",
          }}
        >
          <IconMenu />
        </button>
      </div>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
          style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)" }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              insetBlockStart: 0,
              insetBlockEnd: 0,
              insetInlineStart: 0,
              width: "min(20rem, 85vw)",
              backgroundColor: "#ffffff",
              borderInlineEnd: "1px solid var(--color-shop-divider)",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem",
                borderBottom: "1px solid var(--color-shop-divider)",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "var(--text-eyebrow)",
                    fontWeight: "var(--font-bold)",
                    letterSpacing: "var(--tracking-widest)",
                    textTransform: "uppercase",
                    color: "var(--color-content-tertiary)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {t("title")}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-body)",
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-content-inverse)",
                  }}
                >
                  {userName}
                </p>
                <p
                  style={{ fontSize: "var(--text-body-sm)", color: "var(--color-content-tertiary)" }}
                >
                  {userEmail}
                </p>
              </div>
              <button
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  background: "none",
                  border: "1px solid var(--color-shop-divider)",
                  cursor: "pointer",
                  color: "var(--color-content-tertiary)",
                  flexShrink: 0,
                }}
              >
                <IconClose />
              </button>
            </div>
            <nav
              aria-label={t("title")}
              style={{ padding: "0.5rem 0", flex: 1 }}
            >
              {renderNavContent(() => setDrawerOpen(false))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
