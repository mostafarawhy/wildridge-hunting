"use client";

import { useRef, useState } from "react";

interface Props {
  name: string;
  spec: string;
  file: File | null;
  onSelect: (file: File) => void;
  purpose?: string;
  accept?: string;
  busy?: boolean;
  error?: string | null;
  onRemove?: () => void;
}

const lineStyle: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

const hiddenInput: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

const chooseBtn: React.CSSProperties = {
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
  transition: "opacity 150ms",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminFileField({
  name,
  spec,
  file,
  onSelect,
  purpose,
  accept = "image/jpeg,image/png,application/pdf",
  busy = false,
  error = null,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(list: FileList | null) {
    const first = list && list.length > 0 ? list[0] : null;
    if (first) onSelect(first);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <span
        style={{
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-semibold)",
          color: "#0b0b0b",
        }}
      >
        {name}
      </span>
      {purpose && <p style={lineStyle}>{purpose}</p>}
      <p style={lineStyle}>{spec}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) pick(e.dataTransfer.files);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem",
          backgroundColor: "var(--color-auth-form-bg)",
          border: dragging ? "1px solid #0b0b0b" : "1px dashed #9a9a9a",
          borderRadius: "0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            style={{
              ...chooseBtn,
              opacity: busy ? 0.5 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {file ? "Replace file" : "Choose file"}
          </button>
          <span style={lineStyle}>or drop a file here</span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {file ? (
            <>
              <p
                dir="ltr"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "#0b0b0b",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "start",
                }}
              >
                {file.name}
              </p>
              <p style={lineStyle}>{formatSize(file.size)}</p>
            </>
          ) : (
            <p style={lineStyle}>No file chosen.</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          aria-label={name}
          accept={accept}
          tabIndex={-1}
          style={hiddenInput}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {onRemove && file && (
        <div>
          <button type="button" onClick={onRemove} style={linkBtn}>
            Remove file
          </button>
        </div>
      )}
      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
