"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import { CATEGORY_ORDER, type EmailTemplateCategory } from "@/lib/email/defaults";

interface EmailTemplateRow {
  key: string;
  label: string;
  category: EmailTemplateCategory;
  subject: string;
  hasOverride: { en: boolean; ar: boolean; ru: boolean };
  sending: boolean;
}

const LOCALE_ORDER: Array<"en" | "ar" | "ru"> = ["en", "ar", "ru"];

interface Props {
  rows: EmailTemplateRow[];
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  paddingInline: "1rem",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function EmailTemplatesTable({ rows }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory | "All">("All");

  const term = search.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (category !== "All" && row.category !== category) return false;
    if (!term) return true;
    return (
      row.label.toLowerCase().includes(term) ||
      row.key.toLowerCase().includes(term) ||
      row.subject.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "1rem 1.25rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-shop-divider)",
        }}
      >
        <div style={{ flex: 1, minWidth: "240px" }}>
          <label
            htmlFor="email-template-search"
            style={{
              display: "block",
              fontSize: "var(--text-body)",
              fontWeight: "var(--font-medium)",
              color: "#6b6b6b",
              marginBottom: "0.375rem",
            }}
          >
            Search
          </label>
          <input
            id="email-template-search"
            type="text"
            dir="ltr"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, key, or subject…"
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              fontSize: "var(--text-body)",
              color: "#0b0b0b",
              backgroundColor: "#ffffff",
              border: "1.5px solid var(--color-shop-divider)",
              borderRadius: "0",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setCategory("All")}
            style={{
              ...btnBase,
              backgroundColor: category === "All" ? "#0b0b0b" : "#ffffff",
              color: category === "All" ? "#ffffff" : "#0b0b0b",
              border: category === "All" ? "none" : "1px solid #c9c4be",
            }}
          >
            All
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              style={{
                ...btnBase,
                backgroundColor: category === c ? "#0b0b0b" : "#ffffff",
                color: category === c ? "#ffffff" : "#0b0b0b",
                border: category === c ? "none" : "1px solid #c9c4be",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b", margin: 0 }}>
        Override columns (EN / AR / RU):{" "}
        <span
          style={{
            display: "inline-block",
            width: "0.625rem",
            height: "0.625rem",
            borderRadius: "9999px",
            backgroundColor: "#1e40af",
            marginInlineEnd: "0.25rem",
            verticalAlign: "middle",
          }}
        />
        customized &nbsp;·&nbsp;
        <span
          style={{
            display: "inline-block",
            width: "0.625rem",
            height: "0.625rem",
            borderRadius: "9999px",
            backgroundColor: "#c9c4be",
            marginInlineEnd: "0.25rem",
            verticalAlign: "middle",
          }}
        />
        using default
      </p>

      <DataTable
        rows={filtered}
        getRowKey={(row) => row.key}
        onRowClick={(row) => {
          const href = `/admin/email-templates/${row.key}`;
          startNavigationProgress(href);
          router.push(href);
        }}
        emptyMessage="No email templates match your search."
        columns={[
          {
            key: "template",
            header: "Template",
            render: (row) => (
              <div>
                <div style={{ color: "#0b0b0b", fontWeight: "var(--font-medium)" }}>
                  {row.label}
                </div>
                <div
                  dir="ltr"
                  style={{
                    fontFamily: "monospace",
                    fontSize: "var(--text-body-sm)",
                    color: "#9a9a9a",
                  }}
                >
                  {row.key}
                </div>
              </div>
            ),
          },
          {
            key: "subject",
            header: "Default Subject",
            render: (row) => <span style={{ color: "#6b6b6b" }}>{row.subject}</span>,
          },
          {
            key: "overrides",
            header: "Overrides",
            render: (row) => (
              <div style={{ display: "flex", gap: "0.375rem" }}>
                {LOCALE_ORDER.map((locale) => (
                  <span
                    key={locale}
                    style={{
                      display: "inline-block",
                      paddingInline: "0.5rem",
                      paddingBlock: "0.125rem",
                      fontSize: "var(--text-label)",
                      fontWeight: "var(--font-semibold)",
                      letterSpacing: "var(--tracking-wide)",
                      textTransform: "uppercase",
                      backgroundColor: row.hasOverride[locale] ? "#dbeafe" : "#f3f4f6",
                      color: row.hasOverride[locale] ? "#1e40af" : "#9a9a9a",
                    }}
                  >
                    {locale}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: "sending",
            header: "Sending",
            align: "end",
            render: (row) => (
              <span style={{ color: row.sending ? "#0b0b0b" : "#991b1b" }}>
                {row.sending ? "On" : "Paused"}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
