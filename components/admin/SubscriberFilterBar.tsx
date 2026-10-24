"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { SubscriberFilters } from "@/lib/validations/newsletter";

interface Props {
  filters: SubscriberFilters;
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

export default function SubscriberFilterBar({ filters }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const [fromValue, setFromValue] = useState(filters.from ?? "");
  const [toValue, setToValue] = useState(filters.to ?? "");

  const activeStatus = filters.status ?? "ALL";
  const activeKlaviyo = filters.klaviyo ?? "ALL";
  const activeSource = filters.source ?? "ALL";
  const activeLocale = filters.locale ?? "ALL";
  const activeSort = filters.sort ?? "newest";

  function pushParams(next: {
    status?: string;
    klaviyo?: string;
    source?: string;
    lang?: string;
    sort?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.status ?? activeStatus;
    if (s !== "ALL") params.set("status", s);

    const k = next.klaviyo ?? activeKlaviyo;
    if (k !== "ALL") params.set("klaviyo", k);

    const src = next.source ?? activeSource;
    if (src !== "ALL") params.set("source", src);

    const l = next.lang ?? activeLocale;
    if (l !== "ALL") params.set("lang", l);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const so = next.sort ?? activeSort;
    if (so !== "newest") params.set("sort", so);

    const qs = params.toString();
    const href = `/admin/subscribers${qs ? `?${qs}` : ""}`;
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
        ? `/admin/subscribers?sort=${activeSort}`
        : "/admin/subscribers";
    startNavigationProgress(href);
    router.push(href);
  }

  const hasActiveFilters =
    activeStatus !== "ALL" ||
    activeKlaviyo !== "ALL" ||
    activeSource !== "ALL" ||
    activeLocale !== "ALL" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue;

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
      <div style={{ minWidth: "180px" }}>
        <Select
          label="Status"
          id="subscriber-filter-status"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="SUBSCRIBED">Subscribed</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Source"
          id="subscriber-filter-source"
          value={activeSource}
          onChange={(e) => pushParams({ source: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="HOME">Homepage</option>
          <option value="POPUP">Popup</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Language"
          id="subscriber-filter-language"
          value={activeLocale}
          onChange={(e) => pushParams({ lang: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="ru">Russian</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Klaviyo"
          id="subscriber-filter-klaviyo"
          value={activeKlaviyo}
          onChange={(e) => pushParams({ klaviyo: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="SENT">Sent</option>
          <option value="WAITING">Waiting</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      <div style={{ minWidth: "180px" }}>
        <Select
          label="Sort"
          id="subscriber-filter-sort"
          value={activeSort}
          onChange={(e) => pushParams({ sort: e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="email">Email A–Z</option>
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="subscriber-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="subscriber-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Search by email…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="subscriber-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="subscriber-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="subscriber-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="subscriber-filter-to"
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
