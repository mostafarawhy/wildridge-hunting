"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/loading/NavigationProgress";
import DataTable from "@/components/admin/DataTable";
import QuoteBulkBar from "@/components/admin/QuoteBulkBar";
import QuoteRowMenu from "@/components/admin/QuoteRowMenu";
import QuoteStatusPill from "@/components/ui/QuoteStatusPill";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import type { AdminQuoteListItemProjection } from "@/lib/db/queries/quote";
import { CONVERTED_QUOTE_LABEL } from "@/lib/utils/quote-status";

interface Props {
  rows: AdminQuoteListItemProjection[];
  filtered: boolean;
  canViewOrders: boolean;
  canViewCustomer: boolean;
  canCreateTicket: boolean;
  canExport: boolean;
}

export default function QuoteRequestsTable({
  rows,
  filtered,
  canViewOrders,
  canViewCustomer,
  canCreateTicket,
  canExport,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setSelected([]);
  }

  const selectable = canExport;
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
    <div className="hidden lg:block">
      {selectable && (
        <QuoteBulkBar
          selectedIds={selected}
          canExport={canExport}
          onClear={() => setSelected([])}
        />
      )}
    </div>
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={(row) => {
        const href = `/admin/quotes/${row.id}`;
        startNavigationProgress(href);
        router.push(href);
      }}
      emptyMessage={
        filtered ? "No quotes match these filters." : "No quote requests yet."
      }
      columns={[
        ...(selectable
          ? [
              {
                key: "select",
                mobile: "hide" as const,
                header: (
                  <input
                    type="checkbox"
                    aria-label="Select all quotes on this page"
                    checked={allSelected}
                    onChange={toggleAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                ),
                render: (row: AdminQuoteListItemProjection) => (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex" }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select quote ${row.quoteNumber}`}
                      checked={selected.includes(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </span>
                ),
              },
            ]
          : []),
        {
          key: "quoteNumber",
          header: "Quote #",
          render: (row) => (
            <span
              dir="ltr"
              style={{ fontFamily: "monospace", color: "#0b0b0b" }}
            >
              {row.quoteNumber}
            </span>
          ),
        },
        {
          key: "submitted",
          header: "Submitted",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "company",
          header: "Company",
          render: (row) => (
            <div>
              <p style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}>
                {row.companyNameEn}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#6b6b6b" }}>
                {row.customerName}
              </p>
            </div>
          ),
        },
        {
          key: "items",
          header: "Items",
          align: "end",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>{row.itemCount}</span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => (
            <QuoteStatusPill
              status={row.status}
              label={
                row.convertedOrderId != null ? CONVERTED_QUOTE_LABEL : undefined
              }
            />
          ),
        },
        {
          key: "total",
          header: "Total",
          align: "end",
          render: (row) => (
            <span style={{ color: "#0b0b0b" }}>
              {row.quotedTotalAed != null
                ? formatAED(
                    row.quotedTotalAed + (row.shippingCostAed ?? 0),
                    "en",
                  )
                : "—"}
            </span>
          ),
        },
        {
          key: "actions",
          header: "",
          align: "end",
          render: (row) => (
            <QuoteRowMenu
              quoteId={row.id}
              quoteNumber={row.quoteNumber}
              customerId={row.customerId}
              convertedOrderId={row.convertedOrderId}
              convertedOrderNumber={row.convertedOrderNumber}
              canViewOrders={canViewOrders}
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
