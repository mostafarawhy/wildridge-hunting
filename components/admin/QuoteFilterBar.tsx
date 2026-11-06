"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import AdminFilterSheet from "@/components/admin/AdminFilterSheet";
import { QUOTE_STATUS_LABELS } from "@/lib/utils/quote-status";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { AdminQuoteFilters, QuoteStatus } from "@/lib/db/queries/quote";

interface Props {
  filters: AdminQuoteFilters;
}

const STATUS_OPTIONS = Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[];

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

export default function QuoteFilterBar({ filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [fromValue, setFromValue] = useState(filters.from ?? "");
  const [toValue, setToValue] = useState(filters.to ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({
    status: "ALL",
    priced: "ALL",
    sort: "newest",
    from: "",
    to: "",
  });

  const activeStatus = filters.status ?? "ALL";
  const activePriced = filters.priced ?? "ALL";
  const activeSort = filters.sort ?? "newest";

  function pushParams(next: {
    status?: string;
    priced?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    if (filters.view) params.set("view", filters.view);

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const p = next.priced ?? activePriced;
    if (p !== "ALL") params.set("priced", p);

    const sort = next.sort ?? activeSort;
    if (sort !== "newest") params.set("sort", sort);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/quotes${qs ? `?${qs}` : ""}`;
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
        ? `/admin/quotes?sort=${activeSort}`
        : "/admin/quotes";
    startNavigationProgress(href);
    router.push(href);
  }

  const hasActiveFilters =
    filters.view !== undefined ||
    activeStatus !== "ALL" ||
    activePriced !== "ALL" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue;

  const sheetFilterCount =
    (activeStatus !== "ALL" ? 1 : 0) +
    (activePriced !== "ALL" ? 1 : 0) +
    (fromValue ? 1 : 0) +
    (toValue ? 1 : 0);

  function openSheet() {
    setDraft({
      status: activeStatus,
      priced: activePriced,
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
      priced: draft.priced,
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
        id: "quote-filter-search-m",
        label: "Search quotes",
        placeholder: "Search by quote #, company, customer or email…",
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
      sheetLabel="Quote filters"
    >
      <Select
        label="Status"
        id="quote-sheet-status"
        value={draft.status}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
      >
        <option value="ALL">Any status</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {QUOTE_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <Select
        label="Priced"
        id="quote-sheet-priced"
        value={draft.priced}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, priced: e.target.value }))}
      >
        <option value="ALL">Any</option>
        <option value="YES">Priced</option>
        <option value="NO">Not priced</option>
      </Select>
      <Select
        label="Sort"
        id="quote-sheet-sort"
        value={draft.sort}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="total_desc">Quoted total, high to low</option>
        <option value="total_asc">Quoted total, low to high</option>
      </Select>
      <div>
        <label htmlFor="quote-sheet-from" style={labelStyle}>
          From
        </label>
        <input
          id="quote-sheet-from"
          type="date"
          dir="ltr"
          value={draft.from}
          onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          style={{ ...inputStyle, minHeight: "44px" }}
        />
      </div>
      <div>
        <label htmlFor="quote-sheet-to" style={labelStyle}>
          To
        </label>
        <input
          id="quote-sheet-to"
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
      <div style={{ minWidth: "200px" }}>
        <Select
          label="Status"
          id="quote-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Priced"
          id="quote-filter-priced"
          value={activePriced}
          onChange={(e) => pushParams({ priced: e.target.value })}
        >
          <option value="ALL">Any</option>
          <option value="YES">Priced</option>
          <option value="NO">Not priced</option>
        </Select>
      </div>

      <div style={{ minWidth: "180px" }}>
        <Select
          label="Sort"
          id="quote-filter-sort"
          value={activeSort}
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Quoted total, high to low</option>
          <option value="total_asc">Quoted total, low to high</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="quote-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="quote-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Search by quote #, company, customer or email…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="quote-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="quote-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="quote-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="quote-filter-to"
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
