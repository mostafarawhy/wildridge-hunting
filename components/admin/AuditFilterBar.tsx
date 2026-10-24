"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import {
  auditActionLabel,
  auditEntityLabel,
  AUDIT_CATEGORY_LABEL,
  FILTERABLE_AUDIT_CATEGORIES,
} from "@/lib/utils/audit-taxonomy";
import { dubaiRecentDays } from "@/lib/utils/date";
import type { AuditFilterFacets } from "@/lib/db/queries/audit-log";

interface Props {
  category: string;
  entityType: string;
  action: string;
  actorType: string;
  actorId: string;
  entityId: string;
  query: string;
  from: string;
  to: string;
  facets: AuditFilterFacets;
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

export default function AuditFilterBar({
  category,
  entityType,
  action,
  actorType,
  actorId,
  entityId,
  query,
  from,
  to,
  facets,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(query);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function pushParams(next: {
    category?: string;
    entityType?: string;
    action?: string;
    actorType?: string;
    actorId?: string;
    entityId?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();

    const c = next.category ?? category;
    if (c !== "ALL") params.set("category", c);

    const et = next.entityType ?? entityType;
    if (et !== "ALL") params.set("entityType", et);

    const ac = next.action ?? action;
    if (ac !== "ALL") params.set("action", ac);

    const at = next.actorType ?? actorType;
    if (at !== "ALL") params.set("actorType", at);

    const ai = next.actorId ?? actorId;
    if (ai !== "ALL") params.set("actorId", ai);

    const invalidatesEntity =
      next.category !== undefined || next.entityType !== undefined;
    const ei = invalidatesEntity ? "" : (next.entityId ?? entityId);
    if (ei) params.set("entityId", ei);

    const q = next.q ?? searchValue.trim();
    if (q) params.set("q", q);

    const f = next.from !== undefined ? next.from : fromValue;
    if (f) params.set("from", f);

    const t = next.to !== undefined ? next.to : toValue;
    if (t) params.set("to", t);

    const qs = params.toString();
    const href = `/admin/audit${qs ? `?${qs}` : ""}`;
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
    startNavigationProgress("/admin/audit");
    router.push("/admin/audit");
  }

  const hasActiveFilters =
    category !== "ALL" ||
    entityType !== "ALL" ||
    action !== "ALL" ||
    actorType !== "ALL" ||
    actorId !== "ALL" ||
    searchValue.trim() !== "" ||
    !!fromValue ||
    !!toValue ||
    !!entityId;

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
          label="Category"
          id="audit-filter-category"
          value={category}
          onChange={(e) => pushParams({ category: e.target.value })}
        >
          <option value="ALL">All Categories</option>
          {FILTERABLE_AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {AUDIT_CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Entity Type"
          id="audit-filter-entity-type"
          value={entityType}
          onChange={(e) => pushParams({ entityType: e.target.value })}
        >
          <option value="ALL">All Entities</option>
          {facets.entityTypes.map((et) => (
            <option key={et} value={et}>
              {auditEntityLabel(et)}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Action"
          id="audit-filter-action"
          value={action}
          onChange={(e) => pushParams({ action: e.target.value })}
        >
          <option value="ALL">All Actions</option>
          {facets.actions.map((a) => (
            <option key={a} value={a}>
              {auditActionLabel(a)}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ minWidth: "140px" }}>
        <Select
          label="Actor Type"
          id="audit-filter-actor-type"
          value={actorType}
          onChange={(e) => pushParams({ actorType: e.target.value })}
        >
          <option value="ALL">All Actor Types</option>
          <option value="STAFF">Staff</option>
          <option value="SYSTEM">System</option>
          <option value="CUSTOMER">Customer</option>
        </Select>
      </div>

      <div style={{ minWidth: "160px" }}>
        <Select
          label="Actor"
          id="audit-filter-actor"
          value={actorId}
          onChange={(e) => pushParams({ actorId: e.target.value })}
        >
          <option value="ALL">All Actors</option>
          {facets.actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div style={{ flex: 1, minWidth: "240px" }}>
        <label htmlFor="audit-filter-search" style={labelStyle}>
          Search
        </label>
        <input
          id="audit-filter-search"
          type="text"
          dir="ltr"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushParams({ q: searchValue.trim() });
          }}
          placeholder="Search by entity ID or actor ID…"
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="audit-filter-from" style={labelStyle}>
          From
        </label>
        <input
          id="audit-filter-from"
          type="date"
          dir="ltr"
          value={fromValue}
          onChange={(e) => setFromValue(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ minWidth: "160px" }}>
        <label htmlFor="audit-filter-to" style={labelStyle}>
          To
        </label>
        <input
          id="audit-filter-to"
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
