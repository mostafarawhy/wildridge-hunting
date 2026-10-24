"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import CouponStatusPill from "@/components/admin/CouponStatusPill";
import CopyCodeButton from "@/components/admin/CopyCodeButton";
import { useToast } from "@/components/ui/Toast";
import { toggleCouponAction } from "@/lib/actions/coupon";
import {
  describeConditions,
  describeDiscount,
  describeSchedule,
} from "@/lib/utils/coupon-display";
import type { AdminCouponRow } from "@/lib/db/queries/coupon";

interface Props {
  rows: AdminCouponRow[];
}

const mutedSmall: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
};

const actionButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function CouponsTable({ rows }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(row: AdminCouponRow) {
    const pausing = row.status !== "PAUSED";
    setBusyId(row.id);
    const result = await toggleCouponAction(row.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(pausing ? "Coupon paused." : "Coupon resumed.");
    router.refresh();
  }

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/coupons/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage="No coupons match these filters."
      columns={[
        {
          key: "code",
          header: "Code",
          render: (row) => (
            <div>
              <p
                dir="ltr"
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "var(--font-bold)",
                  color: "#0b0b0b",
                }}
              >
                {row.code}
              </p>
              <p style={mutedSmall}>
                {row.source === "manual"
                  ? "Created by staff"
                  : `Reward · ${row.sourceRuleName ?? ""}${row.customerEmail ? ` · ${row.customerEmail}` : ""}`}
              </p>
            </div>
          ),
        },
        {
          key: "discount",
          header: "Discount",
          render: (row) => describeDiscount(row),
        },
        {
          key: "conditions",
          header: "Conditions",
          render: (row) => (
            <span style={mutedSmall}>{describeConditions(row)}</span>
          ),
        },
        {
          key: "usage",
          header: "Usage",
          render: (row) => {
            if (row.usageLimit == null) {
              return (
                <span dir="ltr" style={{ whiteSpace: "nowrap" }}>
                  {row.usedCount} used · no limit
                </span>
              );
            }
            const percent = Math.min(
              100,
              Math.round((row.usedCount / row.usageLimit) * 100),
            );
            return (
              <div dir="ltr">
                <span style={{ whiteSpace: "nowrap" }}>
                  {row.usedCount} / {row.usageLimit}
                </span>
                <div
                  aria-hidden="true"
                  style={{
                    width: "6rem",
                    height: "4px",
                    marginTop: "0.25rem",
                    backgroundColor: "#e8e8e8",
                  }}
                >
                  <div
                    style={{
                      width: `${percent}%`,
                      height: "100%",
                      backgroundColor: "#0b0b0b",
                    }}
                  />
                </div>
              </div>
            );
          },
        },
        {
          key: "schedule",
          header: "Schedule",
          render: (row) => (
            <span style={mutedSmall}>
              {describeSchedule(row.status, row.startsAt, row.endsAt)}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => <CouponStatusPill status={row.status} />,
        },
        {
          key: "actions",
          header: "",
          align: "end",
          render: (row) => {
            const canToggle =
              row.status === "ACTIVE" ||
              row.status === "SCHEDULED" ||
              row.status === "PAUSED";
            const busy = busyId === row.id;
            return (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexWrap: "nowrap",
                  gap: "0.75rem",
                }}
              >
                <CopyCodeButton code={row.code} label="Copy" />
                {canToggle && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle(row);
                    }}
                    style={{ ...actionButton, opacity: busy ? 0.6 : 1 }}
                  >
                    {row.status === "PAUSED" ? "Resume" : "Pause"}
                  </button>
                )}
                {row.source === "manual" && (
                  <Link
                    href={`/admin/coupons/new?from=${row.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      startNavigationProgress(`/admin/coupons/new?from=${row.id}`);
                    }}
                    style={{
                      fontSize: "var(--text-body)",
                      color: "#0b0b0b",
                      textDecoration: "underline",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Duplicate
                  </Link>
                )}
              </div>
            );
          },
        },
      ]}
    />
  );
}
