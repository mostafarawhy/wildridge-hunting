"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/admin/DataTable";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  replaceProductSpecsAction,
  type ProductSpecIssue,
} from "@/lib/actions/product-spec";
import {
  MAX_PRODUCT_SPEC_ROWS,
  MAX_SPEC_LABEL_LEN,
  MAX_SPEC_VALUE_LEN,
} from "@/lib/validations/product";

interface Spec {
  id: string;
  labelEn: string;
  labelAr: string;
  labelRu: string | null;
  valueEn: string;
  valueAr: string;
  valueRu: string | null;
}

interface Props {
  productId: string;
  specs: Spec[];
}

type DraftRow = {
  key: string;
  labelEn: string;
  labelAr: string;
  labelRu: string;
  valueEn: string;
  valueAr: string;
  valueRu: string;
};

type TextField = Exclude<keyof DraftRow, "key">;

type SpecIssueView = { field: string | null; message: string };

const FIELD_LABEL: Record<string, string> = {
  labelEn: "Label (English)",
  labelAr: "Label (Arabic)",
  labelRu: "Label (Russian)",
  valueEn: "Value (English)",
  valueAr: "Value (Arabic)",
  valueRu: "Value (Russian)",
};

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardTitle: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const blackButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.5rem",
  fontSize: "var(--text-body)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--radius-none)",
  cursor: "pointer",
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

const iconButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2rem",
  height: "2rem",
  background: "none",
  border: "none",
  padding: 0,
  color: "#0b0b0b",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "var(--color-auth-input-text)",
  backgroundColor: "var(--color-auth-input-bg)",
  border: "1.5px solid var(--color-auth-input-border)",
  borderRadius: "var(--radius-none)",
  outline: "none",
  fontFamily: "inherit",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#4b4b4b",
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
  gap: "0.75rem",
};

function newKey() {
  return crypto.randomUUID();
}

function emptyRow(): DraftRow {
  return {
    key: newKey(),
    labelEn: "",
    labelAr: "",
    labelRu: "",
    valueEn: "",
    valueAr: "",
    valueRu: "",
  };
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpecField({
  id,
  label,
  value,
  onChange,
  rtl,
  maxLength,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rtl?: boolean;
  maxLength: number;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label htmlFor={id} style={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={rtl ? "rtl" : undefined}
        maxLength={maxLength}
        aria-invalid={!!error}
        style={{
          ...inputStyle,
          borderColor: error
            ? "var(--color-auth-input-border-focus)"
            : "var(--color-auth-input-border)",
        }}
      />
    </div>
  );
}

export default function ProductSpecsPanel({ productId, specs }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [issues, setIssues] = useState<Record<number, SpecIssueView[]>>({});
  const [pending, setPending] = useState(false);

  function openEditor() {
    setRows(
      specs.map((s) => ({
        key: newKey(),
        labelEn: s.labelEn,
        labelAr: s.labelAr,
        labelRu: s.labelRu ?? "",
        valueEn: s.valueEn,
        valueAr: s.valueAr,
        valueRu: s.valueRu ?? "",
      })),
    );
    setIssues({});
    setOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setOpen(false);
  }

  function updateRow(index: number, field: TextField, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
    setIssues({});
  }

  function moveRow(index: number, delta: number) {
    setRows((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setIssues({});
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setIssues({});
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
    setIssues({});
  }

  function showIssues(list: ProductSpecIssue[]) {
    const byRow: Record<number, SpecIssueView[]> = {};
    for (const issue of list) {
      if (issue.row === null) {
        toast.error(issue.message);
        continue;
      }
      (byRow[issue.row] ??= []).push({
        field: issue.field,
        message: issue.message,
      });
    }
    setIssues(byRow);
  }

  async function handleSave() {
    setPending(true);
    const result = await replaceProductSpecsAction(productId, {
      rows: rows.map((r) => ({
        labelEn: r.labelEn,
        labelAr: r.labelAr,
        labelRu: r.labelRu,
        valueEn: r.valueEn,
        valueAr: r.valueAr,
        valueRu: r.valueRu,
      })),
    });
    setPending(false);

    if (!result.success) {
      if (result.errorCode === "NO_CHANGES") {
        setOpen(false);
        toast.info("No changes to save.");
        return;
      }
      if (result.issues && result.issues.length > 0) {
        showIssues(result.issues);
        if (result.errorCode === "DUPLICATE_LABEL") toast.error(result.error);
      } else {
        toast.error(result.error);
      }
      return;
    }

    toast.success("Specifications saved.");
    setOpen(false);
    router.refresh();
  }

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h2 style={cardTitle}>Specifications</h2>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              color: "#4b4b4b",
              margin: 0,
            }}
          >
            Shown on the product page. The first three appear as key specs under
            the price. A catalog import also replaces them.
          </p>
        </div>
        <button type="button" onClick={openEditor} style={blackButton}>
          Edit specs
        </button>
      </div>
      <DataTable
        rows={specs}
        getRowKey={(s) => s.id}
        emptyMessage="No specifications yet. Use Edit specs to add them."
        columns={[
          {
            key: "label",
            header: "Label",
            render: (s) => (
              <div>
                <span style={{ display: "block", color: "#0b0b0b" }}>{s.labelEn}</span>
                <span dir="rtl" style={{ display: "block", color: "#4b4b4b" }}>
                  {s.labelAr}
                </span>
                {s.labelRu && (
                  <span style={{ display: "block", color: "#4b4b4b" }}>{s.labelRu}</span>
                )}
              </div>
            ),
          },
          {
            key: "en",
            header: "English",
            render: (s) => <span style={{ color: "#0b0b0b" }}>{s.valueEn}</span>,
          },
          {
            key: "ar",
            header: "Arabic",
            render: (s) => (
              <span dir="rtl" style={{ color: "#0b0b0b" }}>
                {s.valueAr}
              </span>
            ),
          },
          {
            key: "ru",
            header: "Russian",
            render: (s) => <span style={{ color: "#0b0b0b" }}>{s.valueRu ?? "—"}</span>,
          },
        ]}
      />

      <Modal
        open={open}
        onClose={closeEditor}
        maxWidth={900}
        ariaLabel="Edit specifications"
        closeOnBackdropClick={false}
      >
        <div
          style={{
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <h2 style={{ ...cardTitle, paddingInlineEnd: "2.5rem" }}>
            Edit specifications
          </h2>

          {rows.length === 0 && (
            <p style={{ ...fieldLabel, margin: 0 }}>
              No specifications yet. Use Add row to create the first one.
            </p>
          )}

          {rows.map((row, index) => {
            const rowIssues = issues[index];
            return (
              <div
                key={row.key}
                style={{
                  border: "1px solid var(--color-shop-divider)",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "var(--font-bold)",
                      color: "#0b0b0b",
                    }}
                  >
                    Row {index + 1}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      type="button"
                      aria-label={`Move row ${index + 1} up`}
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      style={{ ...iconButton, opacity: index === 0 ? 0.3 : 1 }}
                    >
                      <ArrowIcon up />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move row ${index + 1} down`}
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      style={{
                        ...iconButton,
                        opacity: index === rows.length - 1 ? 0.3 : 1,
                      }}
                    >
                      <ArrowIcon up={false} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      style={{
                        ...textButton,
                        color: "var(--color-error)",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div style={grid3}>
                  <SpecField
                    id={`spec-${row.key}-label-en`}
                    label="Label (English)"
                    value={row.labelEn}
                    onChange={(v) => updateRow(index, "labelEn", v)}
                    maxLength={MAX_SPEC_LABEL_LEN}
                    error={rowIssues?.find((i) => i.field === "labelEn")?.message}
                  />
                  <SpecField
                    id={`spec-${row.key}-label-ar`}
                    label="Label (Arabic)"
                    value={row.labelAr}
                    onChange={(v) => updateRow(index, "labelAr", v)}
                    rtl
                    maxLength={MAX_SPEC_LABEL_LEN}
                    error={rowIssues?.find((i) => i.field === "labelAr")?.message}
                  />
                  <SpecField
                    id={`spec-${row.key}-label-ru`}
                    label="Label (Russian)"
                    value={row.labelRu}
                    onChange={(v) => updateRow(index, "labelRu", v)}
                    maxLength={MAX_SPEC_LABEL_LEN}
                    error={rowIssues?.find((i) => i.field === "labelRu")?.message}
                  />
                </div>
                <div style={grid3}>
                  <SpecField
                    id={`spec-${row.key}-value-en`}
                    label="Value (English)"
                    value={row.valueEn}
                    onChange={(v) => updateRow(index, "valueEn", v)}
                    maxLength={MAX_SPEC_VALUE_LEN}
                    error={rowIssues?.find((i) => i.field === "valueEn")?.message}
                  />
                  <SpecField
                    id={`spec-${row.key}-value-ar`}
                    label="Value (Arabic)"
                    value={row.valueAr}
                    onChange={(v) => updateRow(index, "valueAr", v)}
                    rtl
                    maxLength={MAX_SPEC_VALUE_LEN}
                    error={rowIssues?.find((i) => i.field === "valueAr")?.message}
                  />
                  <SpecField
                    id={`spec-${row.key}-value-ru`}
                    label="Value (Russian)"
                    value={row.valueRu}
                    onChange={(v) => updateRow(index, "valueRu", v)}
                    maxLength={MAX_SPEC_VALUE_LEN}
                    error={rowIssues?.find((i) => i.field === "valueRu")?.message}
                  />
                </div>

                {rowIssues && rowIssues.length > 0 && (
                  <ul
                    role="alert"
                    style={{
                      margin: 0,
                      paddingInlineStart: "1.25rem",
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-auth-error-text)",
                    }}
                  >
                    {rowIssues.map((i) => (
                      <li key={`${i.field ?? ""}:${i.message}`}>
                        {i.field
                          ? `${FIELD_LABEL[i.field] ?? i.field}: ${i.message}`
                          : i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <div>
            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= MAX_PRODUCT_SPEC_ROWS}
              style={{
                ...blackButton,
                opacity: rows.length >= MAX_PRODUCT_SPEC_ROWS ? 0.4 : 1,
              }}
            >
              Add row
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid var(--color-shop-divider)",
            }}
          >
            <button
              type="button"
              onClick={closeEditor}
              disabled={pending}
              style={textButton}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              style={{ ...blackButton, opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Saving…" : "Save specifications"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
