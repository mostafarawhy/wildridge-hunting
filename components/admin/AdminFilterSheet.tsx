"use client";

import BottomSheet from "@/components/ui/BottomSheet";

interface Props {
  search?: {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
  };
  activeCount: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  sheetLabel: string;
  children: React.ReactNode;
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

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "44px",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
};

export default function AdminFilterSheet({
  search,
  activeCount,
  open,
  onOpen,
  onClose,
  onApply,
  onClear,
  sheetLabel,
  children,
}: Props) {
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
        {search && (
          <input
            id={search.id}
            type="text"
            dir="ltr"
            aria-label={search.label}
            enterKeyHint="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search.onSubmit();
            }}
            placeholder={search.placeholder}
            style={{ ...inputStyle, flex: 1, minWidth: 0, minHeight: "44px" }}
          />
        )}
        <button
          type="button"
          onClick={onOpen}
          style={{
            ...btnBase,
            gap: "0.5rem",
            flex: search ? "0 0 auto" : 1,
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
          }}
        >
          Filters
          {activeCount > 0 && (
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
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={onClose}
        ariaLabel={sheetLabel}
        title="Filters"
        closeLabel="Close"
        footer={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onClear();
              }}
              style={{
                ...btnBase,
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
              onClick={onApply}
              style={{
                ...btnBase,
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
          {children}
        </div>
      </BottomSheet>
    </>
  );
}
