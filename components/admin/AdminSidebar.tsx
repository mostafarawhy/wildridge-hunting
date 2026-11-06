"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import { staffLogoutAction } from "@/lib/actions/staff-auth";
import type { StaffRole } from "@/app/generated/prisma/client";
import type { StaffPermission } from "@/lib/utils/staff-permissions";
import {
  IconDashboard,
  IconBox,
  IconTag,
  IconUpload,
  IconOrders,
  IconBusiness,
  IconUsers,
  IconUserCog,
  IconShield,
  IconStar,
  IconSettings,
  IconLogout,
  IconMenu,
  IconClose,
  IconTruck,
  IconQuote,
  IconChat,
  IconCoupon,
  IconPage,
  IconMapPin,
  IconStorefront,
  IconForm,
  IconMail,
  IconList,
  IconInbox,
  IconUserCircle,
  IconGift,
} from "./admin-icons";

interface Props {
  staffRole: StaffRole;
  name: string;
  email: string;
  navBadges: Record<string, number>;
}

interface NavLink {
  label: string;
  href: string;
  permission?: StaffPermission;
  icon: React.ComponentType;
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    links: [
      { label: "Dashboard", href: "/admin", permission: "dashboard:view", icon: IconDashboard },
    ],
  },
  {
    title: "Sales",
    links: [
      { label: "Orders", href: "/admin/orders", permission: "order:read", icon: IconOrders },
      { label: "Quotes", href: "/admin/quotes", permission: "quote:read", icon: IconQuote },
    ],
  },
  {
    title: "Customers",
    links: [
      { label: "Customers", href: "/admin/customers", permission: "customer:read", icon: IconUsers },
      { label: "Business Accounts", href: "/admin/b2b", permission: "b2b:read", icon: IconBusiness },
      { label: "Verification", href: "/admin/verification", permission: "verification:review", icon: IconShield },
      { label: "Tickets", href: "/admin/tickets", permission: "ticket:read", icon: IconChat },
    ],
  },
  {
    title: "Catalog",
    links: [
      { label: "Products", href: "/admin/products", permission: "catalog:write", icon: IconBox },
      { label: "Categories", href: "/admin/categories", permission: "catalog:write", icon: IconTag },
      { label: "Brands", href: "/admin/brands", permission: "catalog:write", icon: IconStar },
      { label: "Import", href: "/admin/import", permission: "catalog:import", icon: IconUpload },
    ],
  },
  {
    title: "Marketing",
    links: [
      { label: "Coupons", href: "/admin/coupons", permission: "coupon:manage", icon: IconCoupon },
      { label: "Reward Rules", href: "/admin/coupons/rewards", permission: "coupon:manage", icon: IconStar },
      { label: "Loyalty", href: "/admin/loyalty", permission: "loyalty:manage", icon: IconGift },
      { label: "Subscribers", href: "/admin/subscribers", permission: "coupon:manage", icon: IconMail },
    ],
  },
  {
    title: "Storefront",
    links: [
      { label: "Store Profile", href: "/admin/store-profile", permission: "content:manage", icon: IconStorefront },
      { label: "Store Pages", href: "/admin/pages", permission: "content:manage", icon: IconPage },
      { label: "Store Locations", href: "/admin/stores", permission: "content:manage", icon: IconMapPin },
      { label: "Homepage", href: "/admin/homepage", permission: "content:manage", icon: IconPage },
      { label: "Homepage Popup", href: "/admin/popup", permission: "content:manage", icon: IconPage },
      { label: "Site Banners", href: "/admin/site-banners", permission: "content:manage", icon: IconPage },
      { label: "Forms & Terms", href: "/admin/forms", permission: "content:manage", icon: IconForm },
      { label: "Email Templates", href: "/admin/email-templates", permission: "content:manage", icon: IconMail },
    ],
  },
  {
    title: "Settings",
    links: [
      { label: "General", href: "/admin/settings", permission: "settings:manage", icon: IconSettings },
      { label: "Shipping", href: "/admin/shipping", permission: "shipping:manage", icon: IconTruck },
    ],
  },
  {
    title: "Administration",
    links: [
      { label: "Staff", href: "/admin/staff", permission: "staff:manage", icon: IconUserCog },
      { label: "Audit Log", href: "/admin/audit", permission: "audit:read", icon: IconList },
      { label: "Email Log", href: "/admin/email-log", permission: "settings:manage", icon: IconInbox },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Account Settings", href: "/admin/account", icon: IconUserCircle },
    ],
  },
];

function NavBadge({ count }: { count: number }) {
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
        needs attention
      </span>
    </>
  );
}

function NavLinkItem({
  link,
  active,
  onClick,
  badge,
}: {
  link: NavLink;
  active: boolean;
  onClick?: () => void;
  badge: number;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.5625rem 1rem",
        fontSize: "var(--text-body)",
        fontWeight: active ? "var(--font-semibold)" : "var(--font-medium)",
        color: active ? "#0b0b0b" : "#6b6b6b",
        borderInlineStart: `2px solid ${active ? "var(--color-action-primary)" : "transparent"}`,
        backgroundColor: active ? "color-mix(in srgb, var(--color-action-primary) 5%, transparent)" : "transparent",
        textDecoration: "none",
        transition: "color 150ms, background-color 150ms",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "#0b0b0b";
          (e.currentTarget as HTMLElement).style.backgroundColor = "#f5f5f5";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color = "#6b6b6b";
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
        }
      }}
    >
      <Icon />
      <span>{link.label}</span>
      <NavBadge count={badge} />
    </Link>
  );
}

export default function AdminSidebar({
  staffRole,
  name,
  email,
  navBadges,
}: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((l) => !l.permission || can(staffRole, l.permission)),
  })).filter((group) => group.links.length > 0);

  const allHrefs = visibleGroups.flatMap((g) => g.links.map((l) => l.href));

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    const matches = pathname === href || pathname.startsWith(href + "/");
    if (!matches) return false;
    return !allHrefs.some(
      (other) =>
        other.length > href.length &&
        (pathname === other || pathname.startsWith(other + "/")),
    );
  }

  const activeLink = visibleGroups
    .flatMap((g) => g.links)
    .find((l) => isActive(l.href));

  const backLink = activeLink && pathname !== activeLink.href ? activeLink : null;

  const renderIdentity = () => (
    <div
      style={{ padding: "1rem", borderBottom: "1px solid var(--color-shop-divider)" }}
    >
      <p
        style={{
          fontSize: "var(--text-eyebrow)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "#6b6b6b",
          marginBottom: "0.25rem",
        }}
      >
        {STAFF_ROLE_LABELS[staffRole]}
      </p>
      <p
        style={{
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-semibold)",
          color: "#0b0b0b",
          marginBottom: "0.125rem",
        }}
      >
        {name}
      </p>
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        {email}
      </p>
    </div>
  );

  const renderNavContent = (onLinkClick?: () => void) => (
    <>
      {visibleGroups.map((group) => (
        <div key={group.title}>
          <p
            style={{
              fontSize: "var(--text-eyebrow)",
              fontWeight: "var(--font-bold)",
              letterSpacing: "var(--tracking-widest)",
              textTransform: "uppercase",
              color: "#6b6b6b",
              padding: "0.875rem 1rem 0.375rem",
            }}
          >
            {group.title}
          </p>
          {group.links.map((link) => (
            <NavLinkItem
              key={link.href}
              link={link}
              active={isActive(link.href)}
              onClick={onLinkClick}
              badge={navBadges[link.href] ?? 0}
            />
          ))}
        </div>
      ))}
      <form action={staffLogoutAction}>
        <button
          type="submit"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            width: "100%",
            padding: "0.5625rem 1rem",
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-medium)",
            color: "#6b6b6b",
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
            (e.currentTarget as HTMLElement).style.color = "#6b6b6b";
          }}
        >
          <IconLogout />
          <span>Sign out</span>
        </button>
      </form>
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
          alignSelf: "stretch",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {renderIdentity()}
        <nav aria-label="Admin navigation" style={{ padding: "0.5rem 0" }}>
          {renderNavContent()}
        </nav>
      </aside>

      <div
        className="flex lg:hidden"
        style={{
          alignItems: "center",
          gap: "0.75rem",
          position: "sticky",
          top: 0,
          zIndex: "var(--z-sticky)",
          height: "56px",
          padding: "0 1rem 0 0.5rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
        }}
      >
        <button
          aria-label="Open admin navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            flexShrink: 0,
            backgroundColor: "#0b0b0b",
            border: "none",
            borderRadius: "0",
            cursor: "pointer",
            color: "#ffffff",
          }}
        >
          <IconMenu />
        </button>
        {backLink ? (
          <Link
            href={backLink.href}
            aria-label={`Back to ${backLink.label}`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minWidth: 0,
              minHeight: "44px",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "#6b6b6b",
                marginBottom: "0.125rem",
              }}
            >
              {STAFF_ROLE_LABELS[staffRole]}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "#0b0b0b",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                style={{ flexShrink: 0, marginInlineStart: "-0.25rem" }}
              >
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {backLink.label}
            </span>
          </Link>
        ) : (
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: "var(--text-eyebrow)",
                fontWeight: "var(--font-bold)",
                letterSpacing: "var(--tracking-widest)",
                textTransform: "uppercase",
                color: "#6b6b6b",
                marginBottom: "0.125rem",
              }}
            >
              {STAFF_ROLE_LABELS[staffRole]}
            </p>
            <p
              style={{
                fontSize: "var(--text-body)",
                fontWeight: "var(--font-semibold)",
                color: "#0b0b0b",
              }}
            >
              {activeLink?.label ?? "Dashboard"}
            </p>
          </div>
        )}
      </div>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
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
              <div>{renderIdentity()}</div>
              <button
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "44px",
                  height: "44px",
                  flexShrink: 0,
                  backgroundColor: "#0b0b0b",
                  border: "none",
                  borderRadius: "0",
                  cursor: "pointer",
                  color: "#ffffff",
                }}
              >
                <IconClose />
              </button>
            </div>
            <nav
              aria-label="Admin navigation"
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
