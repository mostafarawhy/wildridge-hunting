"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";
import StaffAssignPicker from "@/components/admin/StaffAssignPicker";
import {
  transitionTicketAction,
  assignTicketAction,
  reopenTicketAction,
  updateTicketTriageAction,
} from "@/lib/actions/tickets";
import {
  TICKET_TRANSITIONS,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_LINK_KIND,
  isTerminalTicketStatus,
} from "@/lib/utils/ticket-status";
import type { TicketLinkKind } from "@/lib/utils/ticket-status";
import { formatDisplayDate } from "@/lib/utils/date";
import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "@/lib/db/queries/ticket";
import type { StaffRole } from "@/app/generated/prisma/client";

interface Props {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  linkKind: TicketLinkKind;
  assignedTo: { id: string; name: string; email: string } | null;
  assignableStaff: { id: string; name: string; email: string; role: StaffRole }[];
  canManage: boolean;
  closedAt: string | null;
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};

const closedPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  borderInlineStart: "3px solid var(--color-status-warning)",
  paddingInlineStart: "0.75rem",
};

const secondaryBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
};

export default function TicketManageActions({
  ticketId,
  status,
  priority,
  category,
  linkKind,
  assignedTo,
  assignableStaff,
  canManage,
  closedAt,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [transitionNote, setTransitionNote] = useState("");

  const [selectedPriority, setSelectedPriority] =
    useState<TicketPriority>(priority);
  const [selectedCategory, setSelectedCategory] =
    useState<TicketCategory>(category);

  const [selectedAssignee, setSelectedAssignee] = useState<string>(
    assignedTo?.id ?? "",
  );

  if (!canManage) {
    return (
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Read-only — insufficient permissions to take action.
      </p>
    );
  }

  const isTerminal = isTerminalTicketStatus(status);
  const transitions = isTerminal ? [] : TICKET_TRANSITIONS[status];

  const categoryOptions = (
    Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]
  ).filter((c) => TICKET_LINK_KIND[c] === linkKind || c === category);

  const triageUnchanged =
    selectedPriority === priority && selectedCategory === category;

  const mergedStaff: { id: string; name: string; email: string; role?: StaffRole }[] =
    [...assignableStaff];
  if (assignedTo && !assignableStaff.some((s) => s.id === assignedTo.id)) {
    mergedStaff.unshift(assignedTo);
  }

  function handleTransition() {
    const target = selectedStatus;
    if (!selectedStatus) return;
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await transitionTicketAction({
        ticketId,
        toStatus: selectedStatus,
        note: transitionNote.trim() || undefined,
      });
      if (result.success) {
        setSelectedStatus("");
        setTransitionNote("");
        toast.success(
          `Ticket moved to ${TICKET_STATUS_LABELS[target as TicketStatus]}.`,
        );
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  function handleTriage() {
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await updateTicketTriageAction({
        ticketId,
        priority: selectedPriority,
        category: selectedCategory,
      });
      if (result.success) {
        toast.success("Triage saved.");
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  function handleAssign() {
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await assignTicketAction({
        ticketId,
        assignedToStaffId: selectedAssignee === "" ? null : selectedAssignee,
      });
      if (result.success) {
        toast.success(
          selectedAssignee === ""
            ? "Ticket unassigned."
            : `Assigned to ${mergedStaff.find((s) => s.id === selectedAssignee)?.name ?? "the selected staff member"}.`,
        );
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  function handleReopen() {
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await reopenTicketAction({ ticketId });
      if (result.success) {
        toast.success("Ticket reopened.");
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {isTerminal && (
        <div style={closedPanelStyle}>
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              fontWeight: "var(--font-medium)",
            }}
          >
            {closedAt
              ? `This ticket was closed on ${formatDisplayDate(closedAt, "en")}.`
              : "This ticket is closed."}
          </p>
          <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
            Status changes, assignment and comments are disabled while a ticket
            is closed. Reopen it to continue working on this case.
          </p>
          <div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleReopen}
              style={{
                ...secondaryBtn,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              Reopen Ticket
            </button>
          </div>
        </div>
      )}

      {!isTerminal && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ width: "100%" }}>
            <Select
              label="Update status"
              id="ticket-status-select"
              value={selectedStatus}
              disabled={isPending}
              onChange={(e) =>
                setSelectedStatus(e.target.value as TicketStatus | "")
              }
            >
              <option value="" disabled>
                Select a status…
              </option>
              {transitions.map((t) => (
                <option key={t} value={t}>
                  {TICKET_STATUS_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <textarea
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Optional note…"
            disabled={isPending}
            style={textareaStyle}
          />

          <div>
            <button
              type="button"
              disabled={isPending || selectedStatus === ""}
              onClick={handleTransition}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor:
                  isPending || selectedStatus === ""
                    ? "not-allowed"
                    : "pointer",
                opacity: isPending || selectedStatus === "" ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              Update status
            </button>
          </div>
        </div>
      )}

      {!isTerminal && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            borderTop: "1px solid var(--color-shop-divider)",
            paddingTop: "1rem",
          }}
        >
          <div style={{ width: "100%" }}>
            <Select
              label="Priority"
              id="ticket-triage-priority"
              value={selectedPriority}
              disabled={isPending}
              onChange={(e) =>
                setSelectedPriority(e.target.value as TicketPriority)
              }
            >
              {(
                Object.entries(TICKET_PRIORITY_LABELS) as [string, string][]
              ).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: "100%" }}>
            <Select
              label="Category"
              id="ticket-triage-category"
              value={selectedCategory}
              disabled={isPending}
              onChange={(e) =>
                setSelectedCategory(e.target.value as TicketCategory)
              }
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <button
              type="button"
              disabled={isPending || triageUnchanged}
              onClick={handleTriage}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor:
                  isPending || triageUnchanged ? "not-allowed" : "pointer",
                opacity: isPending || triageUnchanged ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              Save triage
            </button>
          </div>
        </div>
      )}

      {!isTerminal && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            borderTop: "1px solid var(--color-shop-divider)",
            paddingTop: "1rem",
          }}
        >
          <div style={{ width: "100%" }}>
            <StaffAssignPicker
              id="ticket-assign-select"
              label="Assign to"
              staff={mergedStaff}
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              disabled={isPending}
            />
          </div>

          <div>
            <button
              type="button"
              disabled={isPending}
              onClick={handleAssign}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
            >
              Assign
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
          {errorCode && (
            <span style={{ color: "#6b6b6b" }}> ({errorCode})</span>
          )}
        </p>
      )}
    </div>
  );
}
