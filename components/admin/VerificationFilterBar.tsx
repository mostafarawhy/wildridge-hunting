"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import { isUaePassEnabled } from "@/lib/env.client";

interface Props {
  status: string;
  provider: string;
  search: string;
  from: string;
  to: string;
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

export default function VerificationFilterBar({
  status,
  provider,
  search,
  from,
  to,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function pushParams(next: {
    status?: string;
    provider?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.status ?? status;
    params.set("status", s);

    const p = next.provider ?? provider;
    if (p !== "ALL") params.set("provider", p);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/verification${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function handleClear() {
    setSearchValue("");
    setFromValue("");
    setToValue("");
    startNavigationProgress("/admin/verification");
    router.push("/admin/verification");
  }

  const hasActiveFilters =
    status !== "PENDING" ||
    provider !== "ALL" ||
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
          id="verification-filter-status"
          value={status}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
          <option value="NOT_REQUIRED">Not Required</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Provider"
          id="verification-filter-provider"
          value={provider}
          onChange={(e) => pushParams({ provider: e.target.value })}
        >
          <option value="ALL">All Providers</option>
          <option value="MANUAL_REVIEW">Manual Review</option>
          {isUaePassEnabled() && <option value="UAE_PASS">UAE PASS</option>}
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="verification-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="verification-filter-search"
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

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="verification-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="verification-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="verification-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="verification-filter-to"
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
