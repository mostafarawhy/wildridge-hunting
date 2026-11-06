"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import BottomSheet from "@/components/ui/BottomSheet";
import { ORDER_STATUS_LABELS } from "@/lib/utils/order-status";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { AdminOrderFilters, OrderStatus } from "@/lib/db/queries/order";

interface Props {
  filters: AdminOrderFilters;
}

const STATUS_OPTIONS = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

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

export default function OrderFilterBar({ filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [fromValue, setFromValue] = useState(filters.from ?? "");
  const [toValue, setToValue] = useState(filters.to ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({
    status: "ALL",
    payment: "ALL",
    source: "ALL",
    refund: "ALL",
    sort: "newest",
    from: "",
    to: "",
  });

  const activeStatus = filters.status ?? "ALL";
  const activePayment = filters.payment ?? "ALL";
  const activeSource = filters.source ?? "ALL";
  const activeRefund = filters.refund ?? "ALL";
  const activeSort = filters.sort ?? "newest";

  function pushParams(next: {
    status?: string;
    payment?: string;
    source?: string;
    refund?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    if (filters.view) params.set("view", filters.view);
    if (filters.stale) params.set("stale", "1");

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const p = next.payment ?? activePayment;
    if (p !== "ALL") params.set("payment", p);

    const so = next.source ?? activeSource;
    if (so !== "ALL") params.set("source", so);

    const r = next.refund ?? activeRefund;
    if (r !== "ALL") params.set("refund", r);

    const sort = next.sort ?? activeSort;
    if (sort !== "newest") params.set("sort", sort);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/orders${qs ? `?${qs}` : ""}`;
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
        ? `/admin/orders?sort=${activeSort}`
        : "/admin/orders";
    startNavigationProgress(href);
    router.push(href);
  }

  const hasActiveFilters =
    filters.view !== undefined ||
    filters.stale === true ||
    activeStatus !== "ALL" ||
    activePayment !== "ALL" ||
    activeSource !== "ALL" ||
    activeRefund !== "ALL" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue;

  const sheetFilterCount =
    (activeStatus !== "ALL" ? 1 : 0) +
    (activePayment !== "ALL" ? 1 : 0) +
    (activeSource !== "ALL" ? 1 : 0) +
    (activeRefund !== "ALL" ? 1 : 0) +
    (fromValue ? 1 : 0) +
    (toValue ? 1 : 0);

  function openSheet() {
    setDraft({
      status: activeStatus,
      payment: activePayment,
      source: activeSource,
      refund: activeRefund,
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
      payment: draft.payment,
      source: draft.source,
      refund: draft.refund,
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
    <div
      className="flex lg:hidden"
      style={{
        gap: "0.5rem",
        padding: "0.75rem",
        marginBottom: "1rem",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <input
        id="order-filter-search-m"
        type="text"
        dir="ltr"
        aria-label="Search orders"
        enterKeyHint="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") pushParams({ q: searchValue.trim() });
        }}
        placeholder="Order #, customer, email…"
        style={{ ...inputStyle, flex: 1, minWidth: 0, minHeight: "44px" }}
      />
      <button
        type="button"
        onClick={openSheet}
        style={{
          ...btnBase,
          height: "44px",
          gap: "0.5rem",
          flexShrink: 0,
          backgroundColor: "#0b0b0b",
          color: "#ffffff",
        }}
      >
        Filters
        {sheetFilterCount > 0 && (
          <span
            style={{
              minWidth: "1.25rem",
              padding: "0 0.375rem",
              lineHeight: "1.25rem",
              backgroundColor: "#ffffff",
              color: "#0b0b0b",
              fontSize: "var(--text-body-sm)",
            }}
          >
            {sheetFilterCount}
          </span>
        )}
      </button>
    </div>

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
          id="order-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Payment"
          id="order-filter-payment"
          value={activePayment}
          onChange={(e) => pushParams({ payment: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="ONLINE">Card</option>
          <option value="OFFLINE">Offline</option>
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Source"
          id="order-filter-source"
          value={activeSource}
          onChange={(e) => pushParams({ source: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="CHECKOUT">Checkout</option>
          <option value="QUOTE">From a quote</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Refund"
          id="order-filter-refund"
          value={activeRefund}
          onChange={(e) => pushParams({ refund: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="OWED">Owed</option>
          <option value="PARTIAL">Partly refunded</option>
          <option value="REFUNDED">Refunded</option>
          <option value="NONE">No refund</option>
        </Select>
      </div>

      <div style={{ minWidth: "180px" }}>
        <Select
          label="Sort"
          id="order-filter-sort"
          value={activeSort}
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Total, high to low</option>
          <option value="total_asc">Total, low to high</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="order-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="order-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Order #, customer, email or serial…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="order-filter-from" style={labelStyle}>
          Placed from
        </label>
        <input
          id="order-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="order-filter-to" style={labelStyle}>
          Placed to
        </label>
        <input
          id="order-filter-to"
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

    <BottomSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      ariaLabel="Order filters"
      title="Filters"
      closeLabel="Close"
      footer={
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              handleClear();
            }}
            style={{
              ...btnBase,
              height: "44px",
              backgroundColor: "transparent",
              color: "#0b0b0b",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={applySheet}
            style={{
              ...btnBase,
              height: "44px",
              flex: 1,
              backgroundColor: "#0b0b0b",
              color: "#ffffff",
            }}
          >
            Apply
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "0.5rem 1rem 1rem",
        }}
      >
        <Select
          label="Status"
          id="order-sheet-status"
          value={draft.status}
          style={{ minHeight: "44px" }}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
        >
          <option value="ALL">All</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Payment"
          id="order-sheet-payment"
          value={draft.payment}
          style={{ minHeight: "44px" }}
          onChange={(e) => setDraft((d) => ({ ...d, payment: e.target.value }))}
        >
          <option value="ALL">All</option>
          <option value="ONLINE">Card</option>
          <option value="OFFLINE">Offline</option>
        </Select>
        <Select
          label="Source"
          id="order-sheet-source"
          value={draft.source}
          style={{ minHeight: "44px" }}
          onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
        >
          <option value="ALL">All</option>
          <option value="CHECKOUT">Checkout</option>
          <option value="QUOTE">From a quote</option>
        </Select>
        <Select
          label="Refund"
          id="order-sheet-refund"
          value={draft.refund}
          style={{ minHeight: "44px" }}
          onChange={(e) => setDraft((d) => ({ ...d, refund: e.target.value }))}
        >
          <option value="ALL">All</option>
          <option value="OWED">Owed</option>
          <option value="PARTIAL">Partly refunded</option>
          <option value="REFUNDED">Refunded</option>
          <option value="NONE">No refund</option>
        </Select>
        <Select
          label="Sort"
          id="order-sheet-sort"
          value={draft.sort}
          style={{ minHeight: "44px" }}
          onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value }))}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Total, high to low</option>
          <option value="total_asc">Total, low to high</option>
        </Select>
        <div>
          <label htmlFor="order-sheet-from" style={labelStyle}>
            Placed from
          </label>
          <input
            id="order-sheet-from"
            type="date"
            dir="ltr"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            style={{ ...inputStyle, minHeight: "44px" }}
          />
        </div>
        <div>
          <label htmlFor="order-sheet-to" style={labelStyle}>
            Placed to
          </label>
          <input
            id="order-sheet-to"
            type="date"
            dir="ltr"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            style={{ ...inputStyle, minHeight: "44px" }}
          />
        </div>
      </div>
    </BottomSheet>
    </>
  );
}
