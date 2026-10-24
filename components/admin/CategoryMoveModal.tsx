"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { moveCategoryAction } from "@/lib/actions/category";

interface Props {
  open: boolean;
  category: {
    id: string;
    nameEn: string;
    parentId: string | null;
    childCount: number;
  } | null;
  parents: { id: string; nameEn: string }[];
  onClose: () => void;
  onMoved: () => void;
}

const textButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
};

const blackButton: React.CSSProperties = {
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
  cursor: "pointer",
};

export default function CategoryMoveModal({
  open,
  category,
  parents,
  onClose,
  onMoved,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const current = category?.parentId ?? "";
  const [moveTo, setMoveTo] = useState(current);
  const [prevOpen, setPrevOpen] = useState(open);
  const [pending, setPending] = useState(false);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setMoveTo(current);
  }

  const hasChildren = (category?.childCount ?? 0) > 0;
  const unchanged = moveTo === current;

  async function confirmMove() {
    if (!category) return;
    setPending(true);
    const result = await moveCategoryAction(category.id, moveTo);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Category moved.");
    router.refresh();
    onMoved();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      ariaLabel="Move category"
      maxWidth={480}
    >
      <div style={{ padding: "2rem" }}>
        <h2
          style={{
            fontSize: "var(--text-body-lg)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-auth-label-text)",
            marginBottom: "1.25rem",
            paddingInlineEnd: "2rem",
          }}
        >
          {`Move "${category?.nameEn ?? ""}"`}
        </h2>
        <Select
          id="category-move-to"
          label="Move to"
          value={moveTo}
          onChange={(e) => setMoveTo(e.target.value)}
          disabled={pending}
          hint={
            hasChildren
              ? "It has subcategories, so it can only sit at the top level."
              : undefined
          }
        >
          <option value="">Top level{current === "" ? " (current)" : ""}</option>
          {parents
            .filter((p) => p.id !== category?.id)
            .map((p) => (
              <option key={p.id} value={p.id} disabled={hasChildren}>
                {p.nameEn}
                {current === p.id ? " (current)" : ""}
              </option>
            ))}
        </Select>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={() => void confirmMove()}
            disabled={pending || unchanged}
            style={{
              ...blackButton,
              opacity: pending || unchanged ? 0.6 : 1,
              cursor: pending || unchanged ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "Moving…" : "Move"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            style={textButton}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
