"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable from "@/components/admin/DataTable";
import AuditDiffModal from "@/components/admin/AuditDiffModal";
import { formatDateTime } from "@/lib/utils/date";
import {
  auditActionLabel,
  auditEntityLabel,
  auditCategory,
  auditEntityHref,
  AUDIT_CATEGORY_LABEL,
  eventVisual,
} from "@/lib/utils/audit-taxonomy";
import type { AuditLogListItem } from "@/lib/db/queries/audit-log";

interface Props {
  rows: AuditLogListItem[];
}

function CellLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        color: "inherit",
        textDecoration: hover ? "underline" : "none",
        cursor: "pointer",
      }}
    >
      {children}
    </Link>
  );
}

export default function AuditLogTable({ rows }: Props) {
  const [selected, setSelected] = useState<AuditLogListItem | null>(null);

  return (
    <>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        emptyMessage="No audit entries yet."
        onRowClick={(row) => setSelected(row)}
        columns={[
          {
            key: "when",
            header: "When",
            render: (row) => (
              <span style={{ color: "#6b6b6b" }}>
                {formatDateTime(row.createdAt, "en")}
              </span>
            ),
          },
          {
            key: "actor",
            header: "Actor",
            render: (row) => (
              <div>
                <p style={{ color: "#0b0b0b" }}>
                  {row.actorId != null ? (
                    <CellLink
                      href={`/admin/audit?${new URLSearchParams({
                        actorType: row.actorType,
                        actorId: row.actorId,
                      }).toString()}`}
                    >
                      {row.actorName}
                    </CellLink>
                  ) : (
                    row.actorName
                  )}
                </p>
                <p
                  style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}
                >
                  {row.actorType}
                </p>
              </div>
            ),
          },
          {
            key: "category",
            header: "Category",
            render: (row) => (
              <span
                style={{
                  color: "#6b6b6b",
                  fontSize: "var(--text-label)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                {AUDIT_CATEGORY_LABEL[auditCategory(row.entityType)]}
              </span>
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (row) => {
              const visual = eventVisual(row.action);
              return (
                <span
                  dir="ltr"
                  style={{
                    display: "inline-block",
                    padding: "0.125rem 0.5rem",
                    fontSize: "var(--text-label)",
                    fontWeight: "var(--font-semibold)",
                    color: visual.pillColor,
                    backgroundColor: visual.pillBg,
                  }}
                >
                  {auditActionLabel(row.action)}
                </span>
              );
            },
          },
          {
            key: "entity",
            header: "Entity",
            render: (row) => {
              const href = auditEntityHref(row.entityType, row.entityId);
              const label = auditEntityLabel(row.entityType);
              return (
                <div>
                  <p style={{ color: "#0b0b0b" }}>
                    {href ? (
                      <CellLink href={href}>{label}</CellLink>
                    ) : row.entityId != null ? (
                      <CellLink
                        href={`/admin/audit?${new URLSearchParams({
                          entityType: row.entityType,
                          entityId: row.entityId,
                        }).toString()}`}
                      >
                        {label}
                      </CellLink>
                    ) : (
                      label
                    )}
                  </p>
                  <p
                    dir="ltr"
                    style={{
                      fontSize: "var(--text-body-sm)",
                      color: "#9a9a9a",
                    }}
                  >
                    {row.entityId}
                  </p>
                </div>
              );
            },
          },
        ]}
      />
      <AuditDiffModal row={selected} onClose={() => setSelected(null)} />
    </>
  );
}
