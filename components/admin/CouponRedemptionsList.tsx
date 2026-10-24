"use client";

import Link from "next/link";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import OrderStatusPill from "@/components/ui/OrderStatusPill";
import { formatAED } from "@/lib/utils/currency";
import { formatDateTime } from "@/lib/utils/date";
import type { CouponRedemptionRow } from "@/lib/db/queries/coupon";

interface Props {
  redemptionCount: number;
  discountGiven: number;
  rows: CouponRedemptionRow[];
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

export default function CouponRedemptionsList({
  redemptionCount,
  discountGiven,
  rows,
}: Props) {
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          paddingBottom: "0.875rem",
          borderBottom: "1px solid var(--color-shop-divider)",
        }}
      >
        <p style={eyebrow}>Redemptions</p>
        <h2 style={heading}>
          {plural(redemptionCount, "redemption", "redemptions")}
        </h2>
        <p style={mutedText}>
          Discount given {formatAED(discountGiven)} on paid orders
        </p>
      </div>

      {rows.length === 0 ? (
        <p style={mutedText}>No one has used this code yet.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Order</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Date</th>
                  <th style={th}>Order status</th>
                  <th style={{ ...th, textAlign: "right" }}>Discount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>
                      <Link
                        href={`/admin/orders/${row.order.id}`}
                        onClick={() =>
                          startNavigationProgress(`/admin/orders/${row.order.id}`)
                        }
                        dir="ltr"
                        style={{
                          ...link,
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {row.order.orderNumber}
                      </Link>
                    </td>
                    <td style={td}>
                      <Link
                        href={`/admin/customers/${row.customer.id}`}
                        onClick={() =>
                          startNavigationProgress(
                            `/admin/customers/${row.customer.id}`,
                          )
                        }
                        dir="ltr"
                        style={link}
                      >
                        {row.customer.email}
                      </Link>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {formatDateTime(row.createdAt, "en")}
                    </td>
                    <td style={td}>
                      <OrderStatusPill status={row.order.status} />
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <span
                        dir="ltr"
                        style={{
                          whiteSpace: "nowrap",
                          color: row.counted ? "#0b0b0b" : "#6b6b6b",
                        }}
                      >
                        {formatAED(row.discountAmount)}
                      </span>
                      {!row.counted && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "var(--text-body-sm)",
                            color: "#6b6b6b",
                          }}
                        >
                          Not counted
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {redemptionCount > rows.length && (
            <p style={mutedText}>
              Showing the latest {rows.length} of {redemptionCount}
            </p>
          )}
        </>
      )}
    </div>
  );
}
