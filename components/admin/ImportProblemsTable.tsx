"use client";

import DataTable from "@/components/admin/DataTable";
import {
  columnLabel,
  issuesToCsv,
  type ImportIssue,
} from "@/lib/utils/catalog-import";

interface Props {
  issues: ImportIssue[];
  fileName: string;
}

const RED = "#991b1b";

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
  padding: "1.25rem 1.5rem",
};

const commitBtn: React.CSSProperties = {
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
  textDecoration: "none",
  borderRadius: "0",
  border: "none",
  cursor: "pointer",
};

const mono: React.CSSProperties = {
  color: "#0b0b0b",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "var(--text-body-sm)",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function ImportProblemsTable({ issues, fileName }: Props) {
  function downloadReport() {
    const base = fileName.replace(/\.xlsx$/i, "");
    const blob = new Blob([issuesToCsv(issues)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-problem-report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ ...eyebrow, color: RED }}>
          {plural(issues.length, "problem", "problems")}
        </p>
        <button
          type="button"
          onClick={downloadReport}
          style={{
            ...commitBtn,
            backgroundColor: "var(--color-action-primary)",
            color: "#ffffff",
          }}
        >
          Download problem report
        </button>
      </div>
      <DataTable
        rows={issues.map((issue, i) => ({ issue, i }))}
        getRowKey={(r) => String(r.i)}
        columns={[
          {
            key: "where",
            header: "Where in your file",
            render: ({ issue }) => (
              <div>
                <p style={{ color: "#0b0b0b" }}>
                  {issue.sheet === null
                    ? "Whole file"
                    : issue.row === null
                      ? `${issue.sheet} sheet`
                      : `${issue.sheet} sheet · row ${issue.row}`}
                </p>
                {issue.column && (
                  <p style={{ color: "#0b0b0b" }}>{columnLabel(issue.column)}</p>
                )}
                {issue.column && (
                  <p style={{ ...mono, color: "#4b4b4b" }}>column {issue.column}</p>
                )}
              </div>
            ),
          },
          {
            key: "sku",
            header: "SKU",
            render: ({ issue }) => (
              <span style={{ ...mono, color: "#0b0b0b" }}>{issue.sku ?? "—"}</span>
            ),
          },
          {
            key: "found",
            header: "You entered",
            render: ({ issue }) => (
              <span style={{ ...mono, color: "#0b0b0b" }}>{issue.found ?? "—"}</span>
            ),
          },
          {
            key: "problem",
            header: "What's wrong and how to fix it",
            render: ({ issue }) => (
              <div>
                <p style={{ color: "#0b0b0b" }}>{issue.problem}</p>
                {issue.fix && (
                  <p style={{ fontSize: "var(--text-body-sm)", color: "#4b4b4b" }}>
                    {issue.fix}
                  </p>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
