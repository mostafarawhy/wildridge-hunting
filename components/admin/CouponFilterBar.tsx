"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import Select from "@/components/ui/Select";
import {
  COUPON_STATUSES,
  COUPON_STATUS_LABELS,
  COUPON_TYPE_LABELS,
  type CouponStatus,
} from "@/lib/utils/coupon-display";
import type { CouponType } from "@/app/generated/prisma/enums";
import type { CouponSourceFilter } from "@/lib/db/queries/coupon";

export interface CouponFilterValues {
  status: CouponStatus | "ALL";
  q: string;
  type: CouponType | "";
  source: CouponSourceFilter | "";
}

interface Props {
  values: CouponFilterValues;
  counts: Record<CouponStatus | "ALL", number>;
}

const STATUS_TABS: (CouponStatus | "ALL")[] = ["ALL", ...COUPON_STATUSES];

const TYPE_OPTIONS: CouponType[] = ["PERCENTAGE", "FIXED", "FREE_SHIPPING"];

const SOURCE_LABELS: Record<CouponSourceFilter, string> = {
  manual: "Created by staff",
  reward: "Reward rules",
};

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

const textButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

export default function CouponFilterBar({ values, counts }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(values.q);

  const [prevKey, setPrevKey] = useState(values.q);
  if (prevKey !== values.q) {
    setPrevKey(values.q);
    setSearchValue(values.q);
  }

  type Override = Partial<CouponFilterValues>;

  function push(override: Override) {
    const next: CouponFilterValues = {
      ...values,
      q: searchValue.trim(),
      ...override,
    };
    const params = new URLSearchParams();
    if (next.status !== "ALL") params.set("status", next.status);
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.source) params.set("source", next.source);

    const qs = params.toString();
    const href = `/admin/coupons${qs ? `?${qs}` : ""}`;
    startNavigationProgress(href);
    router.push(href);
  }

  const chips: { key: string; label: string; remove: Override }[] = [];
  if (values.q) {
    chips.push({ key: "q", label: `Search: ${values.q}`, remove: { q: "" } });
  }
  if (values.type) {
    chips.push({
      key: "type",
      label: `Type: ${COUPON_TYPE_LABELS[values.type]}`,
      remove: { type: "" },
    });
  }
  if (values.source) {
    chips.push({
      key: "source",
      label: `Source: ${SOURCE_LABELS[values.source]}`,
      remove: { source: "" },
    });
  }

  function clearAll() {
    setSearchValue("");
    push({ q: "", type: "", source: "" });
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        role="tablist"
        aria-label="Coupon status"
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-shop-divider)",
          marginBottom: "1rem",
        }}
      >
        {STATUS_TABS.map((s) => {
          const active = values.status === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => push({ status: s })}
              style={{
                background: "none",
                border: "none",
                borderBottom: active
                  ? "2px solid #0b0b0b"
                  : "2px solid transparent",
                marginBottom: "-1px",
                padding: "0.5rem 0",
                fontSize: "var(--text-body)",
                fontWeight: active ? "var(--font-bold)" : "var(--font-medium)",
                color: active ? "#0b0b0b" : "#6b6b6b",
                cursor: "pointer",
              }}
            >
              {s === "ALL" ? "All" : COUPON_STATUS_LABELS[s]} ({counts[s]})
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1rem 1.25rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: "240px" }}>
            <label htmlFor="coupon-filter-search" style={labelStyle}>
              Search
            </label>
            <input
              id="coupon-filter-search"
              type="text"
              dir="ltr"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") push({ q: searchValue.trim() });
              }}
              placeholder="Code or customer email"
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={() => push({ q: searchValue.trim() })}
            style={blackButton}
          >
            Search
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "200px" }}>
            <Select
              label="Type"
              id="coupon-filter-type"
              value={values.type}
              onChange={(e) => push({ type: e.target.value as CouponType | "" })}
            >
              <option value="">All types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {COUPON_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ minWidth: "200px" }}>
            <Select
              label="Source"
              id="coupon-filter-source"
              value={values.source}
              onChange={(e) =>
                push({ source: e.target.value as CouponSourceFilter | "" })
              }
            >
              <option value="">All sources</option>
              <option value="manual">{SOURCE_LABELS.manual}</option>
              <option value="reward">{SOURCE_LABELS.reward}</option>
            </Select>
          </div>
        </div>

        {chips.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            {chips.map((chip) => (
              <span
                key={chip.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.25rem 0.25rem 0.25rem 0.625rem",
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  border: "1px solid var(--color-shop-divider)",
                }}
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter: ${chip.label}`}
                  onClick={() => {
                    if (chip.key === "q") setSearchValue("");
                    push(chip.remove);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0 0.375rem",
                    fontSize: "var(--text-body)",
                    lineHeight: 1,
                    color: "#0b0b0b",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={clearAll} style={textButton}>
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
