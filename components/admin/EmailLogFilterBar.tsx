"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import AdminFilterSheet from "@/components/admin/AdminFilterSheet";
import { EMAIL_DEFAULTS } from "@/lib/email/defaults";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { EmailLogFacets } from "@/lib/db/queries/email-log";

interface Props {
  status: string;
  templateKey: string;
  query: string;
  from: string;
  to: string;
  allTime: boolean;
  isDefaultRange: boolean;
  facets: EmailLogFacets;
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

export default function EmailLogFilterBar({
  status,
  templateKey,
  query,
  from,
  to,
  allTime,
  isDefaultRange,
  facets,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);
  const defaultRange = dubaiRecentDays(30);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState({
    status: "ALL",
    templateKey: "ALL",
    from: defaultRange.from,
    to: defaultRange.to,
  });

  function pushParams(next: {
    status?: string;
    templateKey?: string;
    q?: string;
    from?: string;
    to?: string;
    range?: string;
  }) {
    const params = new URLSearchParams();

    const s = next.status ?? status;
    if (s !== "ALL") params.set("status", s);

    const tk = next.templateKey ?? templateKey;
    if (tk !== "ALL") params.set("templateKey", tk);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    if (!f && !t && (next.range ?? (allTime ? "all" : undefined)) === "all") params.set("range", "all");

    const qs = params.toString();
    const href = `/admin/email-log${qs ? `?${qs}` : ""}`;
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
    const d = dubaiRecentDays(30);
    setFromValue(d.from);
    setToValue(d.to);
    startNavigationProgress("/admin/email-log");
    router.push("/admin/email-log");
  }

  const hasActiveFilters =
    status !== "ALL" ||
    templateKey !== "ALL" ||
    searchValue.trim() !== "" ||
    (!isDefaultRange && (!!fromValue || !!toValue || allTime));

  const templateOptions = [
    ...Object.keys(EMAIL_DEFAULTS).map((key) => ({
      key,
      label: EMAIL_DEFAULTS[key].label,
    })),
    ...facets.templateKeys
      .filter((key) => !EMAIL_DEFAULTS[key])
      .map((key) => ({ key, label: key })),
  ];

  const sheetFilterCount =
    (status !== "ALL" ? 1 : 0) +
    (templateKey !== "ALL" ? 1 : 0) +
    (fromValue !== defaultRange.from ? 1 : 0) +
    (toValue !== defaultRange.to ? 1 : 0);

  function openSheet() {
    setDraft({
      status,
      templateKey,
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
      templateKey: draft.templateKey,
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
        id: "email-log-filter-search-m",
        label: "Search emails",
        placeholder: "Search by recipient or subject…",
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
      sheetLabel="Email filters"
    >
      <Select
        label="Status"
        id="email-log-sheet-status"
        value={draft.status}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
      >
        <option value="ALL">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="SENT">Sent</option>
        <option value="FAILED">Failed</option>
      </Select>
      <Select
        label="Template"
        id="email-log-sheet-template"
        value={draft.templateKey}
        style={{ minHeight: "44px" }}
        onChange={(e) => setDraft((d) => ({ ...d, templateKey: e.target.value }))}
      >
        <option value="ALL">All Templates</option>
        {templateOptions.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </Select>
      <div>
        <label htmlFor="email-log-sheet-from" style={labelStyle}>
          From
        </label>
        <input
          id="email-log-sheet-from"
          type="date"
          dir="ltr"
          value={draft.from}
          onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
          style={{ ...inputStyle, minHeight: "44px" }}
        />
      </div>
      <div>
        <label htmlFor="email-log-sheet-to" style={labelStyle}>
          To
        </label>
        <input
          id="email-log-sheet-to"
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
          id="email-log-filter-status"
          value={status}
          onChange={(e) => pushParams({ status: e.target.value })}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>

      <div style={{ minWidth: "200px" }}>
        <Select
          label="Template"
          id="email-log-filter-template"
          value={templateKey}
          onChange={(e) => pushParams({ templateKey: e.target.value })}
        >
          <option value="ALL">All Templates</option>
          {templateOptions.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="email-log-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="email-log-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Search by recipient or subject…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="email-log-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="email-log-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="email-log-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="email-log-filter-to"
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

      <button
        type="button"
        onClick={() => {
          setFromValue("");
          setToValue("");
          pushParams({ from: "", to: "", range: "all" });
        }}
        style={secondaryBtn}
      >
        All time
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
