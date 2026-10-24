"use client";

import { useRef, useState } from "react";

interface Props {
  name: string;
  purpose: string;
  spec: string;
  videoUrl: string | null;
  onSelect: (file: File) => void;
  busy?: boolean;
  progress?: number;
  disabled?: boolean;
  disabledNote?: string | null;
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

export default function AdminVideoField({
  name,
  purpose,
  spec,
  videoUrl,
  onSelect,
  busy = false,
  progress = 0,
  disabled = false,
  disabledNote = null,
  error = null,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inactive = busy || disabled;

  function pick(list: FileList | null) {
    const file = list?.[0];
    if (file && !inactive) onSelect(file);
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
      <p style={lineStyle}>{purpose}</p>
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
          pick(e.dataTransfer.files);
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
        {videoUrl ? (
          <video
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "96px",
              height: "72px",
              objectFit: "cover",
              flexShrink: 0,
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "96px",
              height: "72px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#2a2520",
              color: "#9a9a9a",
              fontSize: "var(--text-body-sm)",
              textAlign: "center",
            }}
          >
            No video yet
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <button
            type="button"
            disabled={inactive}
            onClick={() => inputRef.current?.click()}
            style={{
              ...chooseBtn,
              opacity: inactive ? 0.5 : 1,
              cursor: inactive ? "not-allowed" : "pointer",
            }}
          >
            {busy ? `UPLOADING… ${progress}%` : videoUrl ? "REPLACE VIDEO" : "CHOOSE VIDEO"}
          </button>
          <span style={lineStyle}>or drop a file here</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          aria-label={name}
          accept="video/mp4"
          tabIndex={-1}
          style={hiddenInput}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {disabled && disabledNote && <p style={lineStyle}>{disabledNote}</p>}
      {onRemove && videoUrl && (
        <div>
          <button type="button" onClick={onRemove} style={linkBtn}>
            Remove video
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
