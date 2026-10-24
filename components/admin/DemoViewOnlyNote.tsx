import { demoGate } from "@/lib/auth-staff";
import { DEMO_BLOCKED_PERMISSIONS, isDemoMode } from "@/lib/config/demo";
import type { StaffPermission } from "@/lib/utils/staff-permissions";

export default async function DemoViewOnlyNote({
  permission,
}: {
  permission: StaffPermission;
}) {
  if (!isDemoMode() || !DEMO_BLOCKED_PERMISSIONS.includes(permission)) {
    return null;
  }
  if ((await demoGate(permission)) === null) return null;

  return (
    <div
      role="status"
      style={{
        padding: "0.625rem 0.875rem",
        marginBottom: "1.5rem",
        fontSize: "var(--text-body-sm)",
        backgroundColor: "var(--color-status-warning-bg)",
        border: "1px solid var(--color-status-warning-border)",
        color: "var(--color-status-warning-text)",
      }}
    >
      Demo view only. Saving changes on this page is turned off for the demo staff account.
    </div>
  );
}
