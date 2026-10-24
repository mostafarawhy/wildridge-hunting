"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AddNoteResult } from "@/lib/actions/staff-notes";

interface Props {
  action: (id: string, note: string) => Promise<AddNoteResult>;
  entityId: string;
}

export default function InternalNotesPanel({ action, entityId }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const trimmed = note.trim();
    if (trimmed.length === 0) {
      setError("A note is required.");
      return;
    }
    startTransition(async () => {
      const result = await action(entityId, trimmed);
      if (result.success) {
        setNote("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
        borderTop: "2px solid #fde68a",
      }}
    >
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--color-shop-divider)",
          backgroundColor: "#fffbeb",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-label)",
            fontWeight: "var(--font-semibold)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            color: "#92400e",
          }}
        >
          Internal note
        </p>
      </div>
      <div style={{ padding: "1.25rem" }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for the team. Visible to staff only, kept in the record permanently."
          rows={3}
          style={{
            width: "100%",
            minHeight: "88px",
            padding: "0.625rem 0.875rem",
            fontSize: "var(--text-body)",
            fontFamily: "inherit",
            color: "#0b0b0b",
            backgroundColor: "#ffffff",
            border: "1.5px solid var(--color-shop-divider)",
            borderRadius: "0",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        {error !== null && (
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-auth-error-text)",
            }}
          >
            {error}
          </p>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "0.875rem",
          }}
        >
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            style={{
              height: "2.5rem",
              padding: "0 1.25rem",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              color: "#ffffff",
              backgroundColor: "#0b0b0b",
              border: "none",
              borderRadius: "0",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "Adding…" : "Add note"}
          </button>
        </div>
      </div>
    </div>
  );
}
