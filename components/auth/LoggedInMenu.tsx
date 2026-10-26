"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSignOut } from "@/hooks/useSignOut";
import ShopModeSwitch from "@/components/layout/ShopModeSwitch";
import type { ShopMode } from "@/lib/utils/shop-mode";

interface LoggedInMenuProps {
  session: {
    name: string | null;
    email: string;
  };
  onItemClick: () => void;
  canUseBusinessMode?: boolean;
  shopMode?: ShopMode;
  touch?: boolean;
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function UserCircleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.2 18.5a7 7 0 0 1 11.6 0" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

const baseItems = [
  { labelKey: "myAccount", href: "/account", Icon: UserCircleIcon },
  { labelKey: "myOrders", href: "/account/orders", Icon: PackageIcon },
] as const;

const quotesItem = {
  labelKey: "quotes",
  href: "/account/quotes",
  Icon: FileTextIcon,
} as const;

const rowClass =
  "text-body flex items-center transition-colors duration-150 hover:bg-[var(--color-shop-bg)]";
const rowStyle = {
  gap: "0.625rem",
  padding: "0.625rem",
  color: "var(--primitive-black)",
} as const;

function initialsFor(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => Array.from(w)[0])
      .join("")
      .toUpperCase();
  }
  return (Array.from(email)[0] ?? "").toUpperCase();
}

export default function LoggedInMenu({
  session,
  onItemClick,
  canUseBusinessMode = false,
  shopMode = "PERSONAL",
  touch = false,
}: LoggedInMenuProps) {
  const t = useTranslations("auth");
  const signOut = useSignOut();
  const tNav = useTranslations("nav");
  const displayName = session.name ?? session.email;
  const menuItems = canUseBusinessMode
    ? [...baseItems, quotesItem]
    : baseItems;
  const itemStyle = touch
    ? { ...rowStyle, padding: "0.875rem 0.75rem" }
    : rowStyle;

  return (
    <div>
      <div
        className="flex items-center"
        style={{ padding: "1rem 1rem 0.75rem", gap: "0.625rem" }}
      >
        <span
          aria-hidden="true"
          className="text-body-sm flex shrink-0 items-center justify-center"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "var(--primitive-black)",
            color: "var(--color-accent)",
            fontWeight: "var(--font-semibold)",
          }}
        >
          {initialsFor(session.name, session.email)}
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            className="text-body"
            style={{
              color: "var(--primitive-black)",
              fontWeight: "var(--font-semibold)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </p>
          {session.name && (
            <p
              className="text-body-sm"
              style={{
                color: "var(--color-content-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.email}
            </p>
          )}
        </div>
      </div>

      {canUseBusinessMode && (
        <div style={{ padding: "0 1rem 0.875rem" }}>
          <p
            className="text-eyebrow uppercase tracking-widest mb-1.5"
            style={{ color: "var(--color-content-tertiary)" }}
          >
            {tNav("shop_mode_label")}
          </p>
          <ShopModeSwitch mode={shopMode} />
        </div>
      )}

      <nav role="menu">
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "6px",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          {menuItems.map(({ labelKey, href, Icon }) => (
            <li key={href} role="none">
              <Link
                href={href}
                role="menuitem"
                onClick={onItemClick}
                className={rowClass}
                style={itemStyle}
              >
                <span style={{ color: "var(--color-content-tertiary)", display: "flex" }}>
                  <Icon />
                </span>
                {t(labelKey)}
              </Link>
            </li>
          ))}
        </ul>

        <div
          style={{
            padding: "6px",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onItemClick();
              void signOut();
            }}
            className={`${rowClass} w-full cursor-pointer`}
            style={{
              ...itemStyle,
              textAlign: "start",
              background: "none",
              border: "none",
              color: "var(--color-action-primary)",
            }}
          >
            <LogoutIcon />
            {t("logout")}
          </button>
        </div>
      </nav>
    </div>
  );
}
