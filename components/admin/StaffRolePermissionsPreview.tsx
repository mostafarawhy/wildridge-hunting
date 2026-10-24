"use client";

import {
  ROLE_PERMISSIONS,
  STAFF_PERMISSION_LABELS,
} from "@/lib/utils/staff-permissions";
import type { StaffRole } from "@/app/generated/prisma/client";

interface Props {
  role: StaffRole;
}

export default function StaffRolePermissionsPreview({ role }: Props) {
  const perms = ROLE_PERMISSIONS[role];

  return (
    <div>
      <span
        style={{
          display: "block",
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-bold)",
          letterSpacing: "var(--tracking-widest)",
          textTransform: "uppercase",
          color: "#9a9a9a",
          marginBottom: "0.375rem",
        }}
      >
        Permissions
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "1rem", rowGap: "0.125rem" }}>
        {perms.map((perm) => (
          <div
            key={perm}
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
              lineHeight: "1.6",
            }}
          >
            {STAFF_PERMISSION_LABELS[perm]}
          </div>
        ))}
      </div>
    </div>
  );
}
