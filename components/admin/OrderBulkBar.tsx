"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import OrderExportButton from "@/components/admin/OrderExportButton";
import { bulkOrderAction } from "@/lib/actions/order-bulk";
import { dubaiDay } from "@/lib/utils/date";

type BulkAction = "CONFIRM" | "START_PROCESSING" | "MARK_DELIVERED";

interface Props {
  selectedIds: string[];
  canManage: boolean;
  canExport: boolean;
  onClear: () => void;
}

const ACTION_LABELS: Record<BulkAction, string> = {
  CONFIRM: "Confirm",
  START_PROCESSING: "Start processing",
  MARK_DELIVERED: "Mark delivered",
};

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

export default function OrderBulkBar({
  selectedIds,
  canManage,
  canExport,
  onClear,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<
    "CONFIRM" | "START_PROCESSING" | null
  >(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [deliveredOn, setDeliveredOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<
    { orderNumber: string; reason: string }[]
  >([]);

  const count = selectedIds.length;
  const todayDubai = dubaiDay(new Date());

  if (count === 0 && skipped.length === 0) return null;

  function run(action: BulkAction) {
    setError(null);
    setSkipped([]);
    startTransition(async () => {
      const result = await bulkOrderAction({
        action,
        orderIds: selectedIds,
        deliveredOn: action === "MARK_DELIVERED" ? deliveredOn : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const label = ACTION_LABELS[action];
      const movedCount = result.moved.length;
      const skippedCount = result.skipped.length;
      const message = `${label}: ${movedCount} moved.${
        skippedCount > 0 ? ` ${skippedCount} skipped.` : ""
      }`;
      if (movedCount > 0) toast.success(message);
      else toast.error(message);
      setSkipped(result.skipped);
      setDeliverOpen(false);
      onClear();
      router.refresh();
    });
  }

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        backgroundColor: "#ffffff",
        border: "1px solid var(--color-shop-divider)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-semibold)",
            color: "#0b0b0b",
            marginInlineEnd: "0.5rem",
          }}
        >
          {count} selected
        </p>

        {count > 0 && (
          <>
            {canManage && (
              <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmAction("CONFIRM")}
              style={{
                ...btnBase,
                backgroundColor: "var(--color-action-primary)",
                color: "#ffffff",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmAction("START_PROCESSING")}
              style={{
                ...btnBase,
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Start processing
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setDeliveredOn(todayDubai);
                setDeliverOpen(true);
              }}
              style={{
                ...btnBase,
                backgroundColor: "#0b0b0b",
                color: "#ffffff",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Mark delivered
            </button>
              </>
            )}
            <OrderExportButton
              canExport={canExport}
              count={count}
              orderIds={selectedIds}
              label="Export selected"
            />
          </>
        )}

        <button
          type="button"
          onClick={() => {
            setSkipped([]);
            setError(null);
            onClear();
          }}
          disabled={isPending}
          style={{
            ...btnBase,
            backgroundColor: "transparent",
            color: "#0b0b0b",
            paddingInline: 0,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "#991b1b",
            marginTop: "0.75rem",
          }}
        >
          {error}
        </p>
      )}

      {skipped.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <p
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: "var(--font-semibold)",
              color: "#0b0b0b",
              marginBottom: "0.25rem",
            }}
          >
            Skipped
          </p>
          <ul
            style={{
              margin: 0,
              paddingInlineStart: "1.125rem",
              fontSize: "var(--text-body-sm)",
              color: "#6b6b6b",
            }}
          >
            {skipped.map((s) => (
              <li key={s.orderNumber}>
                <span dir="ltr" style={{ fontFamily: "monospace" }}>
                  {s.orderNumber}
                </span>{" "}
                — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            run(action);
          }}
          title={ACTION_LABELS[confirmAction]}
          message={
            confirmAction === "CONFIRM"
              ? `This will confirm ${count} ${count === 1 ? "order" : "orders"}. Orders that are not Paid are skipped.`
              : `This will start processing ${count} ${count === 1 ? "order" : "orders"}. Orders that are not Confirmed are skipped.`
          }
          confirmLabel={ACTION_LABELS[confirmAction]}
          cancelLabel="Cancel"
          isPending={isPending}
          destructive={false}
        />
      )}

      {deliverOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onClick={isPending ? undefined : () => setDeliverOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              width: "100%",
              maxWidth: "440px",
              padding: "2rem",
              margin: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "var(--text-body-lg)",
                fontWeight: "var(--font-bold)",
                color: "#0b0b0b",
                marginBottom: "0.625rem",
              }}
            >
              Mark {count} {count === 1 ? "order" : "orders"} delivered
            </h2>
            <p
              style={{
                fontSize: "var(--text-body)",
                color: "#6b6b6b",
                marginBottom: "1.25rem",
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              Orders with a regulated item, or not Shipped, are skipped. Add
              handover details on each order afterwards.
            </p>
            <label
              htmlFor="bulk-delivered-on"
              style={{
                display: "block",
                fontSize: "var(--text-body-sm)",
                color: "#0b0b0b",
                marginBottom: "0.25rem",
              }}
            >
              Delivered on
            </label>
            <input
              id="bulk-delivered-on"
              type="date"
              dir="ltr"
              value={deliveredOn}
              max={todayDubai}
              onChange={(e) => setDeliveredOn(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.625rem",
                fontSize: "var(--text-body)",
                color: "#0b0b0b",
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-shop-divider)",
                borderRadius: "0",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}
            >
              <button
                type="button"
                disabled={isPending || !deliveredOn || deliveredOn > todayDubai}
                onClick={() => run("MARK_DELIVERED")}
                style={{
                  ...btnBase,
                  backgroundColor: "var(--color-action-primary)",
                  color: "#ffffff",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity:
                    isPending || !deliveredOn || deliveredOn > todayDubai
                      ? 0.4
                      : 1,
                }}
              >
                Mark delivered
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeliverOpen(false)}
                style={{
                  ...btnBase,
                  backgroundColor: "transparent",
                  color: "#0b0b0b",
                  paddingInline: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
