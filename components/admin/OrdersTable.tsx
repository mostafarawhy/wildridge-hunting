"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import OrderBulkBar from "@/components/admin/OrderBulkBar";
import OrderRowMenu from "@/components/admin/OrderRowMenu";
import OrderStatusPill from "@/components/ui/OrderStatusPill";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import { REFUND_STATE_LABELS } from "@/lib/utils/refund";
import type { AdminOrderListItemProjection } from "@/lib/db/queries/order";

interface Props {
  rows: AdminOrderListItemProjection[];
  staleShippedDays: number;
  filtered: boolean;
  canManage: boolean;
  canMarkPaid: boolean;
  canViewCustomer: boolean;
  canCreateTicket: boolean;
}

const REFUND_CHIP: Record<
  Exclude<AdminOrderListItemProjection["refundState"], "NONE">,
  { backgroundColor: string; color: string }
> = {
  OWED: { backgroundColor: "#fef9c3", color: "#854d0e" },
  PARTIAL: { backgroundColor: "#dbeafe", color: "#1e40af" },
  REFUNDED: { backgroundColor: "#dcfce7", color: "#166534" },
};

export default function OrdersTable({
  rows,
  staleShippedDays,
  filtered,
  canManage,
  canMarkPaid,
  canViewCustomer,
  canCreateTicket,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setSelected([]);
  }

  const canExport = canManage || canMarkPaid;
  const selectable = canManage || canExport;
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.includes(row.id));

  function toggleRow(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((row) => row.id));
  }

  return (
    <>
    {selectable && (
      <OrderBulkBar
        selectedIds={selected}
        canManage={canManage}
        canExport={canExport}
        onClear={() => setSelected([])}
      />
    )}
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/orders/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage={filtered ? "No orders match these filters." : "No orders yet."}
      columns={[
        ...(selectable
          ? [
              {
                key: "select",
                header: (
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={allSelected}
                    onChange={toggleAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
                render: (row: AdminOrderListItemProjection) => (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex" }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select order ${row.orderNumber}`}
                      checked={selected.includes(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </span>
                ),
              },
            ]
          : []),
        {
          key: "orderNumber",
          header: "Order",
          render: (row) => (
            <span
              dir="ltr"
              style={{ fontFamily: "monospace", color: "#0b0b0b" }}
            >
              {row.orderNumber}
            </span>
          ),
        },
        {
          key: "placed",
          header: "Placed",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "customer",
          header: "Customer",
          render: (row) => (
            <div>
              <p style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}>
                {row.customerName}
              </p>
              <p style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
                {row.customerEmail}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => {
            const isStale =
              row.status === "SHIPPED" &&
              !!row.shippedAt &&
              Date.now() - new Date(row.shippedAt).getTime() >
                staleShippedDays * 864e5;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <OrderStatusPill status={row.status} />
                {isStale && (
                  <span
                    style={{
                      backgroundColor: "#fef9c3",
                      color: "#854d0e",
                      paddingInline: "0.5rem",
                      paddingBlock: "0.125rem",
                      fontSize: "var(--text-label)",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Awaiting confirmation
                  </span>
                )}
              </div>
            );
          },
        },
        {
          key: "payment",
          header: "Payment",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {row.paymentProvider === "MANUAL" ? "Offline" : "Card"}
              {row.fromQuote ? " · Quote" : ""}
            </span>
          ),
        },
        {
          key: "refund",
          header: "Refund",
          render: (row) =>
            row.refundState === "NONE" ? (
              <span style={{ color: "#6b6b6b" }}>—</span>
            ) : (
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
                  ...REFUND_CHIP[row.refundState],
                }}
              >
                {REFUND_STATE_LABELS[row.refundState]}
                {row.owedAed > 0 ? ` · ${formatAED(row.owedAed, "en")}` : ""}
              </span>
            ),
        },
        {
          key: "total",
          header: "Total",
          align: "end",
          render: (row) => (
            <span style={{ color: "#0b0b0b" }}>
              {formatAED(row.totalAed, "en")}
            </span>
          ),
        },
        {
          key: "actions",
          header: "",
          align: "end",
          render: (row) => (
            <OrderRowMenu
              orderId={row.id}
              orderNumber={row.orderNumber}
              status={row.status}
              customerId={row.customerId}
              owedAed={row.owedAed}
              canManage={canManage}
              canMarkPaid={canMarkPaid}
              canViewCustomer={canViewCustomer}
              canCreateTicket={canCreateTicket}
            />
          ),
        },
      ]}
    />
    </>
  );
}
