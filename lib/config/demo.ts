import type { StaffRole } from "@/app/generated/prisma/client";
import type { StaffPermission } from "@/lib/utils/staff-permissions";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export const DEMO_RESTRICTED_MESSAGE = "This action is disabled in the demo";
export const DEMO_UPLOAD_MESSAGE = "File uploads are disabled in the demo";

export const DEMO_UPLOAD_BUCKETS: readonly string[] = [
  "product-images",
  "site-media",
];

export const DEMO_BLOCKED_PERMISSIONS: readonly StaffPermission[] = [
  "staff:manage",
  "settings:manage",
  "shipping:manage",
  "catalog:import",
];

export const DEMO_GRANTED_PERMISSIONS: readonly StaffPermission[] = [
  "order:mark_paid",
  "loyalty:manage",
  "content:manage",
];

export type DemoGateToken = StaffPermission | "delete" | "upload";

export function isDemoRestricted(role: StaffRole): boolean {
  return isDemoMode() && role !== "SUPER_ADMIN";
}

export function demoBlocks(role: StaffRole, token: DemoGateToken): boolean {
  if (!isDemoRestricted(role)) return false;
  if (token === "delete" || token === "upload") return true;
  return DEMO_BLOCKED_PERMISSIONS.includes(token);
}

export const DEMO_PLACEHOLDER_DOCUMENT = {
  filename: "sample-document.png",
  mimeType: "image/png",
  key: "demo/sample-document.png",
} as const;

export function demoUploadRefusal<T>(): T {
  return {
    success: false,
    error: DEMO_UPLOAD_MESSAGE,
    errorCode: "DEMO_UPLOADS_DISABLED",
  } as unknown as T;
}
