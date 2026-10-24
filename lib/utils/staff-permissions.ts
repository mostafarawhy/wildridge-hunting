import type { StaffRole } from "@/app/generated/prisma/client";
import {
  DEMO_BLOCKED_PERMISSIONS,
  DEMO_GRANTED_PERMISSIONS,
  isDemoRestricted,
} from "@/lib/config/demo";

export type StaffPermission =
  | "dashboard:view"
  | "catalog:write"
  | "catalog:import"
  | "order:read"
  | "order:update"
  | "quote:read"
  | "quote:manage"
  | "b2b:read"
  | "b2b:approve"
  | "customer:read"
  | "customer:manage"
  | "verification:review"
  | "verification:approve"
  | "stock:manage"
  | "shipping:manage"
  | "coupon:manage"
  | "staff:manage"
  | "settings:manage"
  | "content:manage"
  | "loyalty:manage"
  | "ticket:read"
  | "ticket:manage"
  | "audit:read"
  | "compliance:override"
  | "order:mark_paid"
  | "order:record_contact";

const PERMISSION_SET: Record<StaffPermission, true> = {
  "dashboard:view": true,
  "catalog:write": true,
  "catalog:import": true,
  "order:read": true,
  "order:update": true,
  "quote:read": true,
  "quote:manage": true,
  "b2b:read": true,
  "b2b:approve": true,
  "customer:read": true,
  "customer:manage": true,
  "verification:review": true,
  "verification:approve": true,
  "stock:manage": true,
  "shipping:manage": true,
  "coupon:manage": true,
  "staff:manage": true,
  "settings:manage": true,
  "content:manage": true,
  "loyalty:manage": true,
  "ticket:read": true,
  "ticket:manage": true,
  "audit:read": true,
  "compliance:override": true,
  "order:mark_paid": true,
  "order:record_contact": true,
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_SET) as StaffPermission[];

export const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  OPS_MANAGER: ALL_PERMISSIONS.filter(
    (p) =>
      p !== "catalog:import" &&
      p !== "staff:manage" &&
      p !== "settings:manage" &&
      p !== "content:manage" &&
      p !== "loyalty:manage" &&
      p !== "audit:read" &&
      p !== "compliance:override" &&
      p !== "order:mark_paid",
  ),
  CATALOG_MGR: ["dashboard:view", "catalog:write"],
  ORDER_MGR: [
    "dashboard:view",
    "order:read",
    "order:update",
    "quote:read",
    "quote:manage",
    "customer:read",
    "ticket:read",
    "ticket:manage",
    "order:record_contact",
  ],
  WAREHOUSE: ["dashboard:view", "order:read", "stock:manage", "ticket:read"],
  FINANCE: [
    "dashboard:view",
    "order:read",
    "quote:read",
    "ticket:read",
    "order:mark_paid",
    "order:record_contact",
  ],
  SUPPORT: [
    "dashboard:view",
    "customer:read",
    "order:read",
    "quote:read",
    "b2b:read",
    "verification:review",
    "ticket:read",
    "ticket:manage",
    "order:record_contact",
  ],
  STAFF_ADMIN: ["dashboard:view", "staff:manage", "audit:read"],
};

export function canPerform(role: StaffRole, perm: StaffPermission): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (isDemoRestricted(role)) {
    if (DEMO_BLOCKED_PERMISSIONS.includes(perm)) return false;
    if (DEMO_GRANTED_PERMISSIONS.includes(perm)) return true;
  }
  return ROLE_PERMISSIONS[role].includes(perm);
}

export function can(role: StaffRole, perm: StaffPermission): boolean {
  if (isDemoRestricted(role)) return true;
  return canPerform(role, perm);
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_MANAGER: "Operations Manager",
  CATALOG_MGR: "Catalog Manager",
  ORDER_MGR: "Order Manager",
  WAREHOUSE: "Warehouse",
  FINANCE: "Finance",
  SUPPORT: "Support",
  STAFF_ADMIN: "Staff Administrator",
};

export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  "dashboard:view": "View dashboard",
  "catalog:write": "Manage catalog",
  "catalog:import": "Import catalog",
  "order:read": "View orders",
  "order:update": "Update orders",
  "quote:read": "View quotes",
  "quote:manage": "Manage quotes",
  "b2b:read": "View B2B accounts",
  "b2b:approve": "Approve B2B accounts",
  "customer:read": "View customers",
  "customer:manage": "Manage customers",
  "verification:review": "Review verifications",
  "verification:approve": "Approve verifications",
  "stock:manage": "Manage stock",
  "shipping:manage": "Manage shipping",
  "coupon:manage": "Manage coupons",
  "staff:manage": "Manage staff",
  "settings:manage": "Manage settings",
  "content:manage": "Manage storefront content",
  "loyalty:manage": "Manage loyalty program",
  "ticket:read": "View tickets",
  "ticket:manage": "Manage tickets",
  "audit:read": "View audit log",
  "compliance:override": "Override compliance decisions",
  "order:mark_paid": "Record payments and refunds",
  "order:record_contact": "Record customer contact attempts",
};
