"use client";

import DataTable from "@/components/admin/DataTable";
import SubscriberRowActions from "@/components/admin/SubscriberRowActions";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  KLAVIYO_STATUS_LABELS,
  klaviyoStatusOf,
} from "@/lib/utils/subscriber-status";
import type { AdminSubscriberRow } from "@/lib/db/queries/newsletter";

interface Props {
  rows: AdminSubscriberRow[];
  klaviyoConfigured: boolean;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  ru: "Russian",
};

const SOURCE_LABELS: Record<AdminSubscriberRow["source"], string> = {
  HOME: "Homepage",
  POPUP: "Popup",
};

function klaviyoCell(
  row: AdminSubscriberRow,
  configured: boolean,
): { text: string; title?: string } {
  const status = klaviyoStatusOf(row);
  if (status === null) return { text: "—" };
  if (status === "FAILED") {
    return { text: KLAVIYO_STATUS_LABELS.FAILED, title: row.klaviyoError ?? undefined };
  }
  if (status === "WAITING" && !configured) return { text: "Not connected" };
  return { text: KLAVIYO_STATUS_LABELS[status] };
}

export default function SubscribersTable({ rows, klaviyoConfigured }: Props) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="No subscribers yet."
      columns={[
        {
          key: "email",
          header: "Email",
          render: (row) => (
            <span
              dir="ltr"
              style={{ fontWeight: "var(--font-medium)", color: "#0b0b0b" }}
            >
              {row.email}
            </span>
          ),
        },
        {
          key: "language",
          header: "Language",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {LANGUAGE_LABELS[row.locale] ?? row.locale}
            </span>
          ),
        },
        {
          key: "source",
          header: "Source",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>{SOURCE_LABELS[row.source]}</span>
          ),
        },
        {
          key: "signedUp",
          header: "Signed up",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.createdAt, "en")}
            </span>
          ),
        },
        {
          key: "consent",
          header: "Consent given",
          render: (row) => (
            <span style={{ color: "#6b6b6b" }}>
              {formatDisplayDate(row.consentAt, "en")}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (row) => {
            const subscribed = row.unsubscribedAt === null;
            return (
              <span
                style={{
                  backgroundColor: subscribed ? "#dcfce7" : "#f3f4f6",
                  color: subscribed ? "#166534" : "#374151",
                  paddingInline: "0.5rem",
                  paddingBlock: "0.125rem",
                  fontSize: "var(--text-label)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {subscribed ? "Subscribed" : "Unsubscribed"}
              </span>
            );
          },
        },
        {
          key: "klaviyo",
          header: "Klaviyo",
          render: (row) => {
            const cell = klaviyoCell(row, klaviyoConfigured);
            return (
              <span title={cell.title} style={{ color: "#6b6b6b" }}>
                {cell.text}
              </span>
            );
          },
        },
        {
          key: "actions",
          header: "",
          align: "end",
          render: (row) =>
            row.unsubscribedAt === null ? (
              <SubscriberRowActions id={row.id} />
            ) : null,
        },
      ]}
    />
  );
}
