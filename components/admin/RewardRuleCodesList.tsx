"use client";

import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import CouponStatusPill from "@/components/admin/CouponStatusPill";
import { formatCouponDate } from "@/lib/utils/coupon-display";
import type { RuleIssuedCouponRow } from "@/lib/db/queries/coupon";

interface Props {
  rows: RuleIssuedCouponRow[];
  total: number;
}

const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-auth-form-border)",
  borderRadius: "var(--radius-none)",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const eyebrow: React.CSSProperties = {
  fontSize: "var(--text-eyebrow)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  color: "var(--color-action-primary)",
  margin: 0,
};

const heading: React.CSSProperties = {
  fontSize: "var(--text-body-lg)",
  fontWeight: "var(--font-bold)",
  color: "#0b0b0b",
  margin: 0,
};

const mutedText: React.CSSProperties = {
  fontSize: "var(--text-body-sm)",
  color: "var(--color-auth-input-placeholder)",
  margin: 0,
};

const th: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "0.75rem",
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
  borderTop: "1px solid var(--color-shop-divider)",
  verticalAlign: "top",
};

const link: React.CSSProperties = {
  color: "#0b0b0b",
  textDecoration: "underline",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function RewardRuleCodesList({ rows, total }: Props) {
  return (
    <div style={{ ...card, marginTop: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p style={eyebrow}>Issued codes</p>
        <h2 style={heading}>{plural(total, "code", "codes")} issued</h2>
      </div>

      {rows.length === 0 ? (
        <p style={mutedText}>No codes issued yet.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Code</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Earned by order</th>
                  <th style={th}>Issued</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>
                      <Link
                        href={`/admin/coupons/${row.id}`}
                        onClick={() =>
                          startNavigationProgress(`/admin/coupons/${row.id}`)
                        }
                        dir="ltr"
                        style={{
                          ...link,
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td style={td}>
                      {row.customer ? (
                        <Link
                          href={`/admin/customers/${row.customer.id}`}
                          onClick={() =>
                            startNavigationProgress(
                              `/admin/customers/${row.customer!.id}`,
                            )
                          }
                          dir="ltr"
                          style={link}
                        >
                          {row.customer.email}
                        </Link>
                      ) : (
                        <span style={{ color: "#6b6b6b" }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      {row.sourceOrder ? (
                        <Link
                          href={`/admin/orders/${row.sourceOrder.id}`}
                          onClick={() =>
                            startNavigationProgress(
                              `/admin/orders/${row.sourceOrder!.id}`,
                            )
                          }
                          dir="ltr"
                          style={{
                            ...link,
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          {row.sourceOrder.orderNumber}
                        </Link>
                      ) : (
                        <span style={{ color: "#6b6b6b" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {formatCouponDate(row.createdAt)}
                    </td>
                    <td style={td}>
                      <CouponStatusPill status={row.status} />
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <span dir="ltr" style={{ whiteSpace: "nowrap" }}>
                        {row.usedCount} / {row.usageLimit ?? "∞"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > rows.length && (
            <p style={mutedText}>
              Showing the latest {rows.length} of {total}
            </p>
          )}
        </>
      )}
    </div>
  );
}
