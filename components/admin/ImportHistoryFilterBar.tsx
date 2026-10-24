"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import { dubaiRecentDays } from "@/lib/utils/date";

interface Props {
  staff: string;
  status: string;
  from: string;
  to: string;
  staffOptions: { id: string; name: string }[];
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

const presetBtn: React.CSSProperties = {
  ...btnBase,
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  opacity: 1,
};

const secondaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  paddingInline: 0,
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-semibold)",
  border: "none",
  borderRadius: "0",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  color: "#0b0b0b",
  backgroundColor: "transparent",
  cursor: "pointer",
};

export default function ImportHistoryFilterBar({
  staff,
  status,
  from,
  to,
  staffOptions,
}: Props) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function pushParams(next: {
    staff?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.staff ?? staff;
    if (s !== "ALL") params.set("staff", s);

    const st = next.status ?? status;
    if (st !== "ALL") params.set("status", st);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/import${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  function handlePreset(f: string, t: string) {
    setFromValue(f);
    setToValue(t);
    pushParams({ from: f, to: t });
  }

  function handleClear() {
    setFromValue("");
    setToValue("");
    startNavigationProgress("/admin/import");
    router.push("/admin/import");
  }

  const hasActiveFilters =
    staff !== "ALL" || status !== "ALL" || !!fromValue || !!toValue;

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
          label="Uploaded by"
          id="import-filter-staff"
          value={staff}
          onChange={(e) => pushParams({ staff: e.target.value })}
        >
          <option value="ALL">All staff</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Status"
          id="import-filter-status"
          value={status}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="COMPLETED">Imported</option>
          <option value="FAILED">Not imported</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="import-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="import-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="import-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="import-filter-to"
          type="date"
          dir="ltr"
          value={toValue}
          onChange={(e) => setToValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button
        type="button"
        onClick={() => pushParams({ from: fromValue, to: toValue })}
        style={{ ...btnBase, backgroundColor: "#0b0b0b", color: "#ffffff" }}
      >
        Apply
      </button>

      <div style={{ display: "inline-flex", flexWrap: "nowrap", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(1);
            handlePreset(d.from, d.to);
          }}
          style={presetBtn}
        >
          Today
        </button>

        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(7);
            handlePreset(d.from, d.to);
          }}
          style={presetBtn}
        >
          7d
        </button>

        <button
          type="button"
          onClick={() => {
            const d = dubaiRecentDays(30);
            handlePreset(d.from, d.to);
          }}
          style={presetBtn}
        >
          30d
        </button>
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={handleClear} style={secondaryBtn}>
          Clear
        </button>
      )}
    </div>
  );
}
