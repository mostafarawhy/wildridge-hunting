"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { addTicketCommentAction } from "@/lib/actions/tickets";

interface Props {
  ticketId: string;
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.5rem",
  paddingInline: "1.25rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  border: "1px solid var(--color-shop-divider)",
  borderRadius: "0",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
};

export default function TicketCommentForm({ ticketId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [commentNote, setCommentNote] = useState("");

  function handleComment() {
    if (!commentNote.trim()) return;
    setError(null);
    setErrorCode(null);
    startTransition(async () => {
      const result = await addTicketCommentAction({
        ticketId,
        note: commentNote.trim(),
      });
      if (result.success) {
        setCommentNote("");
        toast.success("Comment added.");
        router.refresh();
      } else {
        setError(result.error);
        setErrorCode(result.errorCode);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <textarea
        value={commentNote}
        onChange={(e) => setCommentNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Write a comment for the team"
        disabled={isPending}
        style={textareaStyle}
      />
      <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Staff only. The customer never sees comments.
      </p>
      <div>
        <button
          type="button"
          disabled={isPending || !commentNote.trim()}
          onClick={handleComment}
          style={{
            ...btnBase,
            backgroundColor: "#0b0b0b",
            color: "#ffffff",
            cursor:
              isPending || !commentNote.trim() ? "not-allowed" : "pointer",
            opacity: isPending || !commentNote.trim() ? 0.6 : 1,
            transition: "opacity 150ms",
          }}
        >
          {isPending && (
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "0.875em",
                height: "0.875em",
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                marginInlineEnd: "0.5rem",
                flexShrink: 0,
              }}
            />
          )}
          Add Comment
        </button>
      </div>

      {error && (
        <p style={{ fontSize: "var(--text-body-sm)", color: "#991b1b" }}>
          {error}
          {errorCode && (
            <span style={{ color: "#6b6b6b" }}> ({errorCode})</span>
          )}
        </p>
      )}
    </div>
  );
}
