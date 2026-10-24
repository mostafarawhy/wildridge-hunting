"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { mintRefundProofUrl } from "@/lib/actions/admin-documents";
import RecordRefundModal from "@/components/admin/RecordRefundModal";
import { formatAED } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/date";
import {
  REFUND_METHOD_LABELS,
  REFUND_STATE_LABELS,
  type RefundState,
} from "@/lib/utils/refund";
import type { RefundMethod } from "@/app/generated/prisma/client";

interface RefundRow {
  id: string;
  method: RefundMethod;
  methodOtherLabel: string | null;
  externalReference: string;
  amountAed: number;
  refundedAt: string;
  recordedByName: string | null;
  notes: string | null;
  filename: string;
  mimeType: string | null;
}

interface Props {
  orderId: string;
  receivedAed: number;
  refundDueAed: number;
  refundedAed: number;
  owedAed: number;
  refundState: RefundState;
  refunds: RefundRow[];
  canMarkPaid: boolean;
  openRecordOnMount?: boolean;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid var(--color-shop-divider)",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid var(--color-shop-divider)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--text-label)",
  fontWeight: "var(--font-semibold)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "#6b6b6b",
};

const valueStyle: React.CSSProperties = {
  fontSize: "var(--text-body)",
  color: "#0b0b0b",
};

const STATE_STYLES: Record<
  Exclude<RefundState, "NONE">,
  { backgroundColor: string; color: string }
> = {
  OWED: { backgroundColor: "#fef9c3", color: "#854d0e" },
  PARTIAL: { backgroundColor: "#dbeafe", color: "#1e40af" },
  REFUNDED: { backgroundColor: "#dcfce7", color: "#166534" },
};

const proofBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2rem",
  paddingInline: "0.875rem",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--font-bold)",
  letterSpacing: "var(--tracking-widest)",
  textTransform: "uppercase",
  border: "none",
  borderRadius: "0",
  cursor: "pointer",
  backgroundColor: "#0b0b0b",
  color: "#ffffff",
};

function RefundProofButtons({
  orderId,
  refundId,
  filename,
}: {
  orderId: string;
  refundId: string;
  filename: string;
}) {
  const [pending, setPending] = useState<"view" | "download" | null>(null);
  const [failed, setFailed] = useState(false);

  async function handle(variant: "view" | "download") {
    setPending(variant);
    const result = await mintRefundProofUrl(orderId, refundId, variant);
    setPending(null);
    if (!result.success) {
      setFailed(true);
      return;
    }
    if (variant === "view") {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
      return;
    }
    const a = window.document.createElement("a");
    a.href = result.data.url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }

  if (failed) {
    return (
      <span style={{ fontSize: "var(--text-body-sm)", color: "#6b6b6b" }}>
        Unavailable
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={() => handle("view")}
        disabled={pending !== null}
        style={proofBtn}
      >
        Open
      </button>
      <button
        type="button"
        onClick={() => handle("download")}
        disabled={pending !== null}
        style={proofBtn}
      >
        Download
      </button>
    </span>
  );
}

export default function OrderRefundsCard({
  orderId,
  receivedAed,
  refundDueAed,
  refundedAed,
  owedAed,
  refundState,
  refunds,
  canMarkPaid,
  openRecordOnMount = false,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [recordOpen, setRecordOpen] = useState(
    openRecordOnMount && canMarkPaid && owedAed > 0,
  );

  if (refundDueAed <= 0 && refunds.length === 0) return null;

  const ladder: { label: string; value: string }[] = [
    { label: "Received", value: formatAED(receivedAed, "en") },
    { label: "Refund due", value: formatAED(refundDueAed, "en") },
    { label: "Refunded so far", value: formatAED(refundedAed, "en") },
    { label: "Owed", value: formatAED(owedAed, "en") },
  ];

  return (
    <div style={cardStyle}>
      <div
        style={{
          ...cardHeaderStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <p style={labelStyle}>
          Refunds{" "}
          <span style={{ color: "var(--color-content-tertiary)" }}>
            · {refunds.length}
          </span>
        </p>
        {refundState !== "NONE" && (
          <span
            style={{
              display: "inline-block",
              paddingInline: "0.625rem",
              paddingBlock: "0.25rem",
              fontSize: "var(--text-label)",
              fontWeight: "var(--font-semibold)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
              borderRadius: "0",
              ...STATE_STYLES[refundState],
            }}
          >
            {REFUND_STATE_LABELS[refundState]}
          </span>
        )}
      </div>

      <div style={{ padding: "0 1.25rem" }}>
        {ladder.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "0.875rem 0",
              borderBottom:
                idx < ladder.length - 1
                  ? "1px solid var(--color-shop-divider)"
                  : "none",
            }}
          >
            <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
            <p
              style={{
                ...valueStyle,
                textAlign: "end",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span dir="ltr">{row.value}</span>
            </p>
          </div>
        ))}
      </div>

      {canMarkPaid && owedAed > 0 && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--color-shop-divider)",
          }}
        >
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            style={{
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
              cursor: "pointer",
              backgroundColor: "var(--color-action-primary)",
              color: "#ffffff",
            }}
          >
            Record refund
          </button>
        </div>
      )}

      {refunds.map((r, idx) => {
        const rows: { label: string; value: React.ReactNode }[] = [
          {
            label: "Amount",
            value: <span dir="ltr">{formatAED(r.amountAed, "en")}</span>,
          },
          {
            label: "Method",
            value: r.methodOtherLabel ?? REFUND_METHOD_LABELS[r.method],
          },
          {
            label: "Reference",
            value: <span dir="ltr">{r.externalReference}</span>,
          },
          { label: "Refunded At", value: formatDisplayDate(r.refundedAt, "en") },
          { label: "Recorded By", value: r.recordedByName ?? "—" },
          {
            label: "Proof",
            value: (
              <span
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "0.5rem",
                }}
              >
                <span>
                  {r.mimeType ? `${r.filename} (${r.mimeType})` : r.filename}
                </span>
                {canMarkPaid && (
                  <RefundProofButtons
                    orderId={orderId}
                    refundId={r.id}
                    filename={r.filename}
                  />
                )}
              </span>
            ),
          },
          ...(r.notes ? [{ label: "Note", value: r.notes }] : []),
        ];

        return (
          <div key={r.id}>
            <div
              style={{
                padding: "1rem 1.25rem 0.5rem",
                backgroundColor: "#fafafa",
                borderTop: "1px solid var(--color-shop-divider)",
                borderBottom: "1px solid var(--color-shop-divider)",
              }}
            >
              <p style={labelStyle}>Refund {idx + 1}</p>
            </div>
            <div style={{ padding: "0 1.25rem" }}>
              {rows.map((row, rowIdx) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    padding: "0.875rem 0",
                    borderBottom:
                      rowIdx < rows.length - 1
                        ? "1px solid var(--color-shop-divider)"
                        : "none",
                  }}
                >
                  <p style={{ ...labelStyle, flexShrink: 0 }}>{row.label}</p>
                  <div style={{ ...valueStyle, textAlign: "end" }}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {recordOpen && (
        <RecordRefundModal
          orderId={orderId}
          refundDueAed={refundDueAed}
          refundedAed={refundedAed}
          owedAed={owedAed}
          onClose={() => setRecordOpen(false)}
          onSuccess={() => {
            setRecordOpen(false);
            toast.success("Refund recorded.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
