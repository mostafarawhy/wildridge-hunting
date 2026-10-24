"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import { useToast } from "@/components/ui/Toast";
import { toggleRewardRuleAction } from "@/lib/actions/reward-rule";
import { formatAED } from "@/lib/utils/currency";
import { describeRewardRule } from "@/lib/utils/coupon-display";
import type { AdminRewardRuleListItem } from "@/lib/db/queries/coupon";

interface RuleStats {
  issued: number;
  redeemed: number;
  discountGiven: number;
}

interface Props {
  rules: AdminRewardRuleListItem[];
  stats: Record<string, RuleStats>;
}

const NEW_RULE_HREF = "/admin/coupons/rewards/new";

const blackLink: React.CSSProperties = {
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
  textDecoration: "none",
  borderRadius: "0",
};

const ZERO_STATS: RuleStats = { issued: 0, redeemed: 0, discountGiven: 0 };

const textButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  textDecoration: "underline",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const mutedSmall: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "#6b6b6b",
  margin: 0,
};

function RulePill({ active }: { active: boolean }) {
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

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-semibold)",
          letterSpacing: "var(--tracking-wide)",
          textTransform: "uppercase",
          color: "#6b6b6b",
        }}
      >
        {label}
      </p>
      <p
        dir="ltr"
        style={{
          margin: 0,
          marginTop: "0.25rem",
          fontSize: "var(--text-body)",
          fontWeight: "var(--font-bold)",
          color: "#0b0b0b",
        }}
      >
        {value}
      </p>
    </div>
  );
}

export default function RewardRulesManager({ rules, stats }: Props) {
  const router = useRouter();
  const toast = useToast();

  async function handleToggle(r: AdminRewardRuleListItem) {
    const result = await toggleRewardRuleAction(r.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {rules.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-shop-divider)",
            padding: "3rem 1rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-body)",
              color: "#6b6b6b",
              margin: 0,
            }}
          >
            No reward rules yet.
          </p>
          <Link
            href={NEW_RULE_HREF}
            onClick={() => startNavigationProgress(NEW_RULE_HREF)}
            style={blackLink}
          >
            + New rule
          </Link>
        </div>
      ) : (
        <>
          <p style={{ ...mutedSmall, marginBottom: "1rem" }}>
            One coupon per delivered order, from the highest active rule the
            order total reaches. Changing a rule doesn&apos;t change codes
            already issued. Redeemed and discount given count paid orders only.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
              gap: "1rem",
            }}
          >
            {rules.map((rule) => {
              const ruleStats = stats[rule.id] ?? ZERO_STATS;
              const href = `/admin/coupons/rewards/${rule.id}`;
              return (
                <div
                  key={rule.id}
                  onClick={() => {
                    startNavigationProgress(href);
                    router.push(href);
                  }}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-shop-divider)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--text-body)",
                        fontWeight: "var(--font-bold)",
                        color: "#0b0b0b",
                      }}
                    >
                      {rule.name}
                    </p>
                    <RulePill active={rule.isActive} />
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--text-body)",
                      color: "#0b0b0b",
                    }}
                  >
                    {describeRewardRule(rule)}
                  </p>
                  <p style={mutedSmall}>
                    {rule.isActive ? (
                      <>
                        Codes start{" "}
                        <span
                          dir="ltr"
                          style={{ fontFamily: "var(--font-mono, monospace)" }}
                        >
                          {rule.codePrefix}-
                        </span>
                      </>
                    ) : (
                      "Not issuing while paused."
                    )}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "0.75rem",
                      paddingBottom: "0.75rem",
                      borderBottom: "1px solid var(--color-shop-divider)",
                    }}
                  >
                    <StatCell label="Issued" value={ruleStats.issued} />
                    <StatCell label="Redeemed" value={ruleStats.redeemed} />
                    <StatCell
                      label="Discount given"
                      value={formatAED(ruleStats.discountGiven)}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <Link
                      href={href}
                      onClick={(e) => {
                        e.stopPropagation();
                        startNavigationProgress(href);
                      }}
                      style={{
                        fontSize: "var(--text-body)",
                        color: "#0b0b0b",
                        textDecoration: "underline",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggle(rule);
                      }}
                      style={textButton}
                    >
                      {rule.isActive ? "Pause" : "Resume"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
