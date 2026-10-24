"use client";

interface Props {
  savedLabel: string | null;
  dirty: boolean;
  saveLabel: string;
  onSave: () => void;
  saving: boolean;
  previewLabel?: string;
  onPreview?: () => void;
  extra?: React.ReactNode;
}

const barStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 1,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.75rem 1rem",
  padding: "0.75rem 1rem",
  backgroundColor: "#ffffff",
  border: "1px solid #e8e8e8",
  borderRadius: "0",
};

const saveBtn: React.CSSProperties = {
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

const previewLink: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body-sm)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

export default function ContentSaveBar({
  savedLabel,
  dirty,
  saveLabel,
  onSave,
  saving,
  previewLabel = "Preview",
  onPreview,
  extra,
}: Props) {
  return (
    <div style={barStyle}>
      {savedLabel && (
        <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
          {savedLabel}
        </span>
      )}
      {dirty && (
        <span
          style={{
            fontSize: "var(--text-body-sm)",
            fontWeight: "var(--font-semibold)",
            color: "#92400e",
          }}
        >
          Unsaved changes
        </span>
      )}
      {extra}
      <div
        style={{
          marginInlineStart: "auto",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {onPreview && (
          <button type="button" onClick={onPreview} style={previewLink}>
            {previewLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            ...saveBtn,
            opacity: saving ? 0.5 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
