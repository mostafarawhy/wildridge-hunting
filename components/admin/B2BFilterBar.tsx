"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import AdminFilterSheet from "@/components/admin/AdminFilterSheet";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { AdminB2BFilters } from "@/lib/db/queries/b2b";

interface Props {
  filters: AdminB2BFilters;
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

export default function B2BFilterBar({ filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [fromValue, setFromValue] = useState(filters.from ?? "");
  const [toValue, setToValue] = useState(filters.to ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({
    status: "ALL",
    review: "ALL",
    renewal: "ALL",
    quotes: "ALL",
    sort: "newest",
    from: "",
    to: "",
  });

  const activeStatus = filters.status ?? "ALL";
  const activeReview = filters.review ?? "ALL";
  const activeRenewal = filters.renewal ?? "ALL";
  const activeQuotes = filters.quotes ?? "ALL";
  const activeSort = filters.sort ?? "newest";

  function pushParams(next: {
    status?: string;
    review?: string;
    renewal?: string;
    quotes?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const r = next.review ?? activeReview;
    if (r !== "ALL") params.set("review", r);

    const rn = next.renewal ?? activeRenewal;
    if (rn !== "ALL") params.set("renewal", rn);

    const qt = next.quotes ?? activeQuotes;
    if (qt !== "ALL") params.set("quotes", qt);

    const so = next.sort ?? activeSort;
    if (so !== "newest") params.set("sort", so);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/b2b${qs ? `?${qs}` : ""}`;
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
        ? `/admin/b2b?sort=${activeSort}`
        : "/admin/b2b";
    startNavigationProgress(href);
    router.push(href);
  }

  const hasActiveFilters =
    activeStatus !== "ALL" ||
    activeReview !== "ALL" ||
    activeRenewal !== "ALL" ||
    activeQuotes !== "ALL" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue;

  const sheetFilterCount =
    (activeStatus !== "ALL" ? 1 : 0) +
    (activeReview !== "ALL" ? 1 : 0) +
    (activeRenewal !== "ALL" ? 1 : 0) +
    (activeQuotes !== "ALL" ? 1 : 0) +
    (fromValue ? 1 : 0) +
    (toValue ? 1 : 0);

  function openSheet() {
    setDraft({
      status: activeStatus,
      review: activeReview,
      renewal: activeRenewal,
      quotes: activeQuotes,
      sort: activeSort,
      from: fromValue,
      to: toValue,
    });
    setSheetOpen(true);
  }

  function applySheet() {
    setFromValue(draft.from);
    setToValue(draft.to);
    setSheetOpen(false);
    pushParams({
      status: draft.status,
      review: draft.review,
      renewal: draft.renewal,
      quotes: draft.quotes,
      sort: draft.sort,
      from: draft.from,
      to: draft.to,
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

  const secondaryBtn: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "#0b0b0b",
    color: "#ffffff",
  };

  return (
    <>
    <AdminFilterSheet
      search={{
        id: "b2b-filter-search-m",
        label: "Search business accounts",
        placeholder: "Company, licence, VAT, contact, email or phone…",
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
      sheetLabel="Business account filters"
    >
      <Select
        label="Status"
        id="b2b-sheet-status"
        value={draft.status}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
      >
        <option value="ALL">All</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Active</option>
        <option value="EXPIRED">Expired</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="REJECTED">Rejected</option>
      </Select>
      <Select
        label="Review"
        id="b2b-sheet-review"
        value={draft.review}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, review: e.target.value }))}
      >
        <option value="ALL">All</option>
        <option value="DECISION">Needs a decision</option>
        <option value="WAITING">Waiting on customer</option>
        <option value="RESPONDED">Customer responded</option>
      </Select>
      <Select
        label="Renewal due"
        id="b2b-sheet-renewal"
        value={draft.renewal}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, renewal: e.target.value }))}
      >
        <option value="ALL">Any time</option>
        <option value="D30">Within 30 days</option>
        <option value="D90">Within 90 days</option>
      </Select>
      <Select
        label="Quotes"
        id="b2b-sheet-quotes"
        value={draft.quotes}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, quotes: e.target.value }))}
      >
        <option value="ALL">All</option>
        <option value="HAS">Has quotes</option>
        <option value="NONE">No quotes</option>
      </Select>
      <Select
        label="Sort"
        id="b2b-sheet-sort"
        value={draft.sort}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
      >
        <option value="newest">Newest applied</option>
        <option value="oldest">Oldest applied</option>
        <option value="expiry">Expiry soonest</option>
        <option value="company">Company A–Z</option>
      </Select>
      <div>
        <label htmlFor="b2b-sheet-from" style={labelStyle}>
          Applied from
        </label>
        <input
          id="b2b-sheet-from"
          type="date"
          dir="ltr"
          value={draft.from}
          onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          style={{ ...inputStyle, minHeight: "44px" }}
        />
      </div>
      <div>
        <label htmlFor="b2b-sheet-to" style={labelStyle}>
          Applied to
        </label>
        <input
          id="b2b-sheet-to"
          type="date"
          dir="ltr"
          value={draft.to}
          onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
          style={{ ...inputStyle, minHeight: "44px" }}
        />
      </div>
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
          label="Status"
          id="b2b-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Rejected</option>
        </Select>
      </div>

      <div style={{ minWidth: "200px" }}>
        <Select
          label="Review"
          id="b2b-filter-review"
          value={activeReview}
          onChange={(e) => pushParams({ review: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="DECISION">Needs a decision</option>
          <option value="WAITING">Waiting on customer</option>
          <option value="RESPONDED">Customer responded</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Renewal due"
          id="b2b-filter-renewal"
          value={activeRenewal}
          onChange={(e) => pushParams({ renewal: e.target.value })}
        >
          <option value="ALL">Any time</option>
          <option value="D30">Within 30 days</option>
          <option value="D90">Within 90 days</option>
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Quotes"
          id="b2b-filter-quotes"
          value={activeQuotes}
          onChange={(e) => pushParams({ quotes: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="HAS">Has quotes</option>
          <option value="NONE">No quotes</option>
        </Select>
      </div>

      <div style={{ minWidth: "180px" }}>
        <Select
          label="Sort"
          id="b2b-filter-sort"
          value={activeSort}
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="newest">Newest applied</option>
          <option value="oldest">Oldest applied</option>
          <option value="expiry">Expiry soonest</option>
          <option value="company">Company A–Z</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="b2b-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="b2b-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Company, licence, VAT, contact, email or phone…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="b2b-filter-from" style={labelStyle}>
          Applied from
        </label>
        <input
          id="b2b-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="b2b-filter-to" style={labelStyle}>
          Applied to
        </label>
        <input
          id="b2b-filter-to"
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
    </>
  );
}
