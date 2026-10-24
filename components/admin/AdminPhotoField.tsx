"use client";

import { useId, useRef, useState } from "react";
import type { FocalPoint } from "@/lib/utils/focal-point";

interface Props {
  name: string;
  purpose: string;
  spec: string;
  previewUrl: string | null;
  onSelect: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  busy?: boolean;
  error?: string | null;
  onRemove?: () => void;
  focus?: FocalPoint;
  focusDefault?: FocalPoint;
  onFocusChange?: (p: FocalPoint) => void;
}

const clampPercent = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

const ARROW_STEP: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

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

export default function AdminPhotoField({
  name,
  purpose,
  spec,
  previewUrl,
  onSelect,
  multiple = false,
  accept = "image/jpeg,image/png,image/webp",
  busy = false,
  error = null,
  onRemove,
  focus,
  focusDefault,
  onFocusChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const readoutId = useId();

  function pointFrom(e: React.PointerEvent<HTMLDivElement>): FocalPoint {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: clampPercent(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((e.clientY - rect.top) / rect.height) * 100),
    };
  }

  function nudge(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEP[e.key];
    if (!step || !focus || !onFocusChange) return;
    e.preventDefault();
    const size = e.shiftKey ? 10 : 1;
    onFocusChange({
      x: clampPercent(focus.x + step[0] * size),
      y: clampPercent(focus.y + step[1] * size),
    });
  }

  function pick(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onSelect(files);
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
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
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
            No photo yet
          </div>
        )}
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
            {busy ? "UPLOADING…" : previewUrl ? "REPLACE PHOTO" : "CHOOSE PHOTO"}
          </button>
          <span style={lineStyle}>or drop a file here</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          aria-label={name}
          accept={accept}
          multiple={multiple}
          tabIndex={-1}
          style={hiddenInput}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {focus && onFocusChange && previewUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div
            tabIndex={0}
            role="group"
            aria-label="Focus point"
            aria-describedby={readoutId}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onFocusChange(pointFrom(e));
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                onFocusChange(pointFrom(e));
              }
            }}
            onKeyDown={nudge}
            style={{
              position: "relative",
              width: "100%",
              touchAction: "none",
              cursor: "crosshair",
              userSelect: "none",
              lineHeight: 0,
            }}
          >
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${focus.x}%`,
                top: `${focus.y}%`,
                width: "22px",
                height: "22px",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "2px solid var(--primitive-white)",
                boxShadow:
                  "0 0 0 2px color-mix(in srgb, var(--primitive-black) 70%, transparent)",
                boxSizing: "border-box",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primitive-white)",
                }}
              />
            </span>
          </div>
          <p style={lineStyle}>
            Click or drag on the photo to choose what stays in view. Arrow keys nudge.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span id={readoutId} aria-live="polite" style={lineStyle}>
              Focus {focus.x}% · {focus.y}%
            </span>
            {focusDefault && (
              <button type="button" onClick={() => onFocusChange(focusDefault)} style={linkBtn}>
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {onRemove && previewUrl && (
        <div>
          <button type="button" onClick={onRemove} style={linkBtn}>
            Remove photo
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
