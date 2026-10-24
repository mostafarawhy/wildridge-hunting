"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_QUICK_VIEWS,
  type TicketQuickViewParams,
} from "@/lib/utils/ticket-status";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { TicketStatus, TicketPriority, TicketCategory } from "@/lib/db/queries/ticket";

type LinkKind = "order" | "quote" | "b2b" | "verification" | "none";

interface AssignableStaffOption {
  id: string;
  name: string;
}

interface QuickViewCounts {
  active: number;
  unassigned: number;
  mine: number;
  urgent: number;
  waiting: number;
  customer: number;
}

interface Props {
  activeStatus: TicketStatus | "ACTIVE" | "ALL";
  activePriority: TicketPriority | "ALL";
  activeCategory: TicketCategory | "ALL";
  activeLink: LinkKind | "ALL";
  activeAssignee: string;
  activeSource: "customer" | "staff" | "ALL";
  activeSort: "priority" | "newest" | "oldest" | "updated";
  query: string;
  from: string;
  to: string;
  assignableStaff: AssignableStaffOption[];
  counts: QuickViewCounts;
}

const STATUS_OPTIONS: (TicketStatus | "ACTIVE" | "ALL")[] = [
  "ACTIVE",
  "ALL",
  ...(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]),
];

const PRIORITY_OPTIONS: (TicketPriority | "ALL")[] = [
  "ALL",
  ...(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]),
];

const CATEGORY_OPTIONS: (TicketCategory | "ALL")[] = [
  "ALL",
  ...(Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]),
];

const LINK_OPTIONS: { value: LinkKind | "ALL"; label: string }[] = [
  { value: "ALL", label: "Any" },
  { value: "order", label: "Order" },
  { value: "quote", label: "Quote" },
  { value: "b2b", label: "B2B account" },
  { value: "verification", label: "Verification case" },
  { value: "none", label: "None" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  backgroundColor: "#ffffff",
  border: "1.5px solid var(--color-shop-divider)",
  borderRadius: "0",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-medium)",
  color: "#6b6b6b",
  marginBottom: "0.375rem",
};

export default function TicketFilterBar({
  activeStatus,
  activePriority,
  activeCategory,
  activeLink,
  activeAssignee,
  activeSource,
  activeSort,
  query,
  from,
  to,
  assignableStaff,
  counts,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function pushParams(next: {
    status?: string;
    priority?: string;
    category?: string;
    link?: string;
    assignee?: string;
    source?: string;
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
  }) {
    const params = new URLSearchParams();

    const status = next.status !== undefined ? next.status : (activeStatus as string);
    if (status !== "ACTIVE") params.set("status", status);

    const priority =
      next.priority !== undefined ? next.priority : (activePriority as string);
    if (priority !== "ALL") params.set("priority", priority);

    const category =
      next.category !== undefined ? next.category : (activeCategory as string);
    if (category !== "ALL") params.set("category", category);

    const link = next.link !== undefined ? next.link : (activeLink as string);
    if (link !== "ALL") params.set("link", link);

    const assignee = next.assignee !== undefined ? next.assignee : activeAssignee;
    if (assignee !== "ALL") params.set("assignee", assignee);

    const source = next.source !== undefined ? next.source : (activeSource as string);
    if (source !== "ALL") params.set("source", source);

    const q = next.q !== undefined ? next.q : searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const sort = next.sort !== undefined ? next.sort : activeSort;
    if (sort !== "priority") params.set("sort", sort);

    const qs = params.toString();
    const href = `/admin/tickets${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function handlePreset(f: string, t: string) {
    setFromValue(f);
    setToValue(t);
    pushParams({ from: f, to: t });
  }

  function handleClear() {
    setSearchValue("");
    setFromValue("");
    setToValue("");
    startNavigationProgress("/admin/tickets");
    router.push("/admin/tickets");
  }

  function navigateChip(preset: TicketQuickViewParams) {
    const params = new URLSearchParams();
    if (preset.sort) params.set("sort", preset.sort);
    if (preset.assignee) params.set("assignee", preset.assignee);
    if (preset.priority) params.set("priority", preset.priority);
    if (preset.status) params.set("status", preset.status);
    if (preset.source) params.set("source", preset.source);
    setSearchValue("");
    setFromValue("");
    setToValue("");
    const qs = params.toString();
    const href = `/admin/tickets${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function isChipActive(preset: TicketQuickViewParams): boolean {
    const wantSort = preset.sort ?? "priority";
    const wantAssignee = preset.assignee ?? "ALL";
    const wantPriority = preset.priority ?? "ALL";
    const wantStatus = preset.status ?? "ACTIVE";
    const wantSource = preset.source ?? "ALL";

    return (
      activeSort === wantSort &&
      activeAssignee === wantAssignee &&
      activePriority === wantPriority &&
      activeStatus === wantStatus &&
      activeSource === wantSource &&
      activeCategory === "ALL" &&
      activeLink === "ALL" &&
      !fromValue &&
      !toValue &&
      searchValue.trim() === ""
    );
  }

  const hasActiveFilters =
    activeStatus !== "ACTIVE" ||
    activePriority !== "ALL" ||
    activeCategory !== "ALL" ||
    activeLink !== "ALL" ||
    activeAssignee !== "ALL" ||
    activeSource !== "ALL" ||
    activeSort !== "priority" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue;

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
    cursor: "pointer",
  };

  const secondaryBtn: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "#0b0b0b",
    color: "#ffffff",
  };

  const chipCounts: Record<string, number | undefined> = {
    active: counts.active,
    latest: undefined,
    unassigned: counts.unassigned,
    mine: counts.mine,
    urgent: counts.urgent,
    waiting: counts.waiting,
    customer: counts.customer,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {TICKET_QUICK_VIEWS.map((view) => {
          const active = isChipActive(view.params);
          const count = chipCounts[view.key];
          const isUrgent = view.key === "urgent";
          return (
            <button
              key={view.key}
              type="button"
              onClick={() => navigateChip(view.params)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                height: "2.25rem",
                paddingInline: "0.875rem",
                fontSize: "var(--text-body-sm)",
                fontWeight: "var(--font-medium)",
                border: `1px solid ${active ? "#0b0b0b" : "#d0cbc4"}`,
                borderRadius: "0",
                backgroundColor: active ? "#0b0b0b" : "#ffffff",
                color: active ? "#ffffff" : isUrgent ? "#991b1b" : "#0b0b0b",
                cursor: "pointer",
              }}
            >
              {view.label}
              {count !== undefined && (
                <span style={{ opacity: active ? 0.85 : 0.6 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "1rem 1.25rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
        }}
      >
        <div style={{ minWidth: "200px" }}>
          <Select
            label="Status"
            id="ticket-filter-status"
            value={activeStatus}
            onChange={(e) => pushParams({ status: e.target.value })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "ACTIVE"
                  ? "Active (excl. closed)"
                  : s === "ALL"
                    ? "All statuses"
                    : TICKET_STATUS_LABELS[s as TicketStatus]}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ minWidth: "160px" }}>
          <Select
            label="Priority"
            id="ticket-filter-priority"
            value={activePriority}
            onChange={(e) => pushParams({ priority: e.target.value })}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === "ALL" ? "All priorities" : TICKET_PRIORITY_LABELS[p as TicketPriority]}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ minWidth: "160px" }}>
          <Select
            label="Category"
            id="ticket-filter-category"
            value={activeCategory}
            onChange={(e) => pushParams({ category: e.target.value })}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "All categories" : TICKET_CATEGORY_LABELS[c as TicketCategory]}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ minWidth: "160px" }}>
          <Select
            label="Linked to"
            id="ticket-filter-link"
            value={activeLink}
            onChange={(e) => pushParams({ link: e.target.value })}
          >
            {LINK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ minWidth: "180px" }}>
          <Select
            label="Assignee"
            id="ticket-filter-assignee"
            value={activeAssignee}
            onChange={(e) => pushParams({ assignee: e.target.value })}
          >
            <option value="ALL">Anyone</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Me</option>
            {assignableStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ minWidth: "140px" }}>
          <Select
            label="Source"
            id="ticket-filter-source"
            value={activeSource}
            onChange={(e) => pushParams({ source: e.target.value })}
          >
            <option value="ALL">Any</option>
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
          </Select>
        </div>

        <div style={{ flex: 1, minWidth: "240px" }}>
          <label htmlFor="ticket-filter-search" style={labelStyle}>
            Search
          </label>
          <input
            id="ticket-filter-search"
            type="text"
            dir="ltr"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushParams({ q: searchValue.trim() });
            }}
            placeholder="Search ticket #, subject, email, order/quote #, company…"
            style={inputStyle}
          />
        </div>

        <div style={{ minWidth: "160px" }}>
          <label htmlFor="ticket-filter-from" style={labelStyle}>
            Opened from
          </label>
          <input
            id="ticket-filter-from"
            type="date"
            dir="ltr"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ minWidth: "160px" }}>
          <label htmlFor="ticket-filter-to" style={labelStyle}>
            Opened to
          </label>
          <input
            id="ticket-filter-to"
            type="date"
            dir="ltr"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ minWidth: "160px" }}>
          <Select
            label="Sort"
            id="ticket-filter-sort"
            value={activeSort}
            onChange={(e) => pushParams({ sort: e.target.value })}
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="updated">Updated</option>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => pushParams({ q: searchValue.trim() })}
          style={{ ...btnBase, backgroundColor: "#0b0b0b", color: "#ffffff" }}
        >
          Search
        </button>

        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(1);
            handlePreset(d.from, d.to);
          }}
          style={secondaryBtn}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(7);
            handlePreset(d.from, d.to);
          }}
          style={secondaryBtn}
        >
          7d
        </button>

        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(30);
            handlePreset(d.from, d.to);
          }}
          style={secondaryBtn}
        >
          30d
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "2.5rem",
              padding: 0,
              background: "none",
              border: "none",
              color: "#0b0b0b",
              fontSize: "var(--text-body-sm)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
