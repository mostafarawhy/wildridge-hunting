"use client";

import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import TicketStatusPill from "@/components/ui/TicketStatusPill";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  getTicketPriorityTone,
  isTerminalTicketStatus,
  type StatusTone,
} from "@/lib/utils/ticket-status";
import type { AdminTicketListItemProjection } from "@/lib/db/queries/ticket";

const TONE_STYLES: Record<
  StatusTone,
  { backgroundColor: string; color: string }
> = {
  danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
  warning: { backgroundColor: "#fef9c3", color: "#854d0e" },
  info: { backgroundColor: "#dbeafe", color: "#1e40af" },
  neutral: { backgroundColor: "#f3f4f6", color: "#374151" },
  success: { backgroundColor: "#dcfce7", color: "#166534" },
};

interface Props {
  rows: AdminTicketListItemProjection[];
  currentStaffId: string;
}

export default function TicketsTable({ rows, currentStaffId }: Props) {
  const router = useRouter();

  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/tickets/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage="No tickets yet."
      columns={[
        {
          key: "ticketNumber",
          header: "Ticket #",
          render: (row) => (
            <span
              dir="ltr"
              style={{ fontFamily: "monospace", color: "#0b0b0b" }}
            >
              {row.ticketNumber}
            </span>
          ),
        },
        {
          key: "subject",
          header: "Subject",
          render: (row) => {
            const parts: React.ReactNode[] = [TICKET_CATEGORY_LABELS[row.category]];
            if (row.linked) {
              parts.push(
                <span
                  key="linked"
                  dir={
                    row.linked.kind === "order" || row.linked.kind === "quote"
                      ? "ltr"
                      : undefined
                  }
                  style={{
                    fontFamily:
                      row.linked.kind === "order" || row.linked.kind === "quote"
                        ? "monospace"
                        : undefined,
                  }}
                >
                  {row.linked.label}
                </span>,
              );
            }
            if (row.source) {
              parts.push(
                row.source === "customer" ? (
                  <span key="source" style={{ color: "#1e40af" }}>
                    Customer
                  </span>
                ) : (
                  <span key="source">Staff</span>
                ),
              );
            }
            return (
              <div>
                <p
                  style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}
                >
                  {row.subject}
                </p>
                <p
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: "#6b6b6b",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  {parts.map((part, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      {i > 0 && <span>·</span>}
                      {part}
                    </span>
                  ))}
                </p>
              </div>
            );
          },
        },
        {
          key: "priority",
          header: "Priority",
          render: (row) => {
            const tone = getTicketPriorityTone(row.priority);
            const toneStyle = TONE_STYLES[tone];
            return (
              <span
                style={{
                  display: "inline-block",
                  paddingInline: "0.5rem",
                  paddingBlock: "0.125rem",
                  fontSize: "var(--text-label)",
                  fontWeight: "var(--font-semibold)",
                  letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  ...toneStyle,
                }}
              >
                {TICKET_PRIORITY_LABELS[row.priority]}
              </span>
            );
          },
        },
        {
          key: "status",
          header: "Status",
          render: (row) => <TicketStatusPill status={row.status} />,
        },
        {
          key: "assignee",
          header: "Assignee",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {row.assignedToStaffId === currentStaffId
                ? "You"
                : (row.assignedToName ?? "—")}
            </span>
          ),
        },
        {
          key: "date",
          header: "Date",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "age",
          header: "Age",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {isTerminalTicketStatus(row.status) ? "—" : `${row.ageDays}d`}
            </span>
          ),
        },
      ]}
    />
  );
}
