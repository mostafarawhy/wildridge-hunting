"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import AdminFilterSheet from "@/components/admin/AdminFilterSheet";
import { STAFF_ROLE_LABELS } from "@/lib/utils/staff-permissions";
import type { StaffRole } from "@/app/generated/prisma/client";

interface Props {
  activeRole: "ALL" | StaffRole;
  activeStatus: "ALL" | "ACTIVE" | "INACTIVE";
  query: string;
}

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

export default function StaffFilterBar({
  activeRole,
  activeStatus,
  query,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({
    role: "ALL",
    status: "ALL",
  });

  function pushParams(next: { status?: string; role?: string; q?: string }) {
    const params = new URLSearchParams();

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const r = next.role ?? activeRole;
    if (r !== "ALL") params.set("role", r);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const qs = params.toString();
    const href = `/admin/staff${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function handleClear() {
    setSearchValue("");
    startNavigationProgress("/admin/staff");
    router.push("/admin/staff");
  }

  const hasActiveFilters =
    activeStatus !== "ALL" ||
    activeRole !== "ALL" ||
    searchValue.trim() !== "";

  const sheetFilterCount =
    (activeRole !== "ALL" ? 1 : 0) + (activeStatus !== "ALL" ? 1 : 0);

  function openSheet() {
    setDraft({ role: activeRole, status: activeStatus });
    setSheetOpen(true);
  }

  function applySheet() {
    setSheetOpen(false);
    pushParams({
      role: draft.role,
      status: draft.status,
      q: searchValue.trim(),
    });
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
    cursor: "pointer",
  };

  return (
    <>
    <AdminFilterSheet
      search={{
        id: "staff-filter-search-m",
        label: "Search staff",
        placeholder: "Search by name or email…",
        value: searchValue,
        onChange: setSearchValue,
        onSubmit: () => pushParams({ q: searchValue.trim() }),
      }}
      activeCount={sheetFilterCount}
      open={sheetOpen}
      onOpen={openSheet}
      onClose={() => setSheetOpen(false)}
      onApply={applySheet}
      onClear={handleClear}
      sheetLabel="Staff filters"
    >
      <Select
        label="Role"
        id="staff-sheet-role"
        value={draft.role}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
      >
        <option value="ALL">All Roles</option>
        {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((role) => (
          <option key={role} value={role}>
            {STAFF_ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <Select
        label="Status"
        id="staff-sheet-status"
        value={draft.status}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
      >
        <option value="ALL">All</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Deactivated</option>
      </Select>
    </AdminFilterSheet>

    <div
      className="hidden lg:flex"
      style={{
        alignItems: "flex-end",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <div style={{ minWidth: "160px" }}>
        <Select
          label="Role"
          id="staff-filter-role"
          value={activeRole}
          onChange={(e) => pushParams({ role: e.target.value })}
        >
          <option value="ALL">All Roles</option>
          {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((role) => (
            <option key={role} value={role}>
              {STAFF_ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Status"
          id="staff-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Deactivated</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="staff-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="staff-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Search by name or email…"
          style={inputStyle}
        />
      </div>

      <button
        type="button"
        onClick={() => pushParams({ q: searchValue.trim() })}
        style={{ ...btnBase, backgroundColor: "#0b0b0b", color: "#ffffff" }}
      >
        Search
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
          Clear
        </button>
      )}
    </div>
    </>
  );
}
