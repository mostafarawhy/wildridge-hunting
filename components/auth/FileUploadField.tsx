"use client";

import { useRef, useState } from "react";

interface FileUploadFieldProps {
  id: string;
  label: string;
  hint?: string;
  optional?: string;
  accept?: string;
  maxSizeBytes?: number;
  required?: boolean;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  dropOrClickLabel?: string;
  removeLabel?: string;
  invalidTypeError?: string;
  tooLargeError?: string;
}

export default function FileUploadField({
  id,
  label,
  hint,
  optional,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeBytes = 10 * 1024 * 1024,
  required = false,
  value,
  onChange,
  error,
  dropOrClickLabel = "Drop file here or click to upload",
  removeLabel = "Remove",
  invalidTypeError = "Only PDF, JPG, or PNG files are allowed.",
  tooLargeError = "File exceeds 10 MB limit.",
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error ?? localError ?? undefined;

  function validate(file: File): string | null {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return invalidTypeError;
    }
    if (file.size > maxSizeBytes) {
      return tooLargeError;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setLocalError(err);
      onChange(null);
    } else {
      setLocalError(null);
      onChange(file);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setLocalError(null);
    onChange(null);
  }

  const fileSizeKB = value ? Math.round(value.size / 1024) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <style>{`
        .file-dropzone:focus-visible {
          outline: none;
          border-color: var(--color-auth-input-border-focus) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-action-primary) 6%, transparent);
        }
        .file-remove-btn { transition: color 150ms; }
        .file-remove-btn:hover { color: var(--color-auth-label-text) !important; }
      `}</style>

      <label
        htmlFor={id}
        className="block text-body font-medium"
        style={{ color: "var(--color-auth-label-text)" }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: "var(--color-error)" }}
            className="ms-0.5"
          >
            {" *"}
          </span>
        )}
        {optional && !required && (
          <span
            className="text-body-sm ms-1.5"
            style={{
              color: "var(--color-auth-input-placeholder)",
              fontWeight: "normal",
            }}
          >
            ({optional})
          </span>
        )}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{
          position: "absolute",
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {value ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            backgroundColor: "var(--color-auth-input-bg)",
            border: displayError
              ? "1.5px solid var(--color-auth-error-border)"
              : "1.5px solid var(--color-auth-input-border-focus)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.125rem",
              minWidth: 0,
            }}
          >
            <span
              className="text-body-sm font-medium"
              style={{
                color: "var(--color-auth-label-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {value.name}
            </span>
            <span
              className="text-body-sm"
              style={{ color: "var(--color-auth-input-placeholder)" }}
            >
              {fileSizeKB} KB
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-body-sm file-remove-btn"
            style={{
              color: "var(--color-content-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              marginInlineStart: "0.75rem",
            }}
            aria-label={`${removeLabel} ${value.name}`}
          >
            {removeLabel}
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="file-dropzone"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          aria-describedby={
            displayError ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "1.5rem 1rem",
            cursor: "pointer",
            backgroundColor: "var(--color-auth-input-bg)",
            border: displayError
              ? "1.5px dashed var(--color-auth-error-border)"
              : dragOver
                ? "1.5px dashed var(--color-auth-input-border-focus)"
                : "1.5px dashed var(--color-auth-input-border)",
            transition: "border-color 150ms",
          }}
        >
          <UploadIcon />
          <span
            className="text-body-sm"
            style={{
              color: "var(--color-auth-input-placeholder)",
              textAlign: "center",
            }}
          >
            {dropOrClickLabel}
          </span>
          {hint && (
            <span
              id={`${id}-hint`}
              className="text-body-sm"
              style={{
                color: "var(--color-content-tertiary)",
                textAlign: "center",
              }}
            >
              {hint}
            </span>
          )}
        </div>
      )}

      {displayError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-body-sm"
          style={{ color: "var(--color-auth-error-text)" }}
        >
          {displayError}
        </p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-auth-input-placeholder)" }}
    >
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="17 8 12 3 7 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="3"
        x2="12"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
