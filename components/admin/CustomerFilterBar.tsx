"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { AdminCustomerFilters } from "@/lib/db/queries/customer";

interface Props {
  filters: AdminCustomerFilters;
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

export default function CustomerFilterBar({ filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [fromValue, setFromValue] = useState(filters.from ?? "");
  const [toValue, setToValue] = useState(filters.to ?? "");

  const activeStatus = filters.status ?? "ALL";
  const activeRole = filters.role ?? "ALL";
  const activeVerification = filters.verification ?? "ALL";
  const activeB2b = filters.b2b ?? "ALL";
  const activeOrders = filters.orders ?? "ALL";
  const activePoints = filters.points ?? "ALL";
  const activeSort = filters.sort ?? "newest";

  function pushParams(next: {
    status?: string;
    role?: string;
    verification?: string;
    b2b?: string;
    orders?: string;
    points?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const r = next.role ?? activeRole;
    if (r !== "ALL") params.set("role", r);

    const v = next.verification ?? activeVerification;
    if (v !== "ALL") params.set("verification", v);

    const b = next.b2b ?? activeB2b;
    if (b !== "ALL") params.set("b2b", b);

    const o = next.orders ?? activeOrders;
    if (o !== "ALL") params.set("orders", o);

    const p = next.points ?? activePoints;
    if (p !== "ALL") params.set("points", p);

    const so = next.sort ?? activeSort;
    if (so !== "newest") params.set("sort", so);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/customers${qs ? `?${qs}` : ""}`;
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
    const href =
      activeSort !== "newest"
        ? `/admin/customers?sort=${activeSort}`
        : "/admin/customers";
    startNavigationProgress(href);
    router.push(href);
  }

  const hasActiveFilters =
    activeStatus !== "ALL" ||
    activeRole !== "ALL" ||
    activeVerification !== "ALL" ||
    activeB2b !== "ALL" ||
    activeOrders !== "ALL" ||
    activePoints !== "ALL" ||
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

  return (
    <div
      style={{
        display: "flex",
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
          label="Status"
          id="customer-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Type"
          id="customer-filter-role"
          value={activeRole}
          onChange={(e) => pushParams({ role: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="B2C">B2C</option>
          <option value="B2B">B2B</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="ID verification"
          id="customer-filter-verification"
          value={activeVerification}
          onChange={(e) => pushParams({ verification: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="NOT_REQUIRED">Not required</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Business account"
          id="customer-filter-b2b"
          value={activeB2b}
          onChange={(e) => pushParams({ b2b: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="NONE">No account</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="EXPIRED">Expired</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Orders"
          id="customer-filter-orders"
          value={activeOrders}
          onChange={(e) => pushParams({ orders: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="HAS">Has orders</option>
          <option value="NONE">No orders</option>
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Points"
          id="customer-filter-points"
          value={activePoints}
          onChange={(e) => pushParams({ points: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="HAS">Has points</option>
          <option value="NONE">No points</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Sort"
          id="customer-filter-sort"
          value={activeSort}
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="customer-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="customer-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Name, email or phone…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="customer-filter-from" style={labelStyle}>
          Joined from
        </label>
        <input
          id="customer-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="customer-filter-to" style={labelStyle}>
          Joined to
        </label>
        <input
          id="customer-filter-to"
          type="date"
          dir="ltr"
          value={toValue}
          onChange={(e) => setToValue(e.target.value)}
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
          Clear
        </button>
      )}
    </div>
  );
}
