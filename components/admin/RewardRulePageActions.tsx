"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { toggleRewardRuleAction } from "@/lib/actions/reward-rule";

interface Props {
  rule: {
    id: string;
    isActive: boolean;
  };
}

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  paddingInline: "1rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
  border: "none",
  borderRadius: "var(--radius-none)",
  cursor: "pointer",
};

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        paddingInline: "0.5rem",
        paddingBlock: "0.125rem",
        fontSize: "var(--text-label)",
        fontWeight: "var(--font-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        backgroundColor: active ? "#dcfce7" : "#f3f4f6",
        color: active ? "#166534" : "#374151",
      }}
    >
      {active ? "Active" : "Paused"}
    </span>
  );
}

export default function RewardRulePageActions({ rule }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function toggle() {
    const pausing = rule.isActive;
    setPending(true);
    const result = await toggleRewardRuleAction(rule.id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      pausing ? "Rule paused. It stops issuing codes." : "Rule resumed.",
    );
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <StatusPill active={rule.isActive} />
      <button
        type="button"
        disabled={pending}
        onClick={() => void toggle()}
        style={{ ...primaryButton, opacity: pending ? 0.6 : 1 }}
      >
        {rule.isActive ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
