import type { StaffPermission } from "@/lib/utils/staff-permissions";

export type PermissionArea =
  | "Overview"
  | "Sales"
  | "Customers"
  | "Catalog"
  | "Marketing"
  | "Storefront"
  | "Settings"
  | "Administration";

export const PERMISSION_AREA_ORDER: PermissionArea[] = [
  "Overview",
  "Sales",
  "Customers",
  "Catalog",
  "Marketing",
  "Storefront",
  "Settings",
  "Administration",
];

export const PERMISSION_AREA: Record<StaffPermission, PermissionArea> = {
  "dashboard:view": "Overview",
  "order:read": "Sales",
  "order:update": "Sales",
  "order:mark_paid": "Sales",
  "order:record_contact": "Sales",
  "quote:read": "Sales",
  "quote:manage": "Sales",
  "customer:read": "Customers",
  "customer:manage": "Customers",
  "b2b:read": "Customers",
  "b2b:approve": "Customers",
  "verification:review": "Customers",
  "verification:approve": "Customers",
  "compliance:override": "Customers",
  "ticket:read": "Customers",
  "ticket:manage": "Customers",
  "catalog:write": "Catalog",
  "catalog:import": "Catalog",
  "stock:manage": "Catalog",
  "coupon:manage": "Marketing",
  "loyalty:manage": "Marketing",
  "content:manage": "Storefront",
  "settings:manage": "Settings",
  "shipping:manage": "Settings",
  "staff:manage": "Administration",
  "audit:read": "Administration",
};
